"use client";

// Landing — CONVERTED from web/cosign-landing.html (the design source of
// truth), not regenerated. Markup, copy, and structure are the original's;
// the connect button is wired to the real wallet and the CTAs route into the
// app (/create). The hero instrument's animation lives in LiveInstrument.

import Link from "next/link";
import Nav from "@/components/Nav";
import LiveInstrument from "@/components/LiveInstrument";

export default function Landing() {
  return (
    <main className="cs-page flex-1">
      <div className="wrap">
        <Nav />

        <header className="hero">
          <div>
            <div className="eyebrow">Reputation-staking · built on FlowVault</div>
            <h1>
              Stake Bitcoin on the people you <em>trust</em>.
            </h1>
            <p className="lede">
              A newcomer with no track record gets slow, cautious payouts. Someone who
              believes in them locks their own Bitcoin to speed it up — and if they&apos;re
              wrong, that stake pays the person who got let down.
            </p>
            <div className="cta-row">
              <Link href="/board" className="btn btn-primary">
                Open the board
              </Link>
              <a href="#how" className="btn btn-ghost">
                See how it works
              </a>
            </div>
          </div>

          {/* LIVE INSTRUMENT: the entire mechanism, running */}
          <LiveInstrument />
        </header>

        {/* WHO — the three parties and what each one gets */}
        <section className="story">
          <div className="section-mark">Who signs it · three parties, one outcome</div>
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

        {/* HOW — a job's life in four moves */}
        <section className="story" id="how">
          <div className="section-mark">How a job runs · four moves, no judge</div>
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
        </section>

        <section className="clauses">
          <div className="section-mark">The instrument · three clauses</div>

          <div className="clause">
            <div className="clause-num">Cl. 01</div>
            <div>
              <h3>The Stake</h3>
              <p>
                To back a newcomer, you lock at least <span className="fig">20%</span>
                {" of "}the job&apos;s value in your own vault. If they deliver, you earn{" "}
                <span className="fig">2%</span>. Risking twenty to earn two is the whole
                point — <strong>no one stakes on a person they don&apos;t believe in.</strong>{" "}
                That asymmetry is what turns trust from a free gesture into a real signal.
              </p>
            </div>
          </div>

          <div className="clause">
            <div className="clause-num">Cl. 02</div>
            <div>
              <h3>The Binding</h3>
              <p>
                Whether the newcomer delivered isn&apos;t decided by a person — it&apos;s
                decided by whether the locked funds reach the deadline block, which
                FlowVault&apos;s contract enforces and no one can fake. The chain itself is
                the witness: <strong>getCurrentBlockHeight</strong>,{" "}
                <strong>lockUntilBlock</strong>, and <strong>hasLockedFunds</strong> settle
                it, with no arbitrator in the room.
              </p>
            </div>
          </div>

          <div className="clause">
            <div className="clause-num">Cl. 03</div>
            <div>
              <h3>
                <span className="rs"></span>The Restitution
              </h3>
              <p>
                When a backer is wrong, the stake doesn&apos;t vanish into the void — it
                routes <strong>to the client who took a chance on an unknown worker.</strong>{" "}
                Being wrong pays the person you let down. Restitution is written into the
                primitive itself, not bolted on as a dispute process.
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
