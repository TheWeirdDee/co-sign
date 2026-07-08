import type { Metadata } from "next";
import { DocHead, PrevNext } from "../shared";

export const metadata: Metadata = {
  title: "The trust model",
  description:
    "No server key, no privileged path, no database, no judge — every claim verifiable in the Co-Sign contract source.",
};

export default function Page() {
  return (
    <>
      <DocHead
        slug="trust-model"
        lede="Escrow apps usually hide a trusted operator: a server-held key, a database of outcomes, an admin release path. Co-Sign has none of those — and you can verify each claim in the contract source."
      />
      <section className="doc-sec" style={{ borderBottom: "none" }}>
        <ul>
          <li>
            <b>No server key.</b> The stake and escrow are deposited into a FlowVault vault{" "}
            <b>owned by the coordinator contract itself</b>. No person or server holds a key
            that can move them.
          </li>
          <li>
            <b>No privileged path.</b> The only functions that move funds out are{" "}
            <code>resolve</code> and <code>disburse</code> — both permissionless,
            deadline-gated, and fully determined by chain state. The deployer has no special
            powers.
          </li>
          <li>
            <b>No database.</b> The board is read live from the contract; the contract reads
            FlowVault. There is no off-chain source of truth to tamper with.
          </li>
          <li>
            <b>No judge.</b> &quot;Did the worker complete their cycle&quot; is decided by
            three FlowVault reads — <code>get-current-block-height</code>,{" "}
            <code>lock-until-block</code>, <code>has-locked-funds</code> — not by a human.
            Quality judgment is priced by the backer, who bears the capital risk. That is how
            underwriting works.
          </li>
        </ul>

        <h3>Can one wallet play two roles on the same job?</h3>
        <p>
          No — the contract rejects it (<code>ERR-SELF-PARTY</code>): <code>create-job</code>{" "}
          refuses a client naming themselves as the worker, and <code>co-sign</code> refuses
          a backer who is the job&apos;s worker <i>or</i> its client. One person with several
          wallets can&apos;t be detected by any chain, but the economics neutralize it:
          self-backing means locking 20% of your own money to win 2% of your own money — and
          if you ghost, you slash yourself to pay the client.
        </p>

        <div className="doc-note">
          <b>The keeper is a clock, not a decider.</b> Stacks contracts don&apos;t
          self-execute on a timer, so a small watcher submits <code>resolve</code> when the
          deadline block arrives. Its key has no privileged role — a compromised keeper can
          only pay gas to do the protocol&apos;s own housekeeping.
        </div>
      </section>
      <PrevNext slug="trust-model" />
    </>
  );
}
