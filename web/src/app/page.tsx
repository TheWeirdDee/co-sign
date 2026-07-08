"use client";

// Landing — layout restructured to the reference composition (three-zone nav,
// centered hero with pill badge, two preview cards under the hero, trust
// strip, centered pill+heading sections, stat band with a central card, duo
// split), while keeping the Co-Sign surety-instrument theme, tokens, and
// copy. All three clauses survive: the Stake lives in the stat band's flanks,
// the Binding in the duo section, the Restitution in the band's central card.
// A connected wallet belongs on the board — the landing redirects it there.

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import LiveInstrument from "@/components/LiveInstrument";
import { useWallet } from "@/hooks/useWallet";

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

  // once connected, the user belongs on the board — no dead-end on the landing
  useEffect(() => {
    if (address) router.replace("/board");
  }, [address, router]);

  return (
    <main className="cs-page flex-1">
      <div className="wrap">
        <Nav />

        {/* HERO — centered, pill badge above, CTA row below */}
        <header className="hero-c">
          <span className="pill">
            Reputation-staking · built on <b>FlowVault</b> · Stacks testnet
          </span>
          <h1>
            Stake on the people you <em>trust</em>.
          </h1>
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
                <div className="fig">20%</div>
                <div className="k">Minimum stake</div>
                <p>of the job&apos;s value, locked in the vault — enforced by the contract.</p>
              </div>
              <div className="stat">
                <div className="fig">2%</div>
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
                <div className="fig">100%</div>
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

        <section className="close">
          <p>Put your money where your trust is.</p>
          <Link href="/board" className="btn btn-primary">
            Open the board
          </Link>
        </section>

        <footer>
          <div className="foot-mark">CO·SIGN</div>
          <div className="foot-note">Stacks testnet · FlowVault Builder Bounty</div>
        </footer>
      </div>
    </main>
  );
}
