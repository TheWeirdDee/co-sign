"use client";

// The full live instrument for ONE real on-chain job. Used expanded-in-place
// over the board, and by the /job/[id] deep link. Everything rendered here is
// read from the chain; the three FlowVault witnesses are polled live.
//
// Color rule (correction prompt): money and its outcome only. Running/open
// state is bone + brass. Green appears only once a job is SETTLED, seal-red
// only once it is GHOSTED. Stake math (the 20% floor) appears only in the
// backer's offer block on an OPEN job, next to the visible pay.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { short, useWallet } from "@/hooks/useWallet";
import {
  flowVaultRead,
  flowVaultWallet,
  friendlyError,
  parseTokenAmount,
  READ_CONTEXT_ADDRESS,
} from "@/lib/flowvault";
import {
  coSign,
  confirmFunding,
  COSIGN_PRINCIPAL,
  disburse,
  explorerAddressUrl,
  explorerContractUrl,
  explorerTxUrl,
  getJob,
  jobRef,
  readTerms,
  resolve,
  stakeFloor,
  type Job,
  type Terms,
} from "@/lib/cosign";

interface Witnesses {
  height: number;
  lockUntil: number;
  hasLocked: boolean;
}

interface Resolution {
  newcomerAmount: bigint;
  backerAmount: bigint;
  clientAmount: bigint;
}

interface LogEntry {
  label: string;
  txid?: string;
  err?: string;
}

export const usd = (micro: bigint) =>
  (Number(micro) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });

async function fetchResolution(jobId: bigint): Promise<Resolution | null> {
  try {
    const { fetchCallReadOnlyFunction, Cl } = await import("@stacks/transactions");
    const [addr, name] = COSIGN_PRINCIPAL.split(".");
    const r: any = await fetchCallReadOnlyFunction({
      contractAddress: addr,
      contractName: name,
      functionName: "read-resolution",
      functionArgs: [Cl.uint(jobId)],
      network: "testnet",
      senderAddress: addr,
    });
    if (r.type !== "ok") return null;
    const t = r.value.value;
    return {
      newcomerAmount: BigInt(t["newcomer-amount"].value),
      backerAmount: BigInt(t["backer-amount"].value),
      clientAmount: BigInt(t["client-amount"].value),
    };
  } catch {
    return null;
  }
}

