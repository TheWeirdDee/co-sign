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
              <a href="#how" className="btn btn-primary">
                See how it works
              </a>
              <Link href="/create" className="btn btn-ghost">
                Draft an instrument
              </Link>
            </div>
          </div>

          {/* LIVE INSTRUMENT: the entire mechanism, running */}
          <LiveInstrument />
        </header>

        <section className="clauses" id="how">
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
          <Link href="/create" className="btn btn-primary">
            Draft an instrument
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
