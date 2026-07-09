"use client";

// Landing — layout restructured to the reference composition (three-zone nav,
// centered hero with pill badge, two preview cards under the hero, trust
// strip, centered pill+heading sections, stat band with a central card, duo
// split), while keeping the Co-Sign surety-instrument theme, tokens, and
// copy. All three clauses survive: the Stake lives in the stat band's flanks,
// the Binding in the duo section, the Restitution in the band's central card.
// A connected wallet belongs on the board — the landing redirects it there.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import LiveInstrument from "@/components/LiveInstrument";
import { useWallet } from "@/hooks/useWallet";

const SPLIT_PROOF_URL =
  "https://explorer.hiro.so/txid/0x695af90092644672be11794f0cda9fa3040f18cc165917361e0190335d9e73c7?chain=testnet";

/* Brass figures count up when they enter the viewport (reduced-motion: static). */
function CountUp({
  to,
  decimals = 0,
  suffix = "",
}: {
  to: number;
  decimals?: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const done = () => (el.textContent = to.toFixed(decimals) + suffix);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      done();
      return;
    }
    let raf = 0;
    const obs = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        obs.disconnect();
        const t0 = performance.now();
        const dur = 1300;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = (to * eased).toFixed(decimals) + suffix;
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, decimals, suffix]);
  return <span ref={ref}>{(0).toFixed(decimals) + suffix}</span>;
}

/* Static preview: the term improvement, visible (backed unlocks earlier). */
function TermsPreview() {
  return (
    <div className="stage">
      <div className="stage-head">
        <span className="stage-title">Backed vs unbacked · same job, same deadline</span>
      </div>
      <div className="stage-body">
        <div className="tc-row">
          <div className="tc-k">Unbacked newcomer · nobody staked</div>
          <div className="tc-v">
            pay locked until <b>block 3,905,000</b> — the full window, maximum caution
          </div>
          <div className="tc-bar">
            <i style={{ width: "100%" }} />
          </div>
        </div>
        <div className="tc-row">
          <div className="tc-k">Backed newcomer · ◈2,000 staked on them</div>
          <div className="tc-v">
            pay unlocks at <span className="good">block 3,904,890</span> —{" "}
            <span className="good">110 blocks earlier</span>, because{" "}
            <span className="money">◈2,000</span> of real capital stands behind their name
          </div>
          <div className="tc-bar">
            <i style={{ width: "64%" }} />
          </div>
        </div>
        <p className="tc-note">
          The improvement is computed on-chain by <b>read-terms</b> from the stake ratio —
          the locked amount never drops, only the wait does.
        </p>
      </div>
    </div>
  );
}

