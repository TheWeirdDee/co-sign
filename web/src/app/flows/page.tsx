"use client";

// Phase 2 crude flows page: buttons that drive the four flows through the
// connected wallet (switch accounts in the wallet to play each role). Every
// write surfaces a tx id + explorer link. Real UI arrives in Phase 4.

import { useCallback, useEffect, useState } from "react";
import { connect, getLocalStorage, isConnected } from "@stacks/connect";
import {
  flowVaultRead,
  flowVaultWallet,
  isStxAddress,
  READ_CONTEXT_ADDRESS,
} from "@/lib/flowvault";
import {
  COSIGN_PRINCIPAL,
  coSign,
  confirmFunding,
  createJob,
  disburse,
  explorerTxUrl,
  getJob,
  readTerms,
  requiredEscrow,
  resolve,
  stakeFloor,
  type Job,
} from "@/lib/cosign";

interface LogEntry {
  label: string;
  txid?: string;
  note?: string;
}

import { parseTokenAmount as micro } from "@/lib/flowvault";

export default function Flows() {
  const [address, setAddress] = useState<string | null>(null);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // form state
  const [newcomer, setNewcomer] = useState("");
  const [jobValue, setJobValue] = useState("1.0");
  const [deadlineOffset, setDeadlineOffset] = useState("30");
  const [jobIdStr, setJobIdStr] = useState("1");
  const [stake, setStake] = useState("0.2");

  // live job panel
  const [job, setJob] = useState<Job | null>(null);
  const [newcomerLockUntil, setNewcomerLockUntil] = useState<number | null>(null);
  const [newcomerLocked, setNewcomerLocked] = useState<boolean | null>(null);

  const jobId = BigInt(jobIdStr || "0");

  const push = (e: LogEntry) => setLog((l) => [e, ...l]);

  const refresh = useCallback(async () => {
    try {
      const fv = flowVaultRead();
      setBlockHeight(await fv.getCurrentBlockHeight(address ?? READ_CONTEXT_ADDRESS));
      if (jobId > 0n) {
        const j = await getJob(jobId);
        setJob(j);
        if (j) {
          const vs = await fv.getVaultState(j.newcomer);
          setNewcomerLockUntil(vs.lockUntilBlock);
          setNewcomerLocked(await fv.hasLockedFunds(j.newcomer));
        }
      }
    } catch (e) {
      push({ label: "refresh failed", note: String(e) });
    }
  }, [address, jobId]);

  useEffect(() => {
    if (isConnected()) {
      const stx = getLocalStorage()?.addresses?.stx?.[0]?.address;
      if (stx && isStxAddress(stx)) setAddress(stx);
    }
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const run = (label: string, fn: () => Promise<{ txid?: string; txId?: string } | void>) =>
    async () => {
      setBusy(label);
      try {
        const res = await fn();
        const txid = (res as any)?.txid ?? (res as any)?.txId;
        push({ label, txid, note: txid ? undefined : "submitted" });
      } catch (e) {
        push({ label: `${label} FAILED`, note: e instanceof Error ? e.message : String(e) });
      } finally {
        setBusy(null);
        refresh();
      }
    };

  const handleConnect = async () => {
    await connect();
    const stx = getLocalStorage()?.addresses?.stx?.[0]?.address;
    if (stx && isStxAddress(stx)) setAddress(stx);
  };

  const doCreate = run("create-job (escrow 102% locks)", async () => {
    if (!blockHeight) throw new Error("no block height yet");
    return createJob(newcomer, micro(jobValue), blockHeight + parseInt(deadlineOffset, 10));
  });

  const doCoSign = run("co-sign (stake locks in coordinator vault)", () =>
    coSign(jobId, micro(stake))
  );

  // Newcomer deposit per read-terms: set-routing-rules + deposit in the
  // newcomer's OWN vault, then the permissionless funding snapshot.
  const doDeposit = run("newcomer deposit (terms from read-terms)", async () => {
    if (!address) throw new Error("connect the newcomer wallet first");
    const terms = await readTerms(jobId);
    const fv = flowVaultWallet(address);
    const r1: any = await fv.setRoutingRules({
      lockAmount: terms.lockAmount,
      lockUntilBlock: terms.lockUntilBlock,
      splitAddress: null,
      splitAmount: 0n,
    });
    push({ label: "set-routing-rules", txid: r1?.txid ?? r1?.txId });
    const r2: any = await fv.deposit(terms.lockAmount);
    push({ label: "deposit (lock executes)", txid: r2?.txid ?? r2?.txId });
    return confirmFunding(jobId);
  });

  const doResolve = run("resolve (outcome fixed by chain state)", () => resolve(jobId));
  const doDisburse = run("disburse (retry after shared lock expiry)", () => disburse(jobId));

  const jv = micro(jobValue || "0");

  return (
    <main className="min-h-screen bg-[#0E1116] text-[#E8E2D2] font-mono p-6 text-xs">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between border border-[#2A2F37] bg-[#161B22] p-4">
          <div>
            <h1 className="tracking-widest">CO·SIGN — PHASE 2 FLOWS (crude)</h1>
            <p className="text-[#9A968B] mt-1 break-all">coordinator: {COSIGN_PRINCIPAL}</p>
          </div>
          <div className="text-right">
            {address ? (
              <span className="break-all">{address.slice(0, 8)}…{address.slice(-4)}</span>
            ) : (
              <button onClick={handleConnect} className="border border-[#2A2F37] px-3 py-1 hover:border-[#9A968B]">
                Connect wallet
              </button>
            )}
            <p className="text-[#A8823D] mt-1">
              block {blockHeight?.toLocaleString() ?? "…"}
            </p>
          </div>
        </header>

        <section className="border border-[#2A2F37] bg-[#161B22] p-4 space-y-3">
          <h2 className="text-[#9A968B]">CLIENT — open a job</h2>
          <div className="flex flex-wrap gap-2">
            <input value={newcomer} onChange={(e) => setNewcomer(e.target.value)}
              placeholder="newcomer ST address" className="flex-1 min-w-60 bg-[#0E1116] border border-[#2A2F37] px-2 py-1" />
            <input value={jobValue} onChange={(e) => setJobValue(e.target.value)}
              className="w-24 bg-[#0E1116] border border-[#2A2F37] px-2 py-1" title="job value (USDCx)" />
            <input value={deadlineOffset} onChange={(e) => setDeadlineOffset(e.target.value)}
              className="w-20 bg-[#0E1116] border border-[#2A2F37] px-2 py-1" title="deadline offset (blocks)" />
            <button disabled={!!busy} onClick={doCreate}
              className="border border-[#2A2F37] px-3 py-1 hover:border-[#9A968B] disabled:opacity-40">
              create-job (escrows {(Number(requiredEscrow(jv)) / 1e6).toFixed(2)})
            </button>
          </div>
        </section>

        <section className="border border-[#2A2F37] bg-[#161B22] p-4 space-y-3">
          <h2 className="text-[#9A968B]">JOB — act on it (switch wallet account per role)</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <label>job-id</label>
            <input value={jobIdStr} onChange={(e) => setJobIdStr(e.target.value)}
              className="w-16 bg-[#0E1116] border border-[#2A2F37] px-2 py-1" />
            <input value={stake} onChange={(e) => setStake(e.target.value)}
              className="w-24 bg-[#0E1116] border border-[#2A2F37] px-2 py-1" title="stake (USDCx)" />
            <button disabled={!!busy} onClick={doCoSign}
              className="border border-[#2A2F37] px-3 py-1 hover:border-[#9A968B] disabled:opacity-40">
              co-sign (floor {(Number(stakeFloor(job?.jobValue ?? jv)) / 1e6).toFixed(2)})
            </button>
            <button disabled={!!busy} onClick={doDeposit}
              className="border border-[#2A2F37] px-3 py-1 hover:border-[#9A968B] disabled:opacity-40">
              newcomer deposit
            </button>
            <button disabled={!!busy} onClick={doResolve}
              className="border border-[#2A2F37] px-3 py-1 hover:border-[#9A968B] disabled:opacity-40">
              resolve
            </button>
            <button disabled={!!busy} onClick={doDisburse}
              className="border border-[#2A2F37] px-3 py-1 hover:border-[#9A968B] disabled:opacity-40">
              disburse
            </button>
          </div>

          {job && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-[#2A2F37]">
              <dt className="text-[#9A968B]">status</dt><dd>{job.status}{job.disbursed ? " · disbursed" : ""}{job.funded ? " · funded" : ""}</dd>
              <dt className="text-[#9A968B]">job-value / escrow</dt>
              <dd className="text-[#A8823D]">{Number(job.jobValue) / 1e6} / {Number(job.escrowAmount) / 1e6} USDCx</dd>
              <dt className="text-[#9A968B]">stake</dt>
              <dd className="text-[#A8823D]">{Number(job.stakeAmount) / 1e6} USDCx {job.backer ? `by ${job.backer.slice(0, 8)}…` : "(none)"}</dd>
              <dt className="text-[#9A968B]">deadline-block</dt><dd>{job.deadlineBlock.toLocaleString()}</dd>
              {/* the three FlowVault reads — the demo's proof */}
              <dt className="text-[#9A968B]">getCurrentBlockHeight</dt><dd>{blockHeight?.toLocaleString()}</dd>
              <dt className="text-[#9A968B]">newcomer lockUntilBlock</dt><dd>{newcomerLockUntil?.toLocaleString() ?? "—"}</dd>
              <dt className="text-[#9A968B]">newcomer hasLockedFunds</dt><dd>{newcomerLocked === null ? "—" : String(newcomerLocked)}</dd>
            </dl>
          )}
        </section>

        <section className="border border-[#2A2F37] bg-[#161B22] p-4">
          <h2 className="text-[#9A968B] mb-2">TX LOG {busy && <span className="text-[#A8823D]">· {busy}…</span>}</h2>
          <ul className="space-y-1">
            {log.map((e, i) => (
              <li key={i} className="break-all">
                {e.label}{" "}
                {e.txid && (
                  <a href={explorerTxUrl(e.txid)} target="_blank" rel="noreferrer"
                    className="text-[#A8823D] underline">
                    {e.txid.slice(0, 10)}… ↗
                  </a>
                )}
                {e.note && <span className="text-[#8B2635]"> {e.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
