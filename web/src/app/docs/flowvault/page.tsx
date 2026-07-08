import type { Metadata } from "next";
import { DocHead, PrevNext, SPLIT_PROOF } from "../shared";

export const metadata: Metadata = {
  title: "What is FlowVault?",
  description:
    "FlowVault's lock, split, and hold primitives — and how Co-Sign uses the lock as payout tool, staking tool, and completion oracle at once.",
};

export default function Page() {
  return (
    <>
      <DocHead
        slug="flowvault"
        lede="The programmable asset-routing layer Co-Sign is built on — one contract, three primitives."
      />
      <section className="doc-sec" style={{ borderBottom: "none" }}>
        <p>
          <a
            href="https://explorer.hiro.so/txid/STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2?chain=testnet"
            target="_blank"
            rel="noreferrer"
          >
            FlowVault
          </a>{" "}
          is a programmable asset-routing layer on Stacks — one contract (
          <code>flowvault-v2</code>) with per-wallet routing rules. When you deposit USDCx it
          can:
        </p>
        <ul>
          <li>
            <b>Lock</b> an amount until a future block height — a time-lock the contract
            physically enforces; early withdrawal is impossible;
          </li>
          <li>
            <b>Split</b> an amount to another address, executed at deposit time;
          </li>
          <li>
            <b>Hold</b> the remainder as a withdrawable balance.
          </li>
        </ul>
        <h3>How Co-Sign uses it</h3>
        <p>
          The lock does triple duty. It is the <b>payout tool</b> (escrow and stake are
          locked until the deadline), the <b>staking tool</b> (the backer&apos;s position is
          a lock), and the <b>completion oracle</b> (whether the worker&apos;s own locked
          cycle ran its course is the unfakeable definition of &quot;delivered&quot;).
        </p>
        <p>
          On the ghost path, the slash itself executes as a FlowVault <b>split</b> — the
          withdrawn funds are re-deposited under a routing rule whose{" "}
          <code>split-address</code> is the wronged client, so FlowVault&apos;s own routing
          engine performs the restitution.{" "}
          <a href={SPLIT_PROOF} target="_blank" rel="noreferrer">
            See a real one on the explorer ↗
          </a>
        </p>
      </section>
      <PrevNext slug="flowvault" />
    </>
  );
}
