import { request } from "@stacks/connect";
import {
  Cl,
  fetchCallReadOnlyFunction,
  type ClarityValue,
} from "@stacks/transactions";
import { NETWORK, TOKEN_PRINCIPAL } from "./flowvault";

// Coordinator contract calls — wallet mode only (the connected browser wallet
// signs every write; no sender keys in the frontend).

// The env key is versioned (…_V2) deliberately: a stale NEXT_PUBLIC_COSIGN_CONTRACT
// left in a deployment dashboard must NOT silently point the app at the old contract.
const COSIGN_FALLBACK = "ST31DYZV2SMJHDWQ39T8MWBW8N0AKDR0PVM43D6T2.cosign-v2";
export const COSIGN_PRINCIPAL =
  process.env.NEXT_PUBLIC_COSIGN_CONTRACT_V2 || COSIGN_FALLBACK;
const [cosignAddress, cosignName] = COSIGN_PRINCIPAL.split(".");
const [tokenAddress, tokenName] = TOKEN_PRINCIPAL.split(".");
const tokenCV = () => Cl.contractPrincipal(tokenAddress, tokenName);

export function explorerTxUrl(txid: string): string {
  const id = txid.startsWith("0x") ? txid : `0x${txid}`;
  const chain = NETWORK === "mainnet" ? "mainnet" : "testnet";
  return `https://explorer.hiro.so/txid/${id}?chain=${chain}`;
}

const chain = () => (NETWORK === "mainnet" ? "mainnet" : "testnet");

/** Explorer page for any principal (wallet address). */
export function explorerAddressUrl(principal: string): string {
  return `https://explorer.hiro.so/address/${principal}?chain=${chain()}`;
}

/** Explorer's transaction list for the coordinator contract — every job tx is here. */
export function explorerContractUrl(): string {
  return `https://explorer.hiro.so/txid/${COSIGN_PRINCIPAL}?chain=${chain()}&tab=transactions`;
}

const API_BASE = `https://api.${chain()}.hiro.so`;

// The definitive proof for a job, in order of preference: its own resolution
// beats its own funding beats its own opening. No database — this is a live
// read of the coordinator's real transaction history, the same data the
// explorer itself shows, just pre-filtered to the one job that matters here.
const PROOF_PRIORITY = ["resolve", "disburse", "confirm-funding", "co-sign", "create-job"];

/**
 * Find the single most relevant on-chain transaction for a given job, so
 * "verify on-chain" can jump straight to it instead of a 68-row list.
 * Returns null if nothing is found (falls back to explorerContractUrl).
 */
export async function findJobTxid(jobId: bigint): Promise<string | null> {
  try {
    const res = await fetch(
      `${API_BASE}/extended/v1/address/${COSIGN_PRINCIPAL}/transactions?limit=50`
    );
    const j = await res.json();
    const results: any[] = j.results ?? [];
    const wantU = `u${jobId}`;
    const candidates = results.filter((r) => {
      if (r.tx_type !== "contract_call") return false;
      const fn = r.contract_call?.function_name;
      if (fn === "create-job") {
        return r.tx_result?.repr === `(ok ${wantU})`;
      }
      const firstArg = r.contract_call?.function_args?.[0]?.repr;
      return firstArg === wantU;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const pa = PROOF_PRIORITY.indexOf(a.contract_call?.function_name);
      const pb = PROOF_PRIORITY.indexOf(b.contract_call?.function_name);
      if (pa !== pb) return pa - pb;
      return a.tx_status === "success" ? -1 : b.tx_status === "success" ? 1 : 0;
    });
    return candidates[0].tx_id as string;
  } catch {
    return null;
  }
}

async function walletCall(functionName: string, functionArgs: ClarityValue[]) {
  const res = await request("stx_callContract", {
    contract: COSIGN_PRINCIPAL as `${string}.${string}`,
    functionName,
    functionArgs,
    network: NETWORK,
    postConditionMode: "allow",
  });
  return res as { txid?: string; txId?: string };
}

export async function createJob(
  newcomer: string,
  jobValueMicro: bigint,
  deadlineBlock: number
) {
  return walletCall("create-job", [
    Cl.principal(newcomer),
    Cl.uint(jobValueMicro),
    Cl.uint(deadlineBlock),
    tokenCV(),
  ]);
}

export async function coSign(jobId: bigint, stakeMicro: bigint) {
  return walletCall("co-sign", [Cl.uint(jobId), Cl.uint(stakeMicro), tokenCV()]);
}

export async function confirmFunding(jobId: bigint) {
  return walletCall("confirm-funding", [Cl.uint(jobId)]);
}

export async function resolve(jobId: bigint) {
  return walletCall("resolve", [Cl.uint(jobId), tokenCV()]);
}

export async function disburse(jobId: bigint) {
  return walletCall("disburse", [Cl.uint(jobId), tokenCV()]);
}

// A single rate-limited read used to silently kill the WHOLE board load: one
// 429 anywhere in a batch rejected that batch's Promise.all, the caller's
// catch swallowed it, and jobs stayed null until the next 60s poll -- "stuck
// on Reading the chain..." for up to a minute over one transient hiccup.
// Retry a couple of times with a short backoff before actually giving up.
async function readOnly(
  functionName: string,
  functionArgs: ClarityValue[]
): Promise<ReturnType<typeof fetchCallReadOnlyFunction>> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchCallReadOnlyFunction({
        contractAddress: cosignAddress,
        contractName: cosignName,
        functionName,
        functionArgs,
        network: NETWORK,
        senderAddress: cosignAddress,
      });
    } catch (e) {
      if (attempt >= 2) throw e;
      await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
    }
  }
}

