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
import { createJob, explorerTxUrl, listJobs, requiredEscrow } from "@/lib/cosign";

const MIN_WINDOW = 30;

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
          `This worker already has a live instrument (job #${live.id}). One at a time — settle it first.`
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
          <p className="sub">Three things: who does the work, what it pays, and by when.</p>

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
              144 ≈ a day. Current block {blockHeight?.toLocaleString() ?? "…"} → deadline{" "}
              {blockHeight ? (blockHeight + windowBlocks).toLocaleString() : "…"}.
            </div>
          </div>

          <div className="summary-line">
            You lock <b>◈ {usd(escrow)}</b> now. If they deliver, they&apos;re paid{" "}
            <b>◈ {usd(jobValueMicro)}</b> — the extra 2% rewards whoever backed them, or returns
            to you. If they ghost, everything returns to you.
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
