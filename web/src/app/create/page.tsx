"use client";

// The client drafts the instrument: names the newcomer, sets the job value
// and the deadline window, and escrows job value + 2% into the coordinator's
// FlowVault vault. Long default window per the demo-setup requirement — the
// improved-terms benefit must be visible, so tiny windows are discouraged.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { useWallet } from "@/hooks/useWallet";
import { flowVaultRead, isStxAddress, READ_CONTEXT_ADDRESS } from "@/lib/flowvault";
import {
  createJob,
  explorerTxUrl,
  getJob,
  getJobCount,
  requiredEscrow,
  stakeFloor,
} from "@/lib/cosign";

const MIN_WINDOW = 30;

export default function Create() {
  const { address, connect } = useWallet();
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [newcomer, setNewcomer] = useState("");
  const [value, setValue] = useState("10");
  const [window_, setWindow] = useState("144");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ txid: string; jobId?: string } | null>(null);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const h = await flowVaultRead().getCurrentBlockHeight(address ?? READ_CONTEXT_ADDRESS);
        if (live) setBlockHeight(h);
      } catch {}
    };
    tick();
    const t = setInterval(tick, 20_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [address]);

  const jobValueMicro = useMemo(() => {
    const v = parseFloat(value);
    return Number.isFinite(v) && v > 0 ? BigInt(Math.round(v * 1e6)) : 0n;
  }, [value]);
  const windowBlocks = parseInt(window_ || "0", 10);
  const deadline = blockHeight ? blockHeight + windowBlocks : null;
  const addressOk = isStxAddress(newcomer.trim());
  const selfJob = !!address && newcomer.trim() === address;

  // One newcomer per concurrent job: a newcomer's single FlowVault lock slot
  // can only evidence one live cycle, so a second concurrent job would be
  // ambiguous. Scan existing jobs before drafting.
  const findActiveJobFor = useCallback(
    async (who: string, height: number): Promise<bigint | null> => {
      const n = await getJobCount();
      for (let id = 1n; id <= n; id++) {
        const job = await getJob(id);
        if (
          job &&
          job.newcomer === who &&
          (job.status === "open" || job.status === "backed") &&
          job.deadlineBlock >= height
        ) {
          return id;
        }
      }
      return null;
    },
    []
  );

  const submit = async () => {
    setError(null);
    setResult(null);
    if (!address) return void connect();
    if (!addressOk) return setError("Enter a valid STX address for the newcomer (ST…).");
    if (selfJob) return setError("You cannot open a job naming yourself as the newcomer.");
    if (jobValueMicro <= 0n) return setError("Job value must be a positive USDCx amount.");
    if (!blockHeight) return setError("Waiting for the current block height — try again.");
    if (windowBlocks < MIN_WINDOW)
      return setError(
        `Deadline window must be at least ${MIN_WINDOW} blocks — short windows make the backed-terms improvement invisible.`
      );

    setBusy("checking the newcomer's open instruments…");
    try {
      const existing = await findActiveJobFor(newcomer.trim(), blockHeight);
      if (existing !== null) {
        setBusy(null);
        return setError(
          `This newcomer already has a live instrument (job #${existing}). One job per newcomer at a time — their vault can only evidence one cycle.`
        );
      }
      setBusy("awaiting wallet signature…");
      const res = await createJob(newcomer.trim(), jobValueMicro, blockHeight + windowBlocks);
      const txid = (res.txid ?? res.txId ?? "").replace(/^0x/, "");
      if (!txid) throw new Error("wallet did not return a transaction id");
      setResult({ txid });
      setBusy("waiting for confirmation to assign the job number…");
      for (let i = 0; i < 60; i++) {
        const j = await (
          await fetch(`https://api.testnet.hiro.so/extended/v1/tx/0x${txid}`)
        ).json();
        if (j.tx_status === "success") {
          const m = String(j.tx_result?.repr ?? "").match(/u(\d+)/);
          if (m) setResult({ txid, jobId: m[1] });
          break;
        }
        if (String(j.tx_status).startsWith("abort"))
          throw new Error(`transaction rejected: ${j.tx_result?.repr ?? j.tx_status}`);
        await new Promise((r) => setTimeout(r, 10_000));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="cs-page flex-1">
      <div className="wrap">
        <Nav />
        <div className="sheet">
          <div className="sheet-head">
            <div className="eyebrow">Instrument of guarantee · draft</div>
            <h2>Open a job for a newcomer.</h2>
            <p>
              You name the worker and escrow the job value plus a 2% reward pool into the
              coordinator&apos;s FlowVault vault, locked until the deadline block. If they
              deliver, they&apos;re paid and any backer earns the reward. If they ghost,
              everything — including a backer&apos;s slashed stake — returns to you.
            </p>
          </div>

          <div className="field">
            <label htmlFor="newcomer">Newcomer · STX address</label>
            <input
              id="newcomer"
              value={newcomer}
              onChange={(e) => setNewcomer(e.target.value)}
              placeholder="ST…"
              spellCheck={false}
            />
            {newcomer && !addressOk && (
              <div className="hint">Not a valid STX address (BTC-format addresses are rejected).</div>
            )}
          </div>

          <div className="field">
            <label htmlFor="value">Job value · USDCx</label>
            <input
              id="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
            />
            <div className="hint">
              You escrow <b>◈ {(Number(requiredEscrow(jobValueMicro)) / 1e6).toFixed(2)}</b>{" "}
              (value + 2% reward). A backer must stake at least{" "}
              <b>◈ {(Number(stakeFloor(jobValueMicro)) / 1e6).toFixed(2)}</b> (20%).
            </div>
          </div>

          <div className="field">
            <label htmlFor="window">Deadline window · blocks</label>
            <input
              id="window"
              value={window_}
              onChange={(e) => setWindow(e.target.value)}
              inputMode="numeric"
            />
            <div className="hint">
              Longer windows make a backer&apos;s effect visible: backing shortens the
              newcomer&apos;s lock by up to half of the remaining window. 144 blocks is a
              sensible default; minimum {MIN_WINDOW}.
            </div>
          </div>

          <div className="terms-table">
            <div className="terms-row">
              <span className="k">current block</span>
              <span className="v">{blockHeight?.toLocaleString() ?? "…"}</span>
            </div>
            <div className="terms-row">
              <span className="k">deadline block</span>
              <span className="v">{deadline?.toLocaleString() ?? "…"}</span>
            </div>
            <div className="terms-row">
              <span className="k">escrow to lock now</span>
              <span className="v money">
                ◈ {(Number(requiredEscrow(jobValueMicro)) / 1e6).toFixed(2)} USDCx
              </span>
            </div>
          </div>

          {error && <div className="notice blocked">{error}</div>}

          <div className="actions">
            <button className="btn btn-primary" onClick={submit} disabled={!!busy}>
              {busy ?? (address ? "Sign & escrow" : "Connect wallet to draft")}
            </button>
            {result?.jobId && (
              <Link className="btn btn-ghost" href={`/job/${result.jobId}`}>
                Open instrument · job #{result.jobId} →
              </Link>
            )}
          </div>

          {result && (
            <div className="txlog">
              <h4>Record</h4>
              <ul>
                <li>
                  create-job{" "}
                  <a href={explorerTxUrl(result.txid)} target="_blank" rel="noreferrer">
                    {result.txid.slice(0, 10)}… ↗
                  </a>{" "}
                  {result.jobId ? `· confirmed · job #${result.jobId}` : "· pending confirmation…"}
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
