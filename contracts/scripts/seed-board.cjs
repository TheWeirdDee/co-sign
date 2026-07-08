// Seeds the board with live states for review/demo:
//   job E: OPEN  -- value 2.0, long window, newcomer3, no backer (seat open)
//   job F: RUNNING -- value 1.0, long window, newcomer2 deposits, backer stakes 0.2
// Long windows (500+ blocks) so the running card ticks for hours and the
// improved-terms delta is visible (demo-setup requirement).
const fs = require("fs");
const path = require("path");
const {
  makeContractCall, broadcastTransaction, fetchCallReadOnlyFunction, Cl,
} = require("@stacks/transactions");

const API = "https://api.testnet.hiro.so";
const COSIGN_ADDR = "ST31DYZV2SMJHDWQ39T8MWBW8N0AKDR0PVM43D6T2";
const FV_ADDR = "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD";
const USDCX_ADDR = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const TOKEN = Cl.contractPrincipal(USDCX_ADDR, "usdcx");
const W = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployer-secret-parties.json"), "utf8"));
const explorer = (t) => `https://explorer.hiro.so/txid/0x${t}?chain=testnet`;

async function ro(a, c, f, args) {
  return fetchCallReadOnlyFunction({ contractAddress: a, contractName: c, functionName: f, functionArgs: args, network: "testnet", senderAddress: COSIGN_ADDR });
}
async function waitTx(txid, label) {
  for (let i = 0; i < 90; i++) {
    try {
      const j = await (await fetch(`${API}/extended/v1/tx/0x${txid}`)).json();
      if (j.tx_status === "success") return;
      if (String(j.tx_status).startsWith("abort")) throw new Error(`${label}: ${j.tx_status} ${j.tx_result?.repr ?? ""}`);
    } catch (e) { if (String(e.message).includes(":")) throw e; }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error(`${label} timeout`);
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
  const h = Number((await ro(FV_ADDR, "flowvault-v2", "get-current-block-height", [])).value);
  console.log("height", h);

  // job E -- OPEN, awaiting a backer (value 2.0, 700-block window)
  const eTx = await call("client", COSIGN_ADDR, "cosign-v2", "create-job",
    [Cl.principal(W.newcomer3.address), Cl.uint(2_000_000), Cl.uint(h + 700), TOKEN], "create E (open)");
  const eId = (await (await fetch(`${API}/extended/v1/tx/0x${eTx}`)).json()).tx_result.repr.match(/u(\d+)/)[1];

  // job F -- RUNNING (value 1.0, 500-block window, backed + funded)
  const fTx = await call("client", COSIGN_ADDR, "cosign-v2", "create-job",
    [Cl.principal(W.newcomer2.address), Cl.uint(1_000_000), Cl.uint(h + 500), TOKEN], "create F");
  const fId = (await (await fetch(`${API}/extended/v1/tx/0x${fTx}`)).json()).tx_result.repr.match(/u(\d+)/)[1];
  await call("backer", COSIGN_ADDR, "cosign-v2", "co-sign", [Cl.uint(BigInt(fId)), Cl.uint(200_000), TOKEN], "co-sign F");
  const terms = (await ro(COSIGN_ADDR, "cosign-v2", "read-terms", [Cl.uint(BigInt(fId))])).value.value;
  const lockUntil = BigInt(terms["lock-until-block"].value);
  console.log(`F improved terms: unlocks ${lockUntil} vs deadline ${h + 500} (${h + 500 - Number(lockUntil)} blocks earlier)`);
  await call("newcomer2", FV_ADDR, "flowvault-v2", "set-routing-rules",
    [Cl.uint(1_000_000), Cl.uint(lockUntil), Cl.none(), Cl.uint(0)], "F rules");
  await call("newcomer2", FV_ADDR, "flowvault-v2", "deposit", [TOKEN, Cl.uint(1_000_000)], "F deposit");
  await call("client", COSIGN_ADDR, "cosign-v2", "confirm-funding", [Cl.uint(BigInt(fId))], "F confirm-funding");

  console.log(`\nSeeded: job #${eId} OPEN (deadline ${h + 700}), job #${fId} RUNNING (deadline ${h + 500}).`);
}
main().catch((e) => { console.error("FAILED:", e.message ?? e); process.exit(1); });
