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
import { humanWindow } from "@/components/DraftJobModal";
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
  cosignErrorMessage,
  COSIGN_PRINCIPAL,
  disburse,
  explorerAddressUrl,
  explorerContractUrl,
  explorerTxUrl,
  findJobTxid,
  getJob,
  getStanding,
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
  unlockedBalance: bigint;
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
  const [standing, setStanding] = useState<{ newcomer: bigint; backer: bigint | null }>({
    newcomer: 0n,
    backer: null,
  });
  const [stake, setStake] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [phase, setPhase] = useState<"signing" | "confirming" | null>(null);
  const [step, setStep] = useState<{ i: number; n: number } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [verifyTxid, setVerifyTxid] = useState<string | null>(null);
  const stakeTouched = useRef(false);
  const loadedOnce = useRef(false);

  const push = (e: LogEntry) => setLog((l) => [e, ...l]);

  const refresh = useCallback(async () => {
    if (jobId <= 0n) return true;
    try {
      const j = await getJob(jobId);
      setJob(j);
      if (!j) return;
      const fv = flowVaultRead();
      const [height, vs, hasLocked, newcomerStanding, backerStanding] = await Promise.all([
        fv.getCurrentBlockHeight(address ?? READ_CONTEXT_ADDRESS),
        fv.getVaultState(j.newcomer),
        fv.hasLockedFunds(j.newcomer),
        getStanding(j.newcomer),
        j.backer ? getStanding(j.backer) : Promise.resolve(null),
      ]);
      setW({
        height,
        lockUntil: vs.lockUntilBlock,
        hasLocked,
        unlockedBalance: BigInt(vs.unlockedBalance),
      });
      setStanding({ newcomer: newcomerStanding, backer: backerStanding });
      if (j.status === "open" || j.status === "backed") {
        setTerms(await readTerms(jobId));
      } else {
        setResolution(await fetchResolution(jobId));
      }
      if (!stakeTouched.current) {
        setStake((Number(stakeFloor(j.jobValue)) / 1e6).toString());
      }
      loadedOnce.current = true;
      return true;
    } catch {
      return false; // transient read failure — caller decides how soon to retry
    }
  }, [jobId, address]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // First load deserves faster retries than the 30s poll -- but capped and
    // backed off, or a sustained outage turns this into a retry storm that
    // makes the rate-limiting worse instead of recovering from it.
    const RETRY_SCHEDULE = [4_000, 8_000, 16_000];
    const attempt = async (retryIndex: number) => {
      const ok = await refresh();
      if (!ok && !loadedOnce.current && !cancelled && retryIndex < RETRY_SCHEDULE.length) {
        retryTimer = setTimeout(() => attempt(retryIndex + 1), RETRY_SCHEDULE[retryIndex]);
      }
    };
    attempt(0);

    const t = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(t);
    };
  }, [refresh]);

  // The specific proof tx for this job — refetched only on real lifecycle
  // transitions (not the 30s poll), since it can't change otherwise.
  useEffect(() => {
    if (!job || jobId <= 0n) return;
    let live = true;
    findJobTxid(jobId).then((id) => live && setVerifyTxid(id));
    return () => {
      live = false;
    };
  }, [jobId, job?.status, job?.disbursed, job?.funded]);

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

  // Wait for a broadcast tx to actually confirm, so the instrument updates
  // itself instead of asking the user to refresh.
  const awaitTx = async (txid: string) => {
    for (let i = 0; i < 60; i++) {
      try {
        const j = await (
          await fetch(`https://api.testnet.hiro.so/extended/v1/tx/0x${txid}`)
        ).json();
        if (j.tx_status === "success") return;
        if (String(j.tx_status).startsWith("abort")) {
          const err = new Error(cosignErrorMessage(j.tx_result?.repr));
          (err as Error & { onchainAbort?: boolean }).onchainAbort = true;
          throw err;
        }
      } catch (e) {
        if ((e as Error & { onchainAbort?: boolean }).onchainAbort) throw e;
      }
      await new Promise((r) => setTimeout(r, 10_000));
    }
  };

  // busy identifies WHICH button is running (drives disabled + which label
  // reacts); phase is what to actually show for it, so a long confirmation
  // wait doesn't silently fall back to looking idle-but-disabled with no
  // feedback at all.
  const act = (label: string, fn: () => Promise<unknown>) => async () => {
    if (!address) return void connect();
    setBusy(label);
    setPhase("signing");
    try {
      const res: any = await fn();
      const txid = (res?.txid ?? res?.txId ?? "").replace(/^0x/, "");
      push({ label, txid: txid || undefined });
      if (txid) {
        setPhase("confirming");
        await awaitTx(txid);
      }
    } catch (e) {
      push({ label, err: friendlyError(e) });
    } finally {
      setBusy(null);
      setPhase(null);
      setStep(null);
      refresh();
    }
  };

  const doCoSign = act("co-sign", async () => {
    if (!job) throw new Error("job not loaded yet");
    const amt = parseTokenAmount(stake || "0");
    const floor = stakeFloor(job.jobValue);
    if (amt < floor) {
      throw new Error(
        `Your stake must be at least ${usd(floor)} USDCx — 20% of the job's ${usd(job.jobValue)} value.`
      );
    }
    return coSign(jobId, amt);
  });

  const doDeposit = act("deposit & lock", async () => {
    if (!job) throw new Error("job not loaded yet");
    // Don't fail just because the passive 30s poll hasn't populated terms yet
    // (often exactly why it's missing: a rate-limited read) -- fetch fresh
    // ones right now instead of asking the user to wait and click again.
    const t = terms ?? (await readTerms(jobId));
    if (!terms) setTerms(t);
    const fv = flowVaultWallet(address!);
    setStep({ i: 1, n: 3 });
    const r1: any = await fv.setRoutingRules({
      lockAmount: t.lockAmount,
      lockUntilBlock: t.lockUntilBlock,
      splitAddress: null,
      splitAmount: 0n,
    });
    push({ label: "set-routing-rules", txid: (r1?.txid ?? r1?.txId ?? "").replace(/^0x/, "") });
    setStep({ i: 2, n: 3 });
    const r2: any = await fv.deposit(t.lockAmount);
    const depositTxid = (r2?.txid ?? r2?.txId ?? "").replace(/^0x/, "");
    push({ label: "deposit (lock executes)", txid: depositTxid });
    // Let the deposit confirm before the third signature — three rapid txs from
    // one wallet collide on the nonce and the node rejects the last broadcast.
    if (depositTxid) await awaitTx(depositTxid);
    setStep({ i: 3, n: 3 });
    try {
      return await confirmFunding(jobId);
    } catch {
      // permissionless snapshot — the keeper records it automatically
      push({
        label: "confirm-funding",
        err: "skipped — the keeper records the evidence automatically within a minute; your bond is locked and counts",
      });
      return null;
    }
  });

  const doResolve = act("resolve", () => resolve(jobId));
  const doDisburse = act("release payout", () => disburse(jobId));

  // The newcomer's performance bond lives in THEIR OWN FlowVault vault — the
  // coordinator never touches it. Once the lock expires it just sits there,
  // unlocked but not yet transferred back; only the newcomer's own wallet can
  // pull it out, one more signature, same as any FlowVault withdrawal.
  const doReclaim = act("reclaim bond", async () =>
    flowVaultWallet(address!).withdraw(w!.unlockedBalance)
  );

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
          <span className="oops">{usd(job.stakeAmount)} USDCx stake</span> and the escrow
          route <span className="oops">to the client</span> — restitution,{" "}
          {job.disbursed ? "paid" : "releasing"}.
          {resolution && (
            <>
              {" "}
              Client receives{" "}
              <span className="oops">{usd(resolution.clientAmount)} USDCx</span>.
            </>
          )}
        </>
      );
    if (settled)
      return (
        <>
          Cycle complete. Newcomer paid{" "}
          <span className="m">{usd(resolution?.newcomerAmount ?? job.jobValue)} USDCx</span>
          {job.backer && (
            <>
              ; stake returned to backer <span className="m">+ {usd(reward)} reward</span>
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
          Backer stakes <span className="m">{usd(job.stakeAmount)} USDCx</span> on this
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
            <span
              className="blockclock"
              title="This is the Stacks chain's own clock — it ticks forward roughly every 50 seconds no matter what any job is doing. It's shared by every job on the network; this job cares only about the second number, its deadline block."
            >
              chain block <b>{w ? w.height.toLocaleString() : "…"}</b> / this job&apos;s
              deadline {job ? job.deadlineBlock.toLocaleString() : "…"}
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
              {job?.backer && (
                <div className="card-sub" title="Clean completions recorded by the coordinator contract — backed or delivered without ghosting">
                  {standing.backer === null
                    ? "reading standing…"
                    : standing.backer === 0n
                      ? "no completions on record yet"
                      : `${standing.backer.toString()} clean completion${standing.backer === 1n ? "" : "s"} on record`}
                </div>
              )}
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
              <div className="card-sub" title="Clean completions recorded by the coordinator contract — backed or delivered without ghosting">
                {standing.newcomer === 0n
                  ? "no completions on record yet"
                  : `${standing.newcomer.toString()} clean completion${standing.newcomer === 1n ? "" : "s"} on record`}
              </div>
              <div className="card-terms">
                bond unlocks:{" "}
                <span className="t">
                  {active && terms
                    ? improved
                      ? `faster · block ${terms.lockUntilBlock.toLocaleString()}`
                      : `full lock · block ${terms.lockUntilBlock.toLocaleString()}`
                    : w && w.unlockedBalance > 0n
                      ? "unlocked — reclaim below"
                      : (settled || ghosted) && job?.funded
                        ? "reclaimed"
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
            <div className="deadline-lbl" title="Set by the client when the job was drafted — it cannot change.">
              both parties bound to
              <b>
                deadline · block {job ? job.deadlineBlock.toLocaleString() : "…"}
                {job && w && w.height < job.deadlineBlock && (
                  <> (≈ {humanWindow(job.deadlineBlock - w.height)} left)</>
                )}
              </b>
            </div>
            <div
              className={`seal${job && job.status !== "open" ? " sealed" : ""}${settled ? " win" : ""}`}
              style={job && job.status !== "open" ? { opacity: 1 } : undefined}
            >
              <span>{settled ? "settled" : ghosted ? "ghosted" : "sealed"}</span>
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
              href={verifyTxid ? explorerTxUrl(verifyTxid) : explorerContractUrl()}
              target="_blank"
              rel="noreferrer"
              title={
                verifyTxid
                  ? "This job's own transaction on the explorer"
                  : "Every transaction on the coordinator contract — this job's own tx is still loading"
              }
            >
              verify on-chain ↗
            </a>
          </div>
        </div>
      </div>

      {/* how the outcome is decided — the completion oracle, in plain words */}
      {active && job && (
        <div className="notice" style={{ marginTop: 14 }}>
          <b>How the outcome is decided:</b> the worker proves delivery by locking a{" "}
          <b>{usd(job.jobValue)} USDCx performance bond</b> (equal to the job&apos;s value)
          in their <b>own</b> FlowVault vault through this job&apos;s window — the{" "}
          <b>prove delivery</b> step. The bond is the worker&apos;s own money; it unlocks{" "}
          <b>in full</b> once the window closes, on top of their pay — but FlowVault holds
          it in the worker&apos;s vault until they personally pull it out with one more
          click (&ldquo;Reclaim your bond&rdquo; below), the same as any FlowVault
          withdrawal. It is a different thing from the backer&apos;s 20% stake, and it
          works <b>with or without</b> a backer.{" "}
          {job.funded ? (
            <>
              Evidence is <b>recorded ✓</b> — at the deadline block this job settles clean
              and everyone is paid.
            </>
          ) : (
            <>
              <b>No evidence yet</b> — if none exists by block{" "}
              {job.deadlineBlock.toLocaleString()}, the job settles as ghosted and the
              client is made whole{job.backer ? ", paid from the backer's stake" : ""}.
            </>
          )}{" "}
          Payment always settles at the deadline block — backing shortens how long the
          worker&apos;s bond stays locked, not the payday. No one judges the work itself;
          the backer priced that risk with their own money.
        </div>
      )}

      {/* the bond is unlocked but not yet withdrawn — this is the one manual
          step nothing on this page does for the worker automatically */}
      {!active && job && w && w.unlockedBalance > 0n && (
        <div className="notice" style={{ marginTop: 14 }}>
          <b>The worker&apos;s bond is unlocked but still sitting in their FlowVault
          vault.</b> Settlement pays the job value from the coordinator&apos;s vault — it
          does not touch the worker&apos;s own vault. Only the worker&apos;s wallet can pull
          their <b>{usd(w.unlockedBalance)} USDCx</b> bond out, with the{" "}
          <b>Reclaim your bond</b> button below.
        </div>
      )}

      {/* the backer's proposition — the ONLY place stake math appears */}
      {canCoSign && job && (
        <div className="backer-offer">
          <div className="k">Back this worker · the offer</div>
          <p>
            The job pays <b>{usd(job.jobValue)} USDCx</b>. Stake at least{" "}
            <b>{usd(stakeFloor(job.jobValue))}</b> (20%) on them delivering. If they deliver,
            your stake returns <b>+ {usd(reward)}</b> (2%). If they ghost, your stake pays
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
              {busy === "co-sign"
                ? phase === "confirming"
                  ? "Confirming on-chain…"
                  : "Signing…"
                : address
                  ? "Co-sign · stake"
                  : "Connect to co-sign"}
            </button>
          </>
        )}
        {canDeposit && (
          <button className="btn btn-bone" onClick={doDeposit} disabled={!!busy}>
            {busy === "deposit & lock"
              ? `${step ? `${step.i}/${step.n} ` : ""}${
                  phase === "confirming" ? "confirming on-chain…" : "locking…"
                }`
              : "Prove delivery — deposit & lock (3 signatures)"}
          </button>
        )}
        {active && deadlineReached && (
          <button className="btn btn-ghost" onClick={doResolve} disabled={!!busy}>
            {busy === "resolve"
              ? phase === "confirming"
                ? "Confirming on-chain…"
                : "Resolving…"
              : "Resolve now (or let the keeper)"}
          </button>
        )}
        {(settled || ghosted) && job && !job.disbursed && (
          <button className="btn btn-ghost" onClick={doDisburse} disabled={!!busy}>
            {busy === "release payout"
              ? phase === "confirming"
                ? "Confirming on-chain…"
                : "Releasing…"
              : "Release payout"}
          </button>
        )}
        {isNewcomer && w && w.unlockedBalance > 0n && (
          <button className="btn btn-bone" onClick={doReclaim} disabled={!!busy}>
            {busy === "reclaim bond"
              ? phase === "confirming"
                ? "Confirming on-chain…"
                : "Reclaiming…"
              : `Reclaim your bond — ${usd(w.unlockedBalance)} USDCx`}
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
