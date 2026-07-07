// Resume tail of run-flows.cjs: wait for the deadline, resolve jobs, verify.
// Usage: node scripts/resolve-flows.cjs <deadline> <jobIdA> <jobIdB> <jobIdD>
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
const USDCX_NAME = "usdcx";
const TOKEN = Cl.contractPrincipal(USDCX_ADDR, USDCX_NAME);

const W = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "deployer-secret-parties.json"), "utf8")
);
const explorer = (txid) => `https://explorer.hiro.so/txid/0x${txid}?chain=testnet`;

async function retry(fn, label, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw e;
      console.log(`  ${label}: ${e.message ?? e}; retry ${i}`);
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
}

async function ro(contractAddress, contractName, functionName, functionArgs) {
  return retry(
    () =>
      fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        network: "testnet",
        senderAddress: COSIGN_ADDR,
      }),
    `read ${functionName}`
  );
}

async function height() {
  const r = await ro(FV_ADDR, FV_NAME, "get-current-block-height", []);
  return Number(r.value);
}

async function usdcxBalance(addr) {
  const r = await ro(USDCX_ADDR, USDCX_NAME, "get-balance", [Cl.principal(addr)]);
  return BigInt(r.value.value);
}

async function waitTx(txid, label) {
  for (let i = 0; i < 90; i++) {
    try {
      const j = await (await fetch(`${API}/extended/v1/tx/0x${txid}`)).json();
      if (j.tx_status === "success") return;
      if (String(j.tx_status).startsWith("abort")) {
        throw new Error(`${label} failed: ${j.tx_status} ${j.tx_result?.repr ?? ""}`);
      }
    } catch (e) {
      if (String(e.message).includes("failed:")) throw e;
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error(`${label} not confirmed in time`);
}

async function resolveJob(jobId, label) {
  const tx = await makeContractCall({
    contractAddress: COSIGN_ADDR,
    contractName: COSIGN_NAME,
    functionName: "resolve",
    functionArgs: [Cl.uint(jobId), TOKEN],
    senderKey: W.deployer2.privateKey,
    network: "testnet",
    nonce: await retry(async () => {
      const j = await (await fetch(`${API}/extended/v1/address/${W.deployer2.address}/nonces`)).json();
      return BigInt(j.possible_next_nonce);
    }, "nonce"),
    fee: 50_000n,
    postConditionMode: "allow",
  });
  const r = await broadcastTransaction({ transaction: tx, network: "testnet" });
  if (r.error) throw new Error(`${label}: ${JSON.stringify(r)}`);
  console.log(`  ${label}: ${explorer(r.txid)}`);
  await waitTx(r.txid, label);
  return r.txid;
}

async function main() {
  const [deadline, a, b, d] = process.argv.slice(2).map(Number);
  if (!deadline || !a || !b || !d) throw new Error("usage: resolve-flows.cjs <deadline> <A> <B> <D>");

  for (;;) {
    const h = await height();
    console.log(`block ${h} / waiting for ${deadline}`);
    if (h >= deadline) break;
    await new Promise((r) => setTimeout(r, 30_000));
  }

  const balsBefore = {};
  for (const who of ["client", "newcomer", "newcomer2", "backer"]) {
    balsBefore[who] = await usdcxBalance(W[who].address);
  }

  const out = {};
  out.resolveA = await resolveJob(a, "resolve A (Flow A settles unbacked)");
  out.resolveB = await resolveJob(b, "resolve B (Flow C clean completion)");
  out.resolveD = await resolveJob(d, "resolve D (Flow D ghost restitution)");

  for (const [name, id] of [["A", a], ["B", b], ["D", d]]) {
    const r = await ro(COSIGN_ADDR, COSIGN_NAME, "get-job", [Cl.uint(id)]);
    const t = r.value.value;
    console.log(`job ${name} (#${id}): ${t["status"].value}, disbursed=${t["disbursed"].type === "true"}`);
  }
  for (const who of ["client", "newcomer", "newcomer2", "backer"]) {
    const now = await usdcxBalance(W[who].address);
    console.log(
      `${who}: ${Number(balsBefore[who]) / 1e6} -> ${Number(now) / 1e6} USDCx (delta ${Number(now - balsBefore[who]) / 1e6})`
    );
  }
  const cosignBal = await usdcxBalance(`${COSIGN_ADDR}.${COSIGN_NAME}`);
  console.log(`coordinator raw balance: ${Number(cosignBal) / 1e6} USDCx (must be 0)`);

  fs.writeFileSync(
    path.join(__dirname, "..", "resolve-report.json"),
    JSON.stringify({ resolves: out }, null, 2)
  );
  console.log("Saved resolve-report.json");
}

main().catch((e) => {
  console.error("FAILED:", e.message ?? e);
  process.exit(1);
});