export default function Landing() {
  const { address } = useWallet();
  const router = useRouter();

  // A connected wallet's first arrival goes to the board (no dead-end), but
  // only once per session — navigating back to the landing deliberately
  // (wordmark, footer) must actually show the landing, not bounce forever.
  useEffect(() => {
    if (!address) return;
    if (sessionStorage.getItem("cs-seen-landing")) return;
    sessionStorage.setItem("cs-seen-landing", "1");
    router.replace("/board");
  }, [address, router]);

  return (
    <main className="cs-page flex-1">
      <div className="wrap">
        <Nav />

        {/* HERO — centered, pill badge above, CTA row below, instrument backdrop */}
        <header className="hero-c">
          {/* backdrop: ledger rules + a wax seal that presses in (aria-hidden) */}
          <div className="hero-bg" aria-hidden="true">
            <div className="hero-seal">
              <span>sealed</span>
            </div>
            <svg className="hero-ring" viewBox="0 0 400 400">
              <circle cx="200" cy="200" r="196" />
              <circle cx="200" cy="200" r="168" />
              <circle cx="200" cy="200" r="120" />
            </svg>
          </div>

          <span className="pill">
            Reputation-staking · built on <b>FlowVault</b> · Stacks testnet
          </span>
          <h1>
            Stake on the people you <em>trust</em>.
          </h1>
          {/* the signature — draws itself in like a pen stroke */}
          <svg className="sig" viewBox="0 0 300 30" aria-hidden="true">
            <path
              pathLength={1}
              d="M4,22 C40,4 66,26 104,14 C138,4 148,24 186,16 C224,8 240,22 296,8"
            />
          </svg>
          <p className="lede">
            A newcomer with no track record gets slow, cautious payouts. Someone who
            believes in them locks a real, Bitcoin-secured stake to speed it up — and if
            they&apos;re wrong, that stake pays the person who got let down.
          </p>
          <div className="cta-row">
            <Link href="/board" className="btn btn-primary">
              Open the board
            </Link>
            <a href="#how" className="btn btn-ghost">
              See how it works
            </a>
          </div>
          {/* proof strip — real numbers from the chain, counting up */}
          <div className="proof-strip">
            <span>
              ◈ <b><CountUp to={12.2} decimals={1} /></b> already slashed &amp; repaid to a
              wronged client
            </span>
            <span className="sep">·</span>
            <span>
              <b><CountUp to={100} suffix="%" /></b> chain-decided
            </span>
            <span className="sep">·</span>
            <a href={SPLIT_PROOF_URL} target="_blank" rel="noreferrer">
              see the split on the explorer ↗
            </a>
          </div>
        </header>

        {/* TWO PREVIEW CARDS — the mechanism running + the benefit, visible */}
        <div className="preview-pair">
          <LiveInstrument />
          <TermsPreview />
        </div>

        {/* TRUST STRIP — the real contract surface, not logos */}
        <section className="trust">
          <p>Runs against the real FlowVault contract surface</p>
          <div className="trust-row">
            <span className="read">flowvault-v2</span>
            <span className="read">usdcx · SIP-010</span>
            <span className="read">Clarity coordinator</span>
            <span className="read">Clarinet · 13 tests</span>
            <span className="read">permissionless keeper</span>
            <span className="read">explorer-auditable</span>
          </div>
        </section>

        {/* WHO — centered head + three story cards */}
        <section className="sec-c" id="who">
          <span className="pill">Who signs it</span>
          <h2>Three parties. One outcome.</h2>
          <p>
            Every job is a small bond between a client, a worker, and — when someone
            believes — a backer with skin in the game.
          </p>
          <div className="story-grid">
            <div className="story-card">
              <div className="who">The client</div>
              <h4>Hires an unknown.</h4>
              <p>
                Opens a job and escrows the pay up front. Protected either way: if the worker
                delivers, the work got done — if they ghost, the escrow comes back{" "}
                <b>plus the backer&apos;s slashed stake</b> as restitution.
              </p>
            </div>
            <div className="story-card">
              <div className="who">The backer</div>
              <h4>Puts money on their word.</h4>
              <p>
                Knows the worker is good and proves it: locks a real stake on the outcome. Right
                call earns <b>2%</b> of the job. Wrong call loses the stake to the person it
                hurt. That asymmetry is the whole signal.
              </p>
            </div>
            <div className="story-card">
              <div className="who">The worker</div>
              <h4>Escapes the cold start.</h4>
              <p>
                No track record means maximum caution: pay locked until the deadline. Someone
                staking on you changes your terms — <b>your payout unlocks earlier</b>, because
                real capital now stands behind your name.
              </p>
            </div>
          </div>
        </section>

        {/* HOW — centered head + full-width panel card with the four moves */}
        <section className="sec-c" id="how">
          <span className="pill">How a job runs</span>
          <h2>Four moves. No judge.</h2>
          <p>
            Every position is a FlowVault lock bound to the same deadline block — the chain
            settles the whole thing.
          </p>
          <div className="panel-card">
            <div className="steps">
              <div className="step">
                <div>
                  <h5>The client drafts the job</h5>
                  <p>
                    Names the worker, the pay, the deadline block — and escrows{" "}
                    <b>pay + 2%</b> into a FlowVault vault the coordinator contract owns. Nobody,
                    including us, can move it at will.
                  </p>
                </div>
              </div>
              <div className="step">
                <div>
                  <h5>A backer co-signs (or nobody does)</h5>
                  <p>
                    Anyone who trusts the worker stakes at least <b>20%</b> of the job on them.
                    The stake locks in the same vault until the deadline. Backed workers get
                    faster payout terms; unbacked workers get the full lock.
                  </p>
                </div>
              </div>
              <div className="step">
                <div>
                  <h5>The worker runs their cycle</h5>
                  <p>
                    They lock their payout cycle in their own FlowVault vault, bound toward the
                    same deadline. The chain records it — completion can&apos;t be faked and
                    can&apos;t be denied.
                  </p>
                </div>
              </div>
              <div className="step">
                <div>
                  <h5>The deadline block settles everything</h5>
                  <p>
                    No arbitrator. A keeper submits the resolution the moment the block arrives:
                    delivered → worker paid, backer made whole <b>+ 2%</b>. Ghosted → escrow{" "}
                    <b>and the slashed stake</b> route to the client. The outcome was already
                    fixed by chain state.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STAT BAND — restitution card in the middle, the stake math flanking */}
        <section className="band">
          <h2>Being wrong pays the person you let down.</h2>
          <p>
            When a backer misjudges, the stake doesn&apos;t vanish into the void — it routes to
            the client who took a chance on an unknown worker. Restitution is written into the
            primitive, not bolted on as a dispute process.
          </p>
          <div className="band-grid">
            <div className="band-col">
              <div className="stat">
                <div className="fig"><CountUp to={20} suffix="%" /></div>
                <div className="k">Minimum stake</div>
                <p>of the job&apos;s value, locked in the vault — enforced by the contract.</p>
              </div>
              <div className="stat">
                <div className="fig"><CountUp to={2} suffix="%" /></div>
                <div className="k">Backer reward</div>
                <p>
                  on clean delivery. Risking twenty to earn two — no one stakes on a person they
                  don&apos;t believe in.
                </p>
              </div>
            </div>
            <div className="stage">
              <div className="stage-head">
                <span className="stage-title">One deadline block · two possible ledgers</span>
              </div>
              <div className="stage-body">
                <div className="ledger" style={{ borderTop: "none", marginTop: 0, paddingTop: 4 }}>
                  <span className="status-dot win"></span>
                  <span className="status-txt">
                    Delivered — worker paid <span className="m">◈10,000</span>, stake returns to
                    the backer <span className="to">+ ◈200 reward</span>. Both gain standing.
                  </span>
                </div>
                <div className="ledger">
                  <span className="status-dot loss"></span>
                  <span className="status-txt">
                    Ghosted — the client&apos;s escrow comes back{" "}
                    <span className="oops">plus the ◈2,000 slashed stake</span>, routed by
                    FlowVault&apos;s own split rule.
                  </span>
                </div>
              </div>
            </div>
            <div className="band-col">
              <div className="stat">
                <div className="fig"><CountUp to={100} suffix="%" /></div>
                <div className="k">Chain-decided</div>
                <p>the outcome is fixed by block height and lock state — nothing else.</p>
              </div>
              <div className="stat">
                <div className="fig">0</div>
                <div className="k">Arbitrators</div>
                <p>no dispute process, no human judgment, no discretionary custody.</p>
              </div>
            </div>
          </div>
        </section>

        {/* DUO — the binding: text + CTAs left, the on-chain witnesses right */}
        <section className="duo">
          <div>
            <span className="pill">No judge in the room</span>
            <h3>The deadline block settles everything.</h3>
            <p>
              Whether the worker delivered isn&apos;t decided by a person — it&apos;s decided by
              whether their locked cycle reached the deadline block, which FlowVault&apos;s
              contract enforces and <strong>no one can fake</strong>. A permissionless keeper
              submits the resolution the moment the block arrives; the outcome was already fixed
              by chain state.
            </p>
            <div className="cta-row">
              <Link href="/board" className="btn btn-bone">
                Open the board
              </Link>
              <a
                href="https://github.com/TheWeirdDee/co-sign"
                className="btn btn-ghost"
                target="_blank"
                rel="noreferrer"
              >
                Read the contract ↗
              </a>
            </div>
          </div>
          <div className="stage">
            <div className="stage-head">
              <span className="stage-title">The chain is the witness</span>
            </div>
            <div className="stage-body">
              <div className="reads" style={{ marginTop: 0 }}>
                <span className="read">
                  get-current-block-height <b>3,904,999</b>
                </span>
                <span className="read">
                  lock-until-block <b>3,905,000</b>
                </span>
                <span className="read">
                  has-locked-funds <b>true</b>
                </span>
              </div>
              <p className="tc-note">
                Three reads of FlowVault&apos;s own state decide every job. <b>resolve</b> is
                permissionless and idempotent — anyone may submit it, no one can bias it. The
                keeper is a clock, not a judge.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ — the questions people actually ask when they first try this */}
        <section className="sec-c" id="faq">
          <span className="pill">Questions</span>
          <h2>Before you sign anything.</h2>
          <p>The things people actually ask the first time they open a job.</p>
          <div className="faq">
            <details className="faq-item">
              <summary>
                <span>What is Co-Sign, in one breath?</span>
                <span className="faq-ic" aria-hidden="true">+</span>
              </summary>
              <p>
                A client escrows pay for a worker with no track record. Anyone who trusts that
                worker can back them by staking real money — earning a reward if they&apos;re
                right, paying restitution to the client if they&apos;re wrong. Every step is a
                FlowVault lock; the deadline block resolves it. No server key, no database, no
                judge — just three parties and the chain.
              </p>
            </details>
            <details className="faq-item">
              <summary>
                <span>How does the app know a job was actually completed?</span>
                <span className="faq-ic" aria-hidden="true">+</span>
              </summary>
              <p>
                It doesn&apos;t take anyone&apos;s word for it. The worker proves delivery by
                locking their own <b>performance bond</b> (equal to the job&apos;s value) in
                their own FlowVault vault. FlowVault physically prevents withdrawing that early,
                so a live lock is unfakeable proof a cycle is underway. At the deadline block,{" "}
                <b>resolve</b> reads that vault directly — no one judges the work itself.
              </p>
            </details>
            <details className="faq-item">
              <summary>
                <span>Do I need a backer before I can get paid?</span>
                <span className="faq-ic" aria-hidden="true">+</span>
              </summary>
              <p>
                No. Payment always settles at the <b>deadline block</b>, backed or not — a
                backer only shortens how long the worker&apos;s own bond stays locked (the
                &ldquo;improved terms&rdquo;). No backer just means the slower, fully-cautious
                timer instead of a faster one.
              </p>
            </details>
            <details className="faq-item">
              <summary>
                <span>Why does the worker lock money too — isn&apos;t staking the backer&apos;s job?</span>
                <span className="faq-ic" aria-hidden="true">+</span>
              </summary>
              <p>
                They&apos;re two different mechanisms. The backer&apos;s <b>20% stake</b> is
                someone else vouching for the worker with their own money. The worker&apos;s{" "}
                <b>performance bond</b> (100% of the job&apos;s value, in the worker&apos;s own
                vault) is the unfakeable proof-of-delivery signal above — it comes back to them
                in full, but it takes one more click (&ldquo;reclaim your bond&rdquo;) after
                settlement, since only the worker&apos;s own wallet can pull it out of their own
                vault.
              </p>
            </details>
            <details className="faq-item">
              <summary>
                <span>What is that block number, and why does it keep climbing?</span>
                <span className="faq-ic" aria-hidden="true">+</span>
              </summary>
              <p>
                That&apos;s the Stacks chain&apos;s own clock — it advances roughly every 50
                seconds no matter what any job is doing, and every job on the network shares it.
                The only number that matters to your job is its own <b>deadline block</b>; once
                the chain clock reaches it, resolution is permissionless and automatic.
              </p>
            </details>
            <details className="faq-item">
              <summary>
                <span>Is everything paid back to me automatically?</span>
                <span className="faq-ic" aria-hidden="true">+</span>
              </summary>
              <p>
                The coordinator&apos;s side is: <b>resolve</b>/<b>disburse</b> route the client&apos;s
                escrow and the backer&apos;s stake without anyone lifting a finger. The one
                exception is the worker&apos;s own performance bond — FlowVault requires the vault
                owner&apos;s own signature to withdraw, so the worker reclaims that one
                themselves, once, after settlement.
              </p>
            </details>
          </div>
        </section>

      </div>

      {/* FOOTER PANEL — full-bleed: close + footer merged (reference layout) */}
      <footer className="foot-panel">
        <div className="wrap">
          <div className="foot-top">
            <div className="foot-left">
              <div className="foot-brand">
                CO<span className="dot">·</span>SIGN
              </div>
              <h2>Put your money where your trust is.</h2>
              <div className="cta-row" style={{ marginTop: 0 }}>
                <Link href="/board" className="btn btn-primary">
                  Open the board
                </Link>
                <Link href="/docs" className="btn btn-ghost">
                  Read the docs
                </Link>
              </div>
            </div>
            <div className="foot-cols">
              <div>
                <h5>The app</h5>
                <Link href="/board">The board</Link>
                <Link href="/docs">Documentation</Link>
                <a href="#who">Who signs it</a>
                <a href="#how">How a job runs</a>
              </div>
              <div>
                <h5>Proof</h5>
                <a
                  href="https://explorer.hiro.so/txid/ST31DYZV2SMJHDWQ39T8MWBW8N0AKDR0PVM43D6T2.cosign-v2?chain=testnet"
                  target="_blank"
                  rel="noreferrer"
                >
                  The contract ↗
                </a>
                <a href={SPLIT_PROOF_URL} target="_blank" rel="noreferrer">
                  A real slash, split on-chain ↗
                </a>
                <a
                  href="https://github.com/TheWeirdDee/co-sign"
                  target="_blank"
                  rel="noreferrer"
                >
                  Source on GitHub ↗
                </a>
              </div>
            </div>
          </div>

          <div className="foot-badges">
            <span className="lead">Nothing to trust — verify it:</span>
            <span className="badge">
              <span className="i">⊘</span> no server key
            </span>
            <span className="badge">
              <span className="i">⊘</span> no database
            </span>
            <span className="badge">
              <span className="i">⊘</span> no judge
            </span>
          </div>

          <div className="foot-bottom">
            <span>Stacks testnet · FlowVault Builder Bounty</span>
            <span>© 2026 Co-Sign</span>
            <span className="links">
              <a href="https://github.com/TheWeirdDee/co-sign" target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a
                href="https://explorer.hiro.so/?chain=testnet"
                target="_blank"
                rel="noreferrer"
              >
                Explorer
              </a>
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
