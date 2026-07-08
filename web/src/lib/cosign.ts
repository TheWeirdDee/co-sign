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

/** Explorer page for the coordinator contract — every job tx is listed there. */
export function explorerContractUrl(): string {
  return `https://explorer.hiro.so/txid/${COSIGN_PRINCIPAL}?chain=${chain()}`;
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

async function readOnly(functionName: string, functionArgs: ClarityValue[]) {
  return fetchCallReadOnlyFunction({
    contractAddress: cosignAddress,
    contractName: cosignName,
    functionName,
    functionArgs,
    network: NETWORK,
    senderAddress: cosignAddress,
  });
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
