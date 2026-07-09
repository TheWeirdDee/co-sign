// Co-Sign keeper -- automated resolution watcher.
//
// HONEST FRAMING (mirrors PRD sec.7): Stacks contracts do not self-execute on
// a timer. The OUTCOME of every job is fully determined by chain state -- the
// contract's `resolve` reads FlowVault evidence and the deadline block, and is
// permissionless and idempotent. This process only SUBMITS the transaction
// when the deadline block is reached. No human decision, no discretion.
//
// SECURITY: the keeper key has NO privileged role in the coordinator contract.
// `resolve`, `disburse`, and `confirm-funding` are permissionless and their
// effects are fixed by chain state, so a compromised keeper key can at worst
// pay fees to do the protocol's own housekeeping -- it cannot steal or
// redirect funds. It needs only testnet STX for fees.
//
// What each tick does:
//   1. read current block height (FlowVault's own get-current-block-height)
//   2. sweep all jobs (get-job-count / get-job):
//      - open|backed, deadline reached      -> submit resolve(job-id, token)
//      - settled|ghosted, not disbursed     -> submit disburse(job-id, token)
//        (the overlap-deferral path: payout was blocked by the coordinator
//         vault's shared lock at resolve time; retry until the lock expires)
//      - open|backed, not funded, deadline NOT reached, and the newcomer's
//        vault currently shows a live qualifying lock -> submit
//        confirm-funding(job-id) as a safety net, so completion evidence is
//        snapshotted even if the frontend forgot. The contract re-validates
//        all evidence; the keeper cannot fabricate anything.
//   3. idempotency: the contract rejects repeats (ERR-ALREADY-RESOLVED u108,
//      ERR-ALREADY-DISBURSED u113, ERR-STILL-LOCKED u112). Rejections are
//      logged and the job goes on cooldown -- never a crash, never a hot loop.
//
// Run locally:  npm run keeper   (from keeper/, with .env in place)
// Deploy:       any Node host (Railway etc.) -- `npm start`, env vars below.
//
// Env: KEEPER_PRIVATE_KEY (required, gitignored .env), COSIGN_CONTRACT,
//      STACKS_API, POLL_MS. Sensible testnet defaults for all but the key.

require("dotenv").config();
const {
  makeContractCall,
  broadcastTransaction,
  fetchCallReadOnlyFunction,
  getAddressFromPrivateKey,
  Cl,
} = require("@stacks/transactions");

const API = process.env.STACKS_API ?? "https://api.testnet.hiro.so";
const COSIGN = process.env.COSIGN_CONTRACT ?? "ST31DYZV2SMJHDWQ39T8MWBW8N0AKDR0PVM43D6T2.cosign-v2";
const [COSIGN_ADDR, COSIGN_NAME] = COSIGN.split(".");
const FV_ADDR = "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD";
const FV_NAME = "flowvault-v2";
const USDCX_ADDR = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const TOKEN = Cl.contractPrincipal(USDCX_ADDR, "usdcx");
const POLL_MS = Number(process.env.POLL_MS ?? 45_000);
const FEE = 30_000n;

const KEY = process.env.KEEPER_PRIVATE_KEY;
if (!KEY) {
  console.error("KEEPER_PRIVATE_KEY not set (see keeper/.env.example)");
  process.exit(1);
}
const KEEPER_ADDR = getAddressFromPrivateKey(KEY, "testnet");

