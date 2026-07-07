"use client";

// The landing hero's live instrument — CONVERTED from web/cosign-landing.html
// (not regenerated). The animation timeline, timings, copy, and states are the
// original script's, ported to refs + effects. Illustrative and self-contained
// by design; the /job/[id] page is the same instrument bound to real chain state.

import { useEffect, useRef } from "react";

export default function LiveInstrument() {
  const stage = useRef<HTMLDivElement>(null);
  const clock = useRef<HTMLElement>(null);
  const rBlock = useRef<HTMLElement>(null);
  const rLock = useRef<HTMLElement>(null);
  const stakeFig = useRef<HTMLSpanElement>(null);
  const backerCard = useRef<HTMLDivElement>(null);
  const newCard = useRef<HTMLDivElement>(null);
  const backerSub = useRef<HTMLDivElement>(null);
  const terms = useRef<HTMLSpanElement>(null);
  const beamLabel = useRef<HTMLSpanElement>(null);
  const beamPath = useRef<SVGPathElement>(null);
  const seal = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLSpanElement>(null);
  const status = useRef<HTMLSpanElement>(null);
  const playRef = useRef<() => void>(() => {});

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let intervals: ReturnType<typeof setInterval>[] = [];
    const wait = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const clearAll = () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      timers = [];
      intervals = [];
    };
    const fmt = (n: number) => n.toLocaleString();

    function reset() {
      clearAll();
      clock.current!.textContent = "3,904,780";
      rBlock.current!.textContent = "3,904,780";
      rLock.current!.textContent = "true";
      stakeFig.current!.textContent = "0";
      backerCard.current!.classList.remove("active");
      newCard.current!.classList.remove("active");
      backerSub.current!.textContent = "has not co-signed yet";
      terms.current!.textContent = "full lock · block 3,905,000";
      terms.current!.classList.remove("improved");
      beamLabel.current!.textContent = "awaiting a co-signer";
      beamPath.current!.setAttribute("stroke", "#2A2F37");
      seal.current!.classList.remove("sealed");
      seal.current!.style.opacity = ".25";
      dot.current!.className = "status-dot";
      status.current!.innerHTML =
        "Waiting. The newcomer's pay is fully locked — no one has staked on them.";
    }

    function play() {
      reset();
      if (reduce) {
        // static resolved state for reduced-motion
        stakeFig.current!.textContent = "2,000";
        backerSub.current!.textContent = "staked · at risk until deadline";
        terms.current!.innerHTML = '<span class="improved">faster · block 3,904,890</span>';
        terms.current!.classList.add("improved");
        seal.current!.classList.add("sealed");
        seal.current!.style.opacity = "1";
        dot.current!.className = "status-dot win";
        status.current!.innerHTML =
          'Newcomer delivered. Stake returned to backer <span class="m">+ ◈200 reward</span>. Both gain standing.';
        return;
      }

      // 1. co-sign: stake locks
      wait(() => {
        backerCard.current!.classList.add("active");
        beamLabel.current!.textContent = "co-signing…";
        let n = 0;
        const iv = setInterval(() => {
          n = Math.min(n + 100, 2000);
          stakeFig.current!.textContent = fmt(n);
          if (n >= 2000) clearInterval(iv);
        }, 22);
        intervals.push(iv);
        backerSub.current!.textContent = "staked · at risk until deadline";
        dot.current!.className = "status-dot live";
        status.current!.innerHTML =
          'Backer stakes <span class="m">◈2,000 USDCx</span> — 20% of the job — on this newcomer.';
      }, 700);

      // 2. binding beam lights, seal presses
      wait(() => {
        beamPath.current!.setAttribute("stroke", "#A8823D");
        beamLabel.current!.textContent = "bound to deadline";
        seal.current!.classList.add("sealed");
        seal.current!.style.opacity = "1";
        newCard.current!.classList.add("active");
      }, 2100);

      // 3. newcomer terms improve
      wait(() => {
        terms.current!.innerHTML = "faster · block 3,904,890";
        terms.current!.classList.add("improved");
        status.current!.innerHTML =
          'Because real capital backs them, the newcomer\'s payout unlocks <span class="to">earlier</span> than an unbacked stranger\'s.';
      }, 2900);

      // 4. block advances toward deadline
      wait(() => {
        beamLabel.current!.textContent = "running to deadline";
        let b = 3904780;
        const iv = setInterval(() => {
          b += 22;
          if (b >= 3905000) {
            b = 3905000;
            clearInterval(iv);
          }
          clock.current!.textContent = fmt(b);
          rBlock.current!.textContent = fmt(b);
        }, 55);
        intervals.push(iv);
      }, 3800);

      // 5a. resolution — clean win
      wait(() => {
        rLock.current!.textContent = "false";
        dot.current!.className = "status-dot win";
        status.current!.innerHTML =
          'Deadline reached, cycle complete. Stake returns to backer <span class="m">+ ◈200 reward</span>. Both gain standing.';
        beamLabel.current!.textContent = "settled · clean";
      }, 6200);

      // 5b. show the OTHER outcome (restitution) so the full mechanism is legible
      wait(() => {
        dot.current!.className = "status-dot loss";
        beamPath.current!.setAttribute("stroke", "#8B2635");
        beamLabel.current!.textContent = "the other outcome · ghosted";
        status.current!.innerHTML =
          'Had the newcomer ghosted, the <span class="oops">◈2,000 stake</span> would route <span class="oops">to the client</span> instead — restitution, automatically.';
      }, 8700);

      // loop back
      wait(play, 12200);
    }

    playRef.current = play;
    const obs = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            play();
            obs.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    obs.observe(stage.current!);
    return () => {
      obs.disconnect();
      clearAll();
    };
  }, []);

  return (
    <div className="stage" ref={stage}>
      <div className="stage-head">
        <span className="stage-title">Live instrument · job #4417</span>
        <span className="blockclock">
          block <b ref={clock}>3,904,780</b> / 3,905,000
        </span>
      </div>
      <div className="stage-body">
        <div className="parties">
          <div className="card" ref={backerCard}>
            <div className="card-role">Backer · trusted</div>
            <div className="card-addr">0x8f…a21c</div>
            <div className="card-fig">
              <span className="g">◈</span>
              <span ref={stakeFig}>0</span> USDCx
            </div>
            <div className="card-sub" ref={backerSub}>
              has not co-signed yet
            </div>
          </div>
          <div className="card" ref={newCard}>
            <div className="card-role">Newcomer · no history</div>
            <div className="card-addr">0x3d…9f04</div>
            <div className="card-terms">
              payout unlocks:{" "}
              <span className="t" ref={terms}>
                full lock · block 3,905,000
              </span>
            </div>
            <div className="card-sub">
              job value{" "}
              <span style={{ fontFamily: "var(--mono)", color: "var(--brass-lit)" }}>
                ◈ 10,000 USDCx
              </span>
            </div>
          </div>
        </div>

        <div className="beam">
          <span className="beam-label" ref={beamLabel}>
            awaiting a co-signer
          </span>
          <svg viewBox="0 0 400 64" preserveAspectRatio="none">
            <path
              ref={beamPath}
              d="M70,20 C160,20 240,44 330,44"
              fill="none"
              stroke="#2A2F37"
              strokeWidth="1.5"
              strokeDasharray="4 5"
            />
          </svg>
        </div>

        <div className="deadline">
          <div className="deadline-lbl">
            both parties bound to<b>deadline · block 3,905,000</b>
          </div>
          <div className="seal" ref={seal}>
            <span>sealed</span>
          </div>
        </div>

        <div className="ledger">
          <span className="status-dot" ref={dot}></span>
          <span className="status-txt" ref={status}>
            Waiting. The newcomer&apos;s pay is fully locked — no one has staked on them.
          </span>
        </div>

        <div className="reads">
          <span className="read">
            getCurrentBlockHeight <b ref={rBlock}>3,904,780</b>
          </span>
          <span className="read">
            lockUntilBlock <b>3,905,000</b>
          </span>
          <span className="read">
            hasLockedFunds <b ref={rLock}>true</b>
          </span>
        </div>
      </div>
      <button className="replay" onClick={() => playRef.current()}>
        ▶ replay
      </button>
    </div>
  );
}
