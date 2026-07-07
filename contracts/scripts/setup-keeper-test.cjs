// Sets up ONE fresh backed job and deliberately does NOT call confirm-funding
// and does NOT resolve -- the running keeper must (a) snapshot funding via its
// safety net and (b) auto-resolve at the deadline block. Proof for Phase 3.
// Usage: node scripts/setup-keeper-test.cjs [deadline-offset-blocks]
const fs = require("fs");
const path = require("path");
const {
  makeContractCall,
  broadcastTransaction,
  fetchCallReadOnlyFunction,
  Cl,
} = require("@stacks/transactions");

const API = "https://api.testnet.hiro.so";
const COSIGN_ADDR = "ST31DYZV2SMJHDWQ39T8MWBW8N0AKDR0PVM43D6T2";
const COSIGN_NAME = "cosign";
const FV_ADDR = "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD";
const FV_NAME = "flowvault-v2";
const USDCX_ADDR = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const TOKEN = Cl.contractPrincipal(USDCX_ADDR, "usdcx");
const JOB_VALUE = 1_000_000n;
const STAKE = 200_000n;

const W = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "deployer-secret-parties.json"), "utf8")
);
const explorer = (txid) => `https://explorer.hiro.so/txid/0x${txid}?chain=testnet`;

async function ro(a, c, f, args) {
  return fetchCallReadOnlyFunction({
    contractAddress: a, contractName: c, functionName: f, functionArgs: args,
    network: "testnet", senderAddress: COSIGN_ADDR,
  });
}

async function waitTx(txid, label) {
  for (let i = 0; i < 90; i++) {
    try {
      const j = await (await fetch(`${API}/extended/v1/tx/0x${txid}`)).json();
      if (j.tx_status === "success") return;
      if (String(j.tx_status).startsWith("abort"))
        throw new Error(`${label}: ${j.tx_status} ${j.tx_result?.repr ?? ""}`);
    } catch (e) {
      if (String(e.message).includes(":")) throw e;
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error(`${label} not confirmed`);
}

async function call(who, a, c, f, args, label) {
  const n = await (await fetch(`${API}/extended/v1/address/${W[who].address}/nonces`)).json();
  const tx = await makeContractCall({
    contractAddress: a, contractName: c, functionName: f, functionArgs: args,
    senderKey: W[who].privateKey, network: "testnet",
    nonce: BigInt(n.possible_next_nonce), fee: 50_000n, postConditionMode: "allow",
  });
  const r = await broadcastTransaction({ transaction: tx, network: "testnet" });
  if (r.error) throw new Error(`${label}: ${JSON.stringify(r)}`);
  console.log(`${label}: ${explorer(r.txid)}`);
  await waitTx(r.txid, label);
  return r.txid;
}

async function main() {
  const offset = Number(process.argv[2] ?? 15);
  const h = Number((await ro(FV_ADDR, FV_NAME, "get-current-block-height", [])).value);
  const deadline = h + offset;
  console.log(`height ${h}, deadline ${deadline}`);

  const createTx = await call("client", COSIGN_ADDR, COSIGN_NAME, "create-job",
    [Cl.principal(W.newcomer.address), Cl.uint(JOB_VALUE), Cl.uint(deadline), TOKEN], "create-job");
  const j = await (await fetch(`${API}/extended/v1/tx/0x${createTx}`)).json();
  const jobId = j.tx_result.repr.match(/u(\d+)/)[1];
  console.log(`job-id ${jobId}`);

  await call("backer", COSIGN_ADDR, COSIGN_NAME, "co-sign",
    [Cl.uint(BigInt(jobId)), Cl.uint(STAKE), TOKEN], "co-sign");

  const terms = (await ro(COSIGN_ADDR, COSIGN_NAME, "read-terms", [Cl.uint(BigInt(jobId))])).value.value;
  const lockUntil = BigInt(terms["lock-until-block"].value);
  console.log(`terms: lock ${JOB_VALUE} until ${lockUntil} (deadline ${deadline})`);

  await call("newcomer", FV_ADDR, FV_NAME, "set-routing-rules",
    [Cl.uint(JOB_VALUE), Cl.uint(lockUntil), Cl.none(), Cl.uint(0)], "set-routing-rules");
  await call("newcomer", FV_ADDR, FV_NAME, "deposit", [TOKEN, Cl.uint(JOB_VALUE)], "deposit");

  console.log(`\nSetup complete. job#${jobId}, deadline ${deadline}.`);
  console.log("confirm-funding NOT called and resolve NOT called -- the keeper must do both.");
}

main().catch((e) => { console.error("FAILED:", e.message ?? e); process.exit(1); });