const explorer = (txid) => `https://explorer.hiro.so/txid/0x${txid}?chain=testnet`;
const log = (jobId, msg) =>
  console.log(`[${new Date().toISOString()}]${jobId != null ? ` job#${jobId}` : ""} ${msg}`);

// in-memory bookkeeping (stateless-safe: chain state is the source of truth,
// this only prevents duplicate submissions within a session)
const pending = new Map(); // jobId:action -> txid awaiting confirmation
const cooldown = new Map(); // jobId:action -> retry-not-before timestamp

async function ro(contractAddress, contractName, functionName, functionArgs) {
  return fetchCallReadOnlyFunction({
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    network: "testnet",
    senderAddress: KEEPER_ADDR,
  });
}

async function height() {
  return Number((await ro(FV_ADDR, FV_NAME, "get-current-block-height", [])).value);
}

async function jobCount() {
  return Number((await ro(COSIGN_ADDR, COSIGN_NAME, "get-job-count", [])).value);
}

async function getJob(id) {
  const r = await ro(COSIGN_ADDR, COSIGN_NAME, "get-job", [Cl.uint(id)]);
  if (r.type !== "some") return null;
  const t = r.value.value;
  return {
    newcomer: t["newcomer"].value,
    jobValue: BigInt(t["job-value"].value),
    deadline: Number(t["deadline-block"].value),
    backedBlock: Number(t["backed-block"].value),
    status: t["status"].value,
    funded: t["funded"].type === "true",
    disbursed: t["disbursed"].type === "true",
  };
}

// Does the newcomer's vault CURRENTLY hold live evidence that confirm-funding
// would accept? (Same checks the contract makes -- read-only preflight so we
// don't pay fees for guaranteed rejections.)
async function fundingEvidenceLive(job) {
  const locked = (await ro(FV_ADDR, FV_NAME, "has-locked-funds", [Cl.principal(job.newcomer)]))
    .type === "true";
  if (!locked) return false;
  const vs = (await ro(FV_ADDR, FV_NAME, "get-vault-state", [Cl.principal(job.newcomer)])).value;
  const lockUntil = Number(vs["lock-until-block"].value);
  return (
    BigInt(vs["locked-balance"].value) >= job.jobValue &&
    lockUntil <= job.deadline &&
    lockUntil >= job.backedBlock
  );
}

// Disburse preflight: payout can only succeed once the coordinator vault's
// shared lock has expired (get-vault-state reports effective locked balance,
// 0 when expired). Read it instead of paying fees for guaranteed u112 aborts.
async function coordinatorUnlocked() {
  const vs = (await ro(FV_ADDR, FV_NAME, "get-vault-state", [Cl.principal(COSIGN)])).value;
  return BigInt(vs["locked-balance"].value) === 0n;
}

async function submit(jobId, action, functionName, functionArgs, h) {
  const key = `${jobId}:${action}`;
  if (pending.has(key) || (cooldown.get(key) ?? 0) > Date.now()) return;
  try {
    const tx = await makeContractCall({
      contractAddress: COSIGN_ADDR,
      contractName: COSIGN_NAME,
      functionName,
      functionArgs,
      senderKey: KEY,
      network: "testnet",
      fee: FEE,
      postConditionMode: "allow",
    });
    const r = await broadcastTransaction({ transaction: tx, network: "testnet" });
    if (r.error) throw new Error(r.reason ?? r.error);
    pending.set(key, r.txid);
    log(jobId, `${action} submitted at block ${h}: ${explorer(r.txid)}`);
  } catch (e) {
    log(jobId, `${action} broadcast failed (${e.message ?? e}); cooling down 2m`);
    cooldown.set(key, Date.now() + 120_000);
  }
}

async function checkPending() {
  for (const [key, txid] of pending) {
    try {
      const j = await (await fetch(`${API}/extended/v1/tx/0x${txid}`)).json();
      if (j.tx_status === "success") {
        log(key.split(":")[0], `${key.split(":")[1]} CONFIRMED ${explorer(txid)}`);
        pending.delete(key);
      } else if (String(j.tx_status).startsWith("abort") || String(j.tx_status).startsWith("dropped")) {
        // idempotent/already-done rejections land here (u108/u112/u113):
        // log, cool down, move on -- chain state will steer the next sweep.
        log(key.split(":")[0], `${key.split(":")[1]} rejected on-chain (${j.tx_status} ${j.tx_result?.repr ?? ""}); cooling down 2m`);
        pending.delete(key);
        cooldown.set(key, Date.now() + 120_000);
      }
    } catch {
      /* transient API error -- keep waiting */
    }
  }
}

async function tick() {
  const h = await height();
  const n = await jobCount();
  let vaultOpen = null; // lazily checked once per tick
  for (let id = 1; id <= n; id++) {
    const job = await getJob(id);
    if (!job) continue;
    const active = job.status === "open" || job.status === "backed";
    if (active && h >= job.deadline) {
      await submit(id, "resolve", "resolve", [Cl.uint(id), TOKEN], h);
    } else if (active && !job.funded && (await fundingEvidenceLive(job))) {
      await submit(id, "confirm-funding", "confirm-funding", [Cl.uint(id)], h);
    } else if (!active && !job.disbursed) {
      if (vaultOpen === null) vaultOpen = await coordinatorUnlocked();
      if (vaultOpen) {
        await submit(id, "disburse", "disburse", [Cl.uint(id), TOKEN], h);
      } else {
        log(id, "payout deferred -- coordinator vault lock still shared with a later job");
      }
    }
  }
  await checkPending();
  return { h, n };
}

(async () => {
  console.log(`Co-Sign keeper starting
  contract: ${COSIGN}
  keeper:   ${KEEPER_ADDR} (permissionless -- no special contract role)
  poll:     every ${POLL_MS / 1000}s`);
  for (;;) {
    let wait = POLL_MS;
    try {
      const { h, n } = await tick();
      log(null, `tick ok -- block ${h}, ${n} job(s), ${pending.size} pending tx`);
    } catch (e) {
      const msg = String(e.message ?? e);
      // Hiro's 429 body names its own retry window ("try again in N seconds") --
      // honor it instead of immediately retrying into the same still-active
      // per-minute window, which just burns another request on a guaranteed 429.
      const hint = msg.match(/try again in (\d+) second/i);
      if (hint) wait = Math.max(wait, (Number(hint[1]) + 3) * 1000);
      log(null, `tick failed (${msg}); retrying in ${Math.round(wait / 1000)}s`);
    }
    await new Promise((r) => setTimeout(r, wait));
  }
})();