export interface Job {
  client: string;
  newcomer: string;
  backer: string | null;
  jobValue: bigint;
  stakeAmount: bigint;
  escrowAmount: bigint;
  deadlineBlock: number;
  backedBlock: number;
  status: string;
  funded: boolean;
  disbursed: boolean;
}

export async function getJob(jobId: bigint): Promise<Job | null> {
  const res: any = await readOnly("get-job", [Cl.uint(jobId)]);
  if (res.type !== "some") return null;
  const t = res.value.value;
  return {
    client: t["client"].value,
    newcomer: t["newcomer"].value,
    backer: t["backer"].type === "some" ? t["backer"].value.value : null,
    jobValue: BigInt(t["job-value"].value),
    stakeAmount: BigInt(t["stake-amount"].value),
    escrowAmount: BigInt(t["escrow-amount"].value),
    deadlineBlock: Number(t["deadline-block"].value),
    backedBlock: Number(t["backed-block"].value),
    status: t["status"].value,
    funded: t["funded"].type === "true",
    disbursed: t["disbursed"].type === "true",
  };
}

export interface Terms {
  lockAmount: bigint;
  lockUntilBlock: number;
}

// The FlowVault routing params the newcomer should submit for their deposit.
export async function readTerms(jobId: bigint): Promise<Terms> {
  const res: any = await readOnly("read-terms", [Cl.uint(jobId)]);
  const t = res.value.value;
  return {
    lockAmount: BigInt(t["lock-amount"].value),
    lockUntilBlock: Number(t["lock-until-block"].value),
  };
}

export async function getJobCount(): Promise<bigint> {
  const res: any = await readOnly("get-job-count", []);
  return BigInt(res.value);
}

export interface BoardJob extends Job {
  id: bigint;
}

// Resolved-and-disbursed jobs are immutable on-chain — cache them for the
// session so the board's poll never re-reads them. Hiro's free-tier rate
// limits are tight; a burst of parallel get-job calls surfaces as CORS errors.
const settledCache = new Map<string, BoardJob>();

/** Newest-first list of jobs for the board (chunked + cached, rate-limit safe). */
export async function listJobs(limit = 30): Promise<BoardJob[]> {
  const n = await getJobCount();
  const ids: bigint[] = [];
  for (let id = n; id >= 1n && ids.length < limit; id--) ids.push(id);
  const out: BoardJob[] = [];
  const CHUNK = 4;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const jobs = await Promise.all(
      ids.slice(i, i + CHUNK).map(async (id) => {
        const hit = settledCache.get(String(id));
        if (hit) return hit;
        const j = await getJob(id);
        if (!j) return null;
        const bj = { ...j, id };
        if ((j.status === "settled" || j.status === "ghosted") && j.disbursed) {
          settledCache.set(String(id), bj);
        }
        return bj;
      })
    );
    for (const j of jobs) if (j) out.push(j);
    if (i + CHUNK < ids.length) await new Promise((r) => setTimeout(r, 400));
  }
  return out;
}

export async function getStanding(who: string): Promise<bigint> {
  const res: any = await readOnly("get-standing", [Cl.principal(who)]);
  return BigInt(res.value["clean-completions"].value);
}

// Instrument reference: a deed-style serial derived deterministically from the
// contract principal + on-chain job id (FNV-1a → unambiguous letters). Purely
// presentational — the uint id stays canonical and auditable on the explorer.
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ";
export function jobRef(id: bigint): string {
  const s = `${COSIGN_PRINCIPAL}#${id}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let tag = "";
  for (let i = 0; i < 4; i++) {
    tag += REF_ALPHABET[h % REF_ALPHABET.length];
    h = Math.floor(h / REF_ALPHABET.length);
  }
  return `CS-${String(id).padStart(4, "0")}-${tag}`;
}

export function requiredEscrow(jobValueMicro: bigint): bigint {
  return (jobValueMicro * 102n) / 100n;
}

export function stakeFloor(jobValueMicro: bigint): bigint {
  return (jobValueMicro * 20n) / 100n;
}

// The coordinator's own abort codes (cosign.clar) in plain words — a raw
// on-chain rejection like "(err u104)" means nothing to someone who isn't
// reading the contract source.
const COSIGN_ERRORS: Record<string, string> = {
  "100": "That job doesn't exist on-chain (wrong id, or it hasn't confirmed yet).",
  "101": "The job value must be a positive amount.",
  "102": "The deadline must be a block in the future.",
  "103": "This job isn't in the right state for that action anymore — reload the page.",
  "104": "Your stake is below the 20% floor of the job's value — raise it and try again.",
  "105": "You can't take this role on a job where you're already the client or the worker.",
  "107": "The deadline block hasn't been reached yet — resolution can't be submitted early.",
  "108": "This job was already resolved — settlement is final and can't run twice.",
  "109": "The worker hasn't proven delivery yet, or the evidence doesn't match this job's window.",
  "110": "The funding window for this job has already closed.",
  "111": "Wrong token contract — this coordinator only moves USDCx.",
  "112": "Payout is deferred: this coordinator's vault is still locked by a later, overlapping job. It clears automatically — try \"Release payout\" again once that job's lock expires.",
  "113": "This job's payout was already released.",
  "114": "This job hasn't been resolved yet, so there's nothing to disburse.",
};

/** Turn a raw Clarity abort repr like "(err u104)" into plain English. */
export function cosignErrorMessage(repr: string | undefined | null): string {
  const code = String(repr ?? "").match(/u(\d+)/)?.[1];
  if (code && COSIGN_ERRORS[code]) return COSIGN_ERRORS[code];
  return `transaction rejected on-chain${repr ? `: ${repr}` : ""}`;
}