export default function JobInstrument({ jobId }: { jobId: bigint }) {
  const { address, connect } = useWallet();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [terms, setTerms] = useState<Terms | null>(null);
  const [w, setW] = useState<Witnesses | null>(null);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [stake, setStake] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const stakeTouched = useRef(false);

  const push = (e: LogEntry) => setLog((l) => [e, ...l]);

  const refresh = useCallback(async () => {
    if (jobId <= 0n) return;
    try {
      const j = await getJob(jobId);
      setJob(j);
      if (!j) return;
      const fv = flowVaultRead();
      const [height, vs, hasLocked] = await Promise.all([
        fv.getCurrentBlockHeight(address ?? READ_CONTEXT_ADDRESS),
        fv.getVaultState(j.newcomer),
        fv.hasLockedFunds(j.newcomer),
      ]);
      setW({ height, lockUntil: vs.lockUntilBlock, hasLocked });
      if (j.status === "open" || j.status === "backed") {
        setTerms(await readTerms(jobId));
      } else {
        setResolution(await fetchResolution(jobId));
      }
      if (!stakeTouched.current) {
        setStake((Number(stakeFloor(j.jobValue)) / 1e6).toString());
      }
    } catch {
      /* transient read failure — next poll wins */
    }
  }, [jobId, address]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const [copied, setCopied] = useState(false);
  const shareJob = async () => {
    const url = `${window.location.origin}/job/${jobId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this job's link:", url);
    }
  };

  const act = (label: string, fn: () => Promise<unknown>) => async () => {
    if (!address) return void connect();
    setBusy(label);
    try {
      const res: any = await fn();
      const txid = (res?.txid ?? res?.txId ?? "").replace(/^0x/, "");
      push({ label, txid: txid || undefined });
    } catch (e) {
      push({ label, err: friendlyError(e) });
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const doCoSign = act("co-sign", async () => coSign(jobId, parseTokenAmount(stake || "0")));

  const doDeposit = act("deposit & lock", async () => {
    if (!job || !terms) throw new Error("terms not loaded yet");
    const fv = flowVaultWallet(address!);
    const r1: any = await fv.setRoutingRules({
      lockAmount: terms.lockAmount,
      lockUntilBlock: terms.lockUntilBlock,
      splitAddress: null,
      splitAmount: 0n,
    });
    push({ label: "set-routing-rules", txid: (r1?.txid ?? r1?.txId ?? "").replace(/^0x/, "") });
    const r2: any = await fv.deposit(terms.lockAmount);
    push({ label: "deposit (lock executes)", txid: (r2?.txid ?? r2?.txId ?? "").replace(/^0x/, "") });
    return confirmFunding(jobId);
  });

  const doResolve = act("resolve", () => resolve(jobId));
  const doDisburse = act("release payout", () => disburse(jobId));

  if (jobId <= 0n || job === null) {
    return (
      <div className="stage">
        <div className="stage-head">
          <span className="stage-title">Instrument</span>
        </div>
        <div className="stage-body">
          <p style={{ color: "var(--bone-dim)", fontSize: 14 }}>
            This instrument does not exist on the coordinator contract (no job #
            {String(jobId)} on-chain).
          </p>
        </div>
      </div>
    );
  }

  const loading = job === undefined;
  const active = job?.status === "open" || job?.status === "backed";
  const settled = job?.status === "settled";
  const ghosted = job?.status === "ghosted";
  const deadlineReached = !!(job && w && w.height >= job.deadlineBlock);
  const improved = !!(job && terms && terms.lockUntilBlock < job.deadlineBlock);
  const reward = job ? (job.jobValue * 2n) / 100n : 0n;
  const isClient = !!(address && job && address === job.client);
  const isNewcomer = !!(address && job && address === job.newcomer);
  const canCoSign = !!(job && job.status === "open" && !deadlineReached && !isClient && !isNewcomer);
  const canDeposit = !!(job && active && isNewcomer && !job.funded && !deadlineReached);

  // color discipline: outcome colors only at end of life
  const dotClass = ghosted
    ? "status-dot loss"
    : settled
      ? "status-dot win"
      : job?.status === "backed"
        ? "status-dot live"
        : "status-dot";
  const beamStroke = ghosted ? "#8B2635" : settled || job?.status === "backed" ? "#A8823D" : "#2A2F37";
  const beamLabel = loading
    ? "reading the chain…"
    : ghosted
      ? "ghosted · restitution"
      : settled
        ? "settled · clean"
        : job?.status === "backed"
          ? deadlineReached
            ? "deadline reached · resolving"
            : "running to deadline"
          : "awaiting a co-signer";

  const statusHtml = () => {
    if (loading || !job) return <>Reading the instrument from the chain…</>;
    if (ghosted)
      return (
        <>
          Deadline passed with no completed cycle. The{" "}
          <span className="oops">◈{usd(job.stakeAmount)} stake</span> and the escrow route{" "}
          <span className="oops">to the client</span> — restitution,{" "}
          {job.disbursed ? "paid" : "releasing"}.
          {resolution && (
            <>
              {" "}
              Client receives <span className="oops">◈{usd(resolution.clientAmount)}</span>.
            </>
          )}
        </>
      );
    if (settled)
      return (
        <>
          Cycle complete. Newcomer paid{" "}
          <span className="m">◈{usd(resolution?.newcomerAmount ?? job.jobValue)}</span>
          {job.backer && (
            <>
              ; stake returned to backer <span className="m">+ ◈{usd(reward)} reward</span>
            </>
          )}
          . {job.disbursed ? "Both gain standing." : "Payout releasing (shared vault lock)…"}
        </>
      );
    if (job.status === "backed")
      return deadlineReached ? (
        <>
          Deadline block reached — the keeper submits the resolution; the outcome is already
          fixed by chain state.
        </>
      ) : (
        <>
          Backer stakes <span className="m">◈{usd(job.stakeAmount)} USDCx</span> on this
          newcomer.
          {job.funded && (
            <>
              {" "}
              Newcomer&apos;s deposit is locked; the cycle completes
              {improved ? " early" : ""} at block{" "}
              <span className="m">{terms?.lockUntilBlock.toLocaleString()}</span>.
            </>
          )}
        </>
      );
    return <>Open. The newcomer&apos;s pay is fully locked — no one has staked on them yet.</>;
  };

  return (
    <>
      <div className="stage">
        <div className="stage-head">
          <span className="stage-title" title={`job #${String(jobId)} on-chain`}>
            Live instrument · {jobRef(jobId)}
          </span>
          <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="blockclock">
              block <b>{w ? w.height.toLocaleString() : "…"}</b> /{" "}
              {job ? job.deadlineBlock.toLocaleString() : "…"}
            </span>
            <button className="share" onClick={shareJob} title="Copy a shareable link to this job">
              {copied ? "copied ✓" : "share"}
            </button>
          </span>
        </div>
        <div className="stage-body">
          <div className="parties">
            <div className={`card${job?.backer ? " active" : ""}`}>
              <div className="card-role">Backer {job?.backer ? "· staked" : "· open seat"}</div>
              <div className="card-addr">
                {job?.backer ? (
                  <a
                    href={explorerAddressUrl(job.backer)}
                    target="_blank"
                    rel="noreferrer"
                    title="View this address on the explorer"
                  >
                    {short(job.backer)} ↗
                  </a>
                ) : (
                  "— no co-signer yet —"
                )}
              </div>
              <div className="card-fig">
                <span className="g">◈</span>
                {job ? usd(job.stakeAmount) : "…"} USDCx
              </div>
              <div className="card-sub">
                {job?.backer
                  ? active
                    ? "staked · at risk until deadline"
                    : settled
                      ? "made whole + 2% reward"
                      : "slashed · paid the client"
                  : "has not co-signed yet"}
              </div>
            </div>
            <div className={`card${job?.funded ? " active" : ""}`}>
              <div className="card-role">
                Newcomer{" "}
                {settled
                  ? "· delivered"
                  : ghosted
                    ? "· ghosted"
                    : job?.funded
                      ? "· cycle live"
                      : "· no history"}
              </div>
              <div className="card-addr">
                {job ? (
                  <a
                    href={explorerAddressUrl(job.newcomer)}
                    target="_blank"
                    rel="noreferrer"
                    title="View this address on the explorer"
                  >
                    {short(job.newcomer)} ↗
                  </a>
                ) : (
                  "…"
                )}
              </div>
              <div className="card-terms">
                payout unlocks:{" "}
                <span className="t">
                  {active && terms
                    ? improved
                      ? `faster · block ${terms.lockUntilBlock.toLocaleString()}`
                      : `full lock · block ${terms.lockUntilBlock.toLocaleString()}`
                    : settled
                      ? "paid"
                      : ghosted
                        ? "never funded"
                        : "…"}
                </span>
              </div>
              <div className="card-sub">
                job value{" "}
                <span style={{ fontFamily: "var(--mono)", color: "var(--brass-lit)" }}>
                  ◈ {job ? usd(job.jobValue) : "…"} USDCx
                </span>
              </div>
            </div>
          </div>

          <div className="beam">
            <span className="beam-label">{beamLabel}</span>
            <svg viewBox="0 0 400 64" preserveAspectRatio="none">
              <path
                d="M70,20 C160,20 240,44 330,44"
                fill="none"
                stroke={beamStroke}
                strokeWidth="1.5"
                strokeDasharray="4 5"
              />
            </svg>
          </div>

          <div className="deadline">
            <div className="deadline-lbl">
              both parties bound to
              <b>deadline · block {job ? job.deadlineBlock.toLocaleString() : "…"}</b>
            </div>
            <div
              className={`seal${job && job.status !== "open" ? " sealed" : ""}`}
              style={job && job.status !== "open" ? { opacity: 1 } : undefined}
            >
              <span>sealed</span>
            </div>
          </div>

          <div className="ledger">
            <span className={dotClass}></span>
            <span className="status-txt">{statusHtml()}</span>
          </div>

          {/* the three FlowVault reads — the witnesses, live */}
          <div className="reads">
            <span className="read">
              get-current-block-height <b>{w ? w.height.toLocaleString() : "…"}</b>
            </span>
            <span className="read">
              lock-until-block <b>{w ? w.lockUntil.toLocaleString() : "…"}</b>
            </span>
            <span className="read">
              has-locked-funds <b>{w ? String(w.hasLocked) : "…"}</b>
            </span>
            <a
              className="read"
              href={explorerContractUrl()}
              target="_blank"
              rel="noreferrer"
              title="Every transaction of this job, on the coordinator contract's explorer page"
            >
              verify on-chain ↗
            </a>
          </div>
        </div>
      </div>

      {/* the backer's proposition — the ONLY place stake math appears */}
      {canCoSign && job && (
        <div className="backer-offer">
          <div className="k">Back this worker · the offer</div>
          <p>
            The job pays <b>◈ {usd(job.jobValue)}</b>. Stake at least{" "}
            <b>◈ {usd(stakeFloor(job.jobValue))}</b> (20%) on them delivering. If they deliver,
            your stake returns <b>+ ◈ {usd(reward)}</b> (2%). If they ghost, your stake pays
            the client. Risking twenty to earn two — only sign if you believe.
          </p>
        </div>
      )}

      <div className="actions" style={{ marginTop: 14 }}>
        {canCoSign && (
          <>
            <input
              className="stake-in"
              value={stake}
              onChange={(e) => {
                stakeTouched.current = true;
                setStake(e.target.value);
              }}
              inputMode="decimal"
              aria-label="stake in USDCx"
            />
            <button className="btn btn-bone" onClick={doCoSign} disabled={!!busy}>
              {busy === "co-sign" ? "Signing…" : address ? "Co-sign · stake" : "Connect to co-sign"}
            </button>
          </>
        )}
        {canDeposit && (
          <button className="btn btn-bone" onClick={doDeposit} disabled={!!busy}>
            {busy === "deposit & lock" ? "Locking…" : "Deposit & lock (your terms above)"}
          </button>
        )}
        {active && deadlineReached && (
          <button className="btn btn-ghost" onClick={doResolve} disabled={!!busy}>
            {busy === "resolve" ? "Resolving…" : "Resolve now (or let the keeper)"}
          </button>
        )}
        {(settled || ghosted) && job && !job.disbursed && (
          <button className="btn btn-ghost" onClick={doDisburse} disabled={!!busy}>
            {busy === "release payout" ? "Releasing…" : "Release payout"}
          </button>
        )}
        <span className="mini">
          {address ? (
            <>
              connected {short(address)}
              {isClient && " · you are the client"}
              {isNewcomer && " · you are the newcomer"}
            </>
          ) : (
            "resolution is automatic at the deadline — the keeper submits it"
          )}
        </span>
      </div>

      {log.length > 0 && (
        <div className="txlog">
          <h4>Record</h4>
          <ul>
            {log.map((e, i) => (
              <li key={i}>
                {e.label}{" "}
                {e.txid && (
                  <a href={explorerTxUrl(e.txid)} target="_blank" rel="noreferrer">
                    {e.txid.slice(0, 10)}… ↗
                  </a>
                )}
                {e.err && <span className="err"> {e.err}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
