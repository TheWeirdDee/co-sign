"use client";

// The board — the single screen where everything happens. A grid of live
// instruments read from the coordinator contract; drafting opens a panel over
// the board; clicking a card expands it in place. Card states alone should
// explain the system: open (needs a backer), running, settled, ghosted.
//
// Color discipline: running/open cards are bone + brass only. Green = settled,
// seal-red = ghosted — outcome colors, end-of-life only.

import { useCallback, useEffect, useState } from "react";
import Nav from "@/components/Nav";
import JobInstrument from "@/components/JobInstrument";
import DraftJobModal from "@/components/DraftJobModal";
import { short } from "@/hooks/useWallet";
import { flowVaultRead, READ_CONTEXT_ADDRESS } from "@/lib/flowvault";
import { listJobs, type BoardJob } from "@/lib/cosign";

const usd = (m: bigint) => (Number(m) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });

function stateOf(j: BoardJob): { chip: string; cls: string } {
  if (j.status === "settled") return { chip: "settled · clean", cls: "settled" };
  if (j.status === "ghosted") return { chip: "ghosted · slashed", cls: "ghosted" };
  if (j.status === "backed") return { chip: "running", cls: "" };
  return { chip: "open · needs a backer", cls: "" };
}

function JobCard({ job, height, onOpen }: { job: BoardJob; height: number | null; onOpen: () => void }) {
  const s = stateOf(job);
  const active = job.status === "open" || job.status === "backed";
  const left = height ? Math.max(0, job.deadlineBlock - height) : null;
  // progress toward the deadline (structural, monochrome)
  const span = job.deadlineBlock - job.backedBlock;
  const pct =
    !active || !height || span <= 0
      ? 100
      : Math.min(100, Math.max(2, Math.round(((height - job.backedBlock) / span) * 100)));

  return (
    <button className="jobcard" onClick={onOpen}>
      <div className="jobcard-head">
        <span className="jobcard-id">Job #{String(job.id)}</span>
        <span className={`state ${s.cls}`}>{s.chip}</span>
      </div>
      <div className="jobcard-body">
        <div className="jobcard-parties">
          {job.backer ? (
            <>
              {short(job.backer)} <span className="dim">backs</span> {short(job.newcomer)}
            </>
          ) : (
            <>
              {short(job.newcomer)}{" "}
              <span className="dim">
                {job.status === "open" ? "· backer seat open" : "· ran unbacked"}
              </span>
            </>
          )}
          <br />
          <span className="dim">client {short(job.client)}</span>
        </div>
        <div className="jobcard-money">
          ◈ {usd(job.jobValue)} <span className="dim">job</span>
          {job.stakeAmount > 0n && (
            <>
              {"  ·  "}◈ {usd(job.stakeAmount)} <span className="dim">staked</span>
            </>
          )}
        </div>
        <div className="jobcard-deadline">
          {active ? (
            <>
              deadline <b>{job.deadlineBlock.toLocaleString()}</b>
              {left !== null && (
                <>
                  {" "}
                  · <b>{left.toLocaleString()}</b> blocks left
                </>
              )}
            </>
          ) : (
            <>
              closed at block <b>{job.deadlineBlock.toLocaleString()}</b>
              {!job.disbursed && " · payout releasing"}
            </>
          )}
        </div>
        <div className="meter">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
    </button>
  );
}

export default function Board() {
  const [jobs, setJobs] = useState<BoardJob[] | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [open, setOpen] = useState<bigint | null>(null);
  const [drafting, setDrafting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, h] = await Promise.all([
        listJobs(30),
        flowVaultRead().getCurrentBlockHeight(READ_CONTEXT_ADDRESS),
      ]);
      setJobs(list);
      setHeight(h);
    } catch {
      /* transient — next poll */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const running = jobs?.filter((j) => j.status === "backed").length ?? 0;
  const openCount = jobs?.filter((j) => j.status === "open").length ?? 0;

  return (
    <main className="cs-page flex-1">
      <div className="wrap">
        <Nav />

        <div className="board-head">
          <div>
            <h2>The board of live instruments.</h2>
            <p>
              Every card is a signed bond on Stacks testnet: a client&apos;s escrowed job, the
              worker doing it, and — when someone believes — a backer&apos;s stake at risk on
              the outcome.
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <button className="btn btn-bone" onClick={() => setDrafting(true)}>
              Draft a job
            </button>
            <div className="board-meta" style={{ marginTop: 10 }}>
              block <b>{height?.toLocaleString() ?? "…"}</b> · <b>{openCount}</b> open ·{" "}
              <b>{running}</b> running
            </div>
          </div>
        </div>

        <div className="board">
          {jobs === null && <div className="board-empty">Reading the chain…</div>}
          {jobs?.length === 0 && (
            <div className="board-empty">
              No instruments yet. Draft the first job — you escrow the pay, a backer co-signs,
              the chain settles it.
            </div>
          )}
          {jobs?.map((j) => (
            <JobCard key={String(j.id)} job={j} height={height} onOpen={() => setOpen(j.id)} />
          ))}
        </div>
      </div>

      {open !== null && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="overlay-panel">
            <div className="overlay-bar">
              <span className="overlay-link">
                <a href={`/job/${open}`}>permalink ↗</a>
              </span>
              <button className="overlay-close" onClick={() => setOpen(null)}>
                back to board ✕
              </button>
            </div>
            <JobInstrument jobId={open} />
          </div>
        </div>
      )}

      {drafting && (
        <DraftJobModal
          onClose={() => setDrafting(false)}
          onDrafted={(jobId) => {
            setDrafting(false);
            refresh();
            if (jobId) setOpen(BigInt(jobId));
          }}
        />
      )}
    </main>
  );
}
