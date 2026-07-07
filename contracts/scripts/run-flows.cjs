// Executes the four Co-Sign flows end-to-end on Stacks TESTNET with real
// transactions (Phase 2 proof). Prints a tx id + explorer link for every
// write and saves a summary to flows-report.json.
//
//   Flow A  unbacked deposit  (job A, newcomer1, full lock to deadline)
//   Flow B  backed deposit    (job B, newcomer2 + backer stake >= 20%)
//   Flow C  clean resolve     (job B settles: newcomer paid, stake + 2% to backer)
//   Flow D  ghost resolve     (job D, newcomer3 never deposits: escrow + stake to client)
//
// All three jobs share one deadline so the coordinator vault's single lock
// slot never delays disbursement (equal lock-untils don't extend each other).
//
// Usage: node scripts/run-flows.cjs [deadline-offset-blocks]   (default 12)
const fs = require("fs");
const path = require("path");
const {
  makeContractCall,
  broadcastTransaction,
  fetchCallReadOnlyFunction,
  Cl,
  cvToString,
} = require("@stacks/transactions");

const API = "https://api.testnet.hiro.so";
const COSIGN_ADDR = "ST31DYZV2SMJHDWQ39T8MWBW8N0AKDR0PVM43D6T2";
const COSIGN_NAME = "cosign";
const FV_ADDR = "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD";
const FV_NAME = "flowvault-v2";
const USDCX_ADDR = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const USDCX_NAME = "usdcx";
const TOKEN = Cl.contractPrincipal(USDCX_ADDR, USDCX_NAME);

const JOB_VALUE = 1_000_000n; // 1.0 USDCx
const ESCROW = 1_020_000n;
const STAKE = 200_000n; // exactly the 20% floor

const W = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "deployer-secret-parties.json"), "utf8")
);
const explorer = (txid) => `https://explorer.hiro.so/txid/0x${txid}?chain=testnet`;
const report = { flows: {}, txs: [] };

async function nonceOf(address) {
  const j = await (await fetch(`${API}/extended/v1/address/${address}/nonces`)).json();
  return BigInt(j.possible_next_nonce);
}

