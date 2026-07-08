import type { Metadata } from "next";
import Link from "next/link";
import { DocHead, PrevNext } from "../shared";

export const metadata: Metadata = {
  title: "Full walkthrough",
  description:
    "Draft a job, co-sign it, run the worker's cycle, and watch the deadline settle it — every step a real testnet transaction.",
};

export default function Page() {
  return (
    <>
      <DocHead
        slug="walkthrough"
        lede="A complete lifecycle, with real transactions. Every step produces a transaction id linked to the explorer."
      />
      <section className="doc-sec" style={{ borderBottom: "none" }}>
        <div className="doc-steps">
          <div className="doc-step">
            <div>
              <h4>Client — draft the job</h4>
              <p>
                On the <Link href="/board">board</Link>, click <b>Draft a job</b>. Three
                questions: the worker&apos;s <code>ST…</code> address, what it pays, and the
                deadline. The form converts blocks to hours/days as you type, and shows
                exactly what you&apos;ll escrow: the pay <b>plus a 2% reward pool</b> for
                whoever backs the worker (it returns to you if nobody does). Sign — the job
                card appears on the board as <b>open · needs a backer</b>.
              </p>
            </div>
          </div>
          <div className="doc-step">
            <div>
              <h4>Backer — co-sign it</h4>
              <p>
                From a different account, open the job card. You&apos;ll see the backer&apos;s
                proposition next to the pay: stake at least <span className="fig">20%</span>{" "}
                of the job, earn <span className="fig">2%</span> if they deliver. Enter your
                stake and sign. Your money moves into the contract-owned vault, locked until
                the deadline — and the worker&apos;s payout terms <b>visibly improve</b> on
                the card. The job is now <b>running</b>.
              </p>
            </div>
          </div>
          <div className="doc-step">
            <div>
              <h4>Worker — run your cycle</h4>
              <p>
                Connect as the worker and open the job. Click <b>deposit &amp; lock</b>: your
                payout cycle locks in your own FlowVault vault with the improved terms the
                contract computed (<code>read-terms</code>). A permissionless snapshot (
                <code>confirm-funding</code>) records the evidence while it is unfakeable.
              </p>
            </div>
          </div>
          <div className="doc-step">
            <div>
              <h4>The deadline settles it</h4>
              <p>
                When the deadline block arrives, the keeper submits <code>resolve</code>.
                Delivered → worker paid, backer made whole <b>+ 2%</b>, both gain standing.
                Ghosted → the client&apos;s escrow returns <b>plus the slashed stake</b>,
                routed by a FlowVault split. The tx log on the job page links every
                transaction to the explorer.
              </p>
            </div>
          </div>
          <div className="doc-step">
            <div>
              <h4>Share it</h4>
              <p>
                Every job has a permalink (<code>/job/&lt;id&gt;</code>) and a <b>share</b>{" "}
                button that copies it — send it to the backer or worker you want to sign.
              </p>
            </div>
          </div>
        </div>
      </section>
      <PrevNext slug="walkthrough" />
    </>
  );
}
