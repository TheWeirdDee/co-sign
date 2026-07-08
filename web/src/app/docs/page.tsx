import type { Metadata } from "next";
import Link from "next/link";
import { DocHead, PrevNext } from "./shared";

export const metadata: Metadata = {
  title: "What is Co-Sign?",
  description:
    "Co-Sign makes on-chain reputation a market: backers lock real money on a newcomer's outcome, enforced by FlowVault on Stacks.",
};

export default function Page() {
  return (
    <>
      <DocHead
        slug=""
        lede="Never touched Stacks, a crypto wallet, or a smart contract? Perfect. These docs walk you from a blank machine to a real, chain-settled trust position on the Stacks testnet — every click explained, every claim auditable on the explorer."
      />
      <section className="doc-sec" style={{ borderBottom: "none" }}>
        <p>
          On-chain reputation today is a <b>scoreboard</b> — reviews, stars, attestations.
          Scores are free to give, so they signal almost nothing. Co-Sign makes reputation a{" "}
          <b>market</b>: when someone believes in a newcomer, they don&apos;t leave a review —
          they lock their own money on that person&apos;s outcome.
        </p>
        <p>Three parties sign every instrument:</p>
        <ul>
          <li>
            <b>The client</b> opens a job and escrows the pay up front. They are protected
            either way — if the worker delivers, the work got done; if the worker ghosts, the
            escrow returns <b>plus the backer&apos;s slashed stake</b>.
          </li>
          <li>
            <b>The backer</b> stakes at least <span className="fig">20%</span> of the
            job&apos;s value on the worker. Right call earns <span className="fig">2%</span>;
            wrong call loses the stake to the person it hurt. Risking twenty to earn two is
            the whole signal.
          </li>
          <li>
            <b>The worker</b> escapes the cold start: an unbacked newcomer&apos;s pay is
            locked for the full window, but a staked backer makes their payout unlock{" "}
            <b>earlier</b> — real capital now stands behind their name.
          </li>
        </ul>
        <p>
          At the deadline block the chain settles everything. No arbitrator, no dispute
          process, no admin. The whole lifecycle runs on the <Link href="/board">board</Link>.
        </p>
        <div className="doc-note">
          In a hurry? Jump straight to <Link href="/docs/setup">One-time setup</Link> and the{" "}
          <Link href="/docs/walkthrough">full walkthrough</Link>.
        </div>
      </section>
      <PrevNext slug="" />
    </>
  );
}