async function waitTx(txid, label) {
  for (let i = 0; i < 60; i++) {
    const j = await (await fetch(`${API}/extended/v1/tx/0x${txid}`)).json();
    if (j.tx_status === "success") return;
    if (String(j.tx_status).startsWith("abort") || j.tx_status === "dropped_replace_by_fee") {
      throw new Error(`${label} failed: ${j.tx_status} ${j.tx_result?.repr ?? ""}`);
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error(`${label} not confirmed in time`);
}

async function call(who, contractAddress, contractName, functionName, functionArgs, label) {
  const tx = await makeContractCall({
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    senderKey: W[who].privateKey,
    network: "testnet",
    nonce: await nonceOf(W[who].address),
    fee: 50_000n,
    postConditionMode: "allow",
  });
  const r = await broadcastTransaction({ transaction: tx, network: "testnet" });
  if (r.error) throw new Error(`${label} broadcast failed: ${JSON.stringify(r)}`);
  console.log(`  ${label}: ${explorer(r.txid)}`);
  report.txs.push({ label, who, txid: r.txid, link: explorer(r.txid) });
  return r.txid;
}

async function ro(contractAddress, contractName, functionName, functionArgs) {
  return fetchCallReadOnlyFunction({
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    network: "testnet",
    senderAddress: COSIGN_ADDR,
  });
}

async function usdcxBalance(addr) {
  const r = await ro(USDCX_ADDR, USDCX_NAME, "get-balance", [Cl.principal(addr)]);
  return r.value.value; // (ok uint)
}

async function height() {
  const r = await ro(FV_ADDR, FV_NAME, "get-current-block-height", []);
  return Number(r.value);
}

async function waitForHeight(target) {
  for (;;) {
    const h = await height();
    process.stdout.write(`\r  block ${h} / waiting for ${target} `);
    if (h >= target) {
      console.log("");
      return;
    }
    await new Promise((r) => setTimeout(r, 20_000));
  }
}

async function jobStatus(jobId) {
  const r = await ro(COSIGN_ADDR, COSIGN_NAME, "get-job", [Cl.uint(jobId)]);
  const t = r.value.value;
  return { status: t["status"].value, disbursed: t["disbursed"].type === "true" };
}

async function readTermsLockUntil(jobId) {
  const r = await ro(COSIGN_ADDR, COSIGN_NAME, "read-terms", [Cl.uint(jobId)]);
  return BigInt(r.value.value["lock-until-block"].value);
}

async function createJob(newcomerAddr, deadline, label) {
  const txid = await call("client", COSIGN_ADDR, COSIGN_NAME, "create-job",
    [Cl.principal(newcomerAddr), Cl.uint(JOB_VALUE), Cl.uint(deadline), TOKEN], label);
  await waitTx(txid, label);
  const j = await (await fetch(`${API}/extended/v1/tx/0x${txid}`)).json();
  const jobId = BigInt(j.tx_result.repr.replace("(ok u", "").replace(")", ""));
  console.log(`    -> job-id ${jobId}`);
  return { jobId, txid };
}

async function newcomerDeposit(who, jobId, label) {
  const lockUntil = await readTermsLockUntil(jobId);
  console.log(`    terms: lock ${JOB_VALUE} until block ${lockUntil}`);
  const t1 = await call(who, FV_ADDR, FV_NAME, "set-routing-rules",
    [Cl.uint(JOB_VALUE), Cl.uint(lockUntil), Cl.none(), Cl.uint(0)], `${label} set-routing-rules`);
  await waitTx(t1, `${label} rules`);
  const t2 = await call(who, FV_ADDR, FV_NAME, "deposit",
    [TOKEN, Cl.uint(JOB_VALUE)], `${label} deposit`);
  await waitTx(t2, `${label} deposit`);
  const t3 = await call("deployer2", COSIGN_ADDR, COSIGN_NAME, "confirm-funding",
    [Cl.uint(jobId)], `${label} confirm-funding`);
  await waitTx(t3, `${label} confirm-funding`);
  return { rules: t1, deposit: t2, confirm: t3, lockUntil };
}

async function main() {
  const offset = Number(process.argv[2] ?? 12);

  // 0. preflight: usdcx balances; top up parties from the client wallet if short
  const need = { client: 3n * ESCROW, newcomer: JOB_VALUE, newcomer2: JOB_VALUE, backer: 2n * STAKE };
  for (const [who, amt] of Object.entries(need)) {
    const bal = BigInt(await usdcxBalance(W[who].address));
    console.log(`${who} (${W[who].address}): ${Number(bal) / 1e6} USDCx (needs ${Number(amt) / 1e6})`);
    if (bal < amt && who !== "client") {
      const short = amt - bal;
      const t = await call("client", USDCX_ADDR, USDCX_NAME, "transfer",
        [Cl.uint(short), Cl.principal(W.client.address), Cl.principal(W[who].address), Cl.none()],
        `top up ${who} with ${Number(short) / 1e6} USDCx`);
      await waitTx(t, `top up ${who}`);
    } else if (bal < amt) {
      throw new Error(`client needs ${Number(amt) / 1e6} USDCx (+ party top-ups); has ${Number(bal) / 1e6}`);
    }
  }

  const h0 = await height();
  const deadline = h0 + offset;
  console.log(`\nheight ${h0}, shared deadline ${deadline} (~${offset} blocks)\n`);

  // 1. create the three jobs (A: newcomer1, B: newcomer2, D: newcomer3-ghost)
  console.log("Flow A/B/D: client creates jobs (escrow 102% locks in coordinator vault)");
  const A = await createJob(W.newcomer.address, deadline, "create-job A");
  const B = await createJob(W.newcomer2.address, deadline, "create-job B");
  const D = await createJob(W.newcomer3.address, deadline, "create-job D");

  // 2. backer co-signs B and D (stake locks in coordinator vault)
  console.log("Flow B/D: backer co-signs (stake 20% locks in coordinator vault)");
  const coB = await call("backer", COSIGN_ADDR, COSIGN_NAME, "co-sign",
    [Cl.uint(B.jobId), Cl.uint(STAKE), TOKEN], "co-sign B");
  await waitTx(coB, "co-sign B");
  const coD = await call("backer", COSIGN_ADDR, COSIGN_NAME, "co-sign",
    [Cl.uint(D.jobId), Cl.uint(STAKE), TOKEN], "co-sign D");
  await waitTx(coD, "co-sign D");

  // 3. newcomer deposits: A unbacked (full lock), B backed (improved lock)
  console.log("Flow A: unbacked newcomer deposit (full lock to deadline)");
  const depA = await newcomerDeposit("newcomer", A.jobId, "A");
  console.log("Flow B: backed newcomer deposit (shortened lock, same amount)");
  const depB = await newcomerDeposit("newcomer2", B.jobId, "B");
  if (!(depB.lockUntil < BigInt(deadline)) || depA.lockUntil !== BigInt(deadline)) {
    throw new Error("terms sanity check failed: expected improved lock for B, full lock for A");
  }
  console.log(`  terms improved: A locks until ${depA.lockUntil} (deadline), B until ${depB.lockUntil}`);

  // 4. wait for the deadline block
  console.log("\nWaiting for deadline block...");
  await waitForHeight(deadline);

  // 5. resolve all three (permissionless -- deployer2 acts as proto-keeper)
  const balsBefore = {};
  for (const who of ["client", "newcomer", "newcomer2", "backer"]) {
    balsBefore[who] = BigInt(await usdcxBalance(W[who].address));
  }
  console.log("Resolving (outcome fixed by chain state; caller is permissionless)");
  const rA = await call("deployer2", COSIGN_ADDR, COSIGN_NAME, "resolve", [Cl.uint(A.jobId), TOKEN], "resolve A");
  await waitTx(rA, "resolve A");
  const rB = await call("deployer2", COSIGN_ADDR, COSIGN_NAME, "resolve", [Cl.uint(B.jobId), TOKEN], "resolve B (Flow C)");
  await waitTx(rB, "resolve B");
  const rD = await call("deployer2", COSIGN_ADDR, COSIGN_NAME, "resolve", [Cl.uint(D.jobId), TOKEN], "resolve D (Flow D)");
  await waitTx(rD, "resolve D");

  // 6. verify outcomes
  for (const [name, job] of [["A", A], ["B", B], ["D", D]]) {
    const s = await jobStatus(job.jobId);
    console.log(`job ${name} (#${job.jobId}): ${s.status}, disbursed=${s.disbursed}`);
  }
  for (const who of ["client", "newcomer", "newcomer2", "backer"]) {
    const now = BigInt(await usdcxBalance(W[who].address));
    console.log(`${who}: ${Number(balsBefore[who]) / 1e6} -> ${Number(now) / 1e6} USDCx (delta ${Number(now - balsBefore[who]) / 1e6})`);
  }

  report.flows = {
    A: { job: String(A.jobId), headline: explorer(depA.deposit), resolve: explorer(rA) },
    B: { job: String(B.jobId), headline: explorer(coB), improvedDeposit: explorer(depB.deposit) },
    C: { job: String(B.jobId), headline: explorer(rB) },
    D: { job: String(D.jobId), headline: explorer(rD) },
  };
  fs.writeFileSync(path.join(__dirname, "..", "flows-report.json"), JSON.stringify(report, null, 2));
  console.log("\nSaved flows-report.json");
}

main().catch((e) => { console.error("\nFAILED:", e.message || e); process.exit(1); });
