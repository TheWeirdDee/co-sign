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

        <h3>Known limitation: the worker&apos;s bond equals the full job value</h3>
        <p>
          FlowVault has no &quot;mark this delivered&quot; primitive — the only thing it can
          prove is that a lock happened. <code>confirm-funding</code> and{" "}
          <code>resolve</code> both require the worker&apos;s own vault to hold{" "}
          <b>at least the full job value</b>, because a smaller lock would be a cheap, fakeable
          signal on a large payout. The bond is never at risk — the coordinator only ever{" "}
          <i>reads</i> the worker&apos;s vault, it never touches those funds, so nothing is
          lost — it is returned in full once the window closes.
        </p>
        <div className="doc-note red">
          <b>This is a real adoption barrier, not just a rough edge.</b> Requiring a worker to
          already hold capital equal to the full job&apos;s value, just to prove they&apos;re
          doing the work, cuts against the newcomers this product is meant to help — someone
          taking a job because they need the money is exactly who is least likely to have that
          money sitting idle first. It is honestly documented here rather than hidden.
          Planned fix: a smaller worker bond (mirroring the backer&apos;s stake-and-slash
          model) instead of full-value collateral — this requires a new coordinator deployment,
          since the threshold is enforced on-chain in <code>confirm-funding</code> and{" "}
          <code>resolve</code>, not in the UI.
        </div>
      </section>
      <PrevNext slug="trust-model" />
    </>
  );
}
