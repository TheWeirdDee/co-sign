"use client";

// Draft a job — a panel over the board, not a separate page. The client's
// three real questions only: who, how much, by when. One plain summary line.
// NO stake math here — the 20% floor is the backer's concern, shown on open
// instruments next to the pay.

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import {
  flowVaultRead,
  friendlyError,
  isStxAddress,
  parseTokenAmount,
  READ_CONTEXT_ADDRESS,
} from "@/lib/flowvault";
import { createJob, explorerTxUrl, jobRef, listJobs, requiredEscrow } from "@/lib/cosign";

const MIN_WINDOW = 30;

// Observed Stacks testnet cadence (~50 s per stacks block). Rough on purpose —
// it exists so nobody has to think in blocks.
const SECONDS_PER_BLOCK = 50;
export function humanWindow(blocks: number): string {
  if (!Number.isFinite(blocks) || blocks <= 0) return "—";
  const s = blocks * SECONDS_PER_BLOCK;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} minutes`;
  if (s < 86_400) {
    const h = s / 3600;
    return `${h < 10 ? h.toFixed(1) : Math.round(h)} hours`;
  }
  const d = s / 86_400;
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} days`;
}

export default function DraftJobModal({
  onClose,
  onDrafted,
}: {
  onClose: () => void;
  onDrafted: (jobId?: string) => void;
}) {
  const { address, connect } = useWallet();
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [worker, setWorker] = useState("");
  const [value, setValue] = useState("10");
  const [window_, setWindow] = useState("144");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    flowVaultRead()
      .getCurrentBlockHeight(address ?? READ_CONTEXT_ADDRESS)
      .then((h) => live && setBlockHeight(h))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [address]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const jobValueMicro = useMemo(() => {
    try {
      return parseTokenAmount(value);
    } catch {
      return 0n;
    }
  }, [value]);
  const escrow = requiredEscrow(jobValueMicro);
  const windowBlocks = parseInt(window_ || "0", 10);
  const usd = (m: bigint) => (Number(m) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });

  const submit = async () => {
    setError(null);
    if (!address) return void connect();
    const who = worker.trim();
    if (!isStxAddress(who)) return setError("Enter the worker's STX address (ST…).");
    if (who === address) return setError("You cannot open a job naming yourself as the worker.");
    if (jobValueMicro <= 0n) return setError("Job value must be a positive USDCx amount.");
    if (!blockHeight) return setError("Waiting for the current block height — try again.");
    if (windowBlocks < MIN_WINDOW)
      return setError(`Deadline must be at least ${MIN_WINDOW} blocks out.`);

    setBusy("checking this worker's open instruments…");
    try {
      // one live cycle per worker: their vault can only evidence one job
      const jobs = await listJobs(60);
      const live = jobs.find(
        (j) =>
          j.newcomer === who &&
          (j.status === "open" || j.status === "backed") &&
          j.deadlineBlock >= blockHeight
      );
      if (live) {
        setBusy(null);
        return setError(
          `This worker already has a live instrument (${jobRef(live.id)}). One at a time — settle it first.`
        );
      }
      setBusy("awaiting wallet signature…");
      const res = await createJob(who, jobValueMicro, blockHeight + windowBlocks);
      const id = (res.txid ?? res.txId ?? "").replace(/^0x/, "");
      if (!id) throw new Error("wallet did not return a transaction id");
      setTxid(id);
      setBusy("confirming on-chain…");
      for (let i = 0; i < 60; i++) {
        const j = await (await fetch(`https://api.testnet.hiro.so/extended/v1/tx/0x${id}`)).json();
        if (j.tx_status === "success") {
          const m = String(j.tx_result?.repr ?? "").match(/u(\d+)/);
          onDrafted(m?.[1]);
          return;
        }
        if (String(j.tx_status).startsWith("abort"))
          throw new Error(`transaction rejected: ${j.tx_result?.repr ?? j.tx_status}`);
        await new Promise((r) => setTimeout(r, 10_000));
      }
      onDrafted(undefined);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Draft a job">
      <div className="overlay-panel" style={{ maxWidth: 560 }}>
        <div className="overlay-bar">
          <span className="overlay-link">instrument of guarantee · draft</span>
          <button className="overlay-close" onClick={onClose}>
            close ✕
          </button>
        </div>
        <div className="modal-sheet">
          <h3>Open a job.</h3>
          <p className="sub">
            <b style={{ color: "var(--bone)" }}>You are the client here</b> — the one hiring
            and escrowing the pay. The backer and the worker act later, on the job&apos;s
            card. Three things: who does the work, what it pays, and by when.
          </p>

          <div className="field">
            <label htmlFor="worker">The worker · STX address</label>
            <input
              id="worker"
              value={worker}
              onChange={(e) => setWorker(e.target.value)}
              placeholder="ST…"
              spellCheck={false}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="jv">It pays · USDCx</label>
            <input id="jv" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
          </div>
          <div className="field">
            <label htmlFor="wnd">Deadline · blocks from now</label>
            <input id="wnd" value={window_} onChange={(e) => setWindow(e.target.value)} inputMode="numeric" />
            <div className="hint">
              {windowBlocks > 0 && (
                <>
                  ≈ <b>{humanWindow(windowBlocks)}</b> on testnet (~50 s/block).{" "}
                </>
              )}
              Current block {blockHeight?.toLocaleString() ?? "…"} → deadline{" "}
              {blockHeight ? (blockHeight + windowBlocks).toLocaleString() : "…"}.
            </div>
          </div>

          <div className="summary-line">
            You escrow <b>{usd(escrow)} USDCx</b>, debited from your wallet when you sign:
            the job&apos;s <b>{usd(jobValueMicro)}</b>{" "}
            plus a <b>{usd(escrow - jobValueMicro)}</b> reward pool (2%) for whoever stakes
            their own money on this worker. Deliver → the worker is paid{" "}
            <b>{usd(jobValueMicro)}</b> and the 2% pays their backer — it{" "}
            <b>returns to you</b> if nobody backs them. Ghost → your full escrow returns,{" "}
            <b>plus the backer&apos;s slashed stake</b>.
          </div>

          {error && <div className="notice blocked">{error}</div>}

          <div className="actions">
            <button className="btn btn-bone" onClick={submit} disabled={!!busy}>
              {busy ?? (address ? "Sign & open the job" : "Connect wallet to draft")}
            </button>
            {txid && (
              <a
                className="mini"
                href={explorerTxUrl(txid)}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "underline" }}
              >
                tx {txid.slice(0, 10)}… ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
