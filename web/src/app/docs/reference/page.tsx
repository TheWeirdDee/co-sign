import type { Metadata } from "next";
import { COSIGN, DocHead, FLOWVAULT, PrevNext, USDCX } from "../shared";

export const metadata: Metadata = {
  title: "Contract reference",
  description:
    "Every public and read-only function of the cosign-v2 coordinator, and the known limits by design.",
};

export default function Page() {
  return (
    <>
      <DocHead slug="reference" lede="The coordinator's full public surface — all of it permissionless." />
      <section className="doc-sec" style={{ borderBottom: "none" }}>
        <p>
          Coordinator: <code>{COSIGN}</code>
          <br />
          FlowVault: <code>{FLOWVAULT}</code>
          <br />
          Token: <code>{USDCX}</code>
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Function</th>
              <th>Who calls</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>create-job</td>
              <td>client</td>
              <td>
                Opens a job for a worker; escrows job-value + 2% into the contract-owned
                vault, locked until the deadline block.
              </td>
            </tr>
            <tr>
              <td>co-sign</td>
              <td>backer</td>
              <td>
                Stakes ≥ 20% of job value (floor enforced on-chain) into the same vault;
                improves the worker&apos;s terms.
              </td>
            </tr>
            <tr>
              <td>confirm-funding</td>
              <td>anyone</td>
              <td>
                Permissionless snapshot that the worker&apos;s qualifying lock is live — the
                completion evidence, recorded while unfakeable.
              </td>
            </tr>
            <tr>
              <td>resolve</td>
              <td>anyone</td>
              <td>
                At/after the deadline: fixes the outcome from chain state and disburses —
                clean pays worker + backer; ghost splits escrow + slashed stake to the
                client. Idempotent.
              </td>
            </tr>
            <tr>
              <td>disburse</td>
              <td>anyone</td>
              <td>
                Retries a resolved job&apos;s payout if it was deferred by the shared vault
                lock (overlapping deadlines).
              </td>
            </tr>
            <tr>
              <td>read-terms</td>
              <td>read-only</td>
              <td>
                The exact FlowVault routing params the worker should deposit with — improved
                lock-until under backing.
              </td>
            </tr>
            <tr>
              <td>read-resolution</td>
              <td>read-only</td>
              <td>Per-party payout amounts of a settled/ghosted job.</td>
            </tr>
            <tr>
              <td>get-standing</td>
              <td>read-only</td>
              <td>Clean completions per principal — the portable reputation read.</td>
            </tr>
            <tr>
              <td>get-job / get-job-count / read-escrow</td>
              <td>read-only</td>
              <td>Job records, count, and required escrow for a given job value.</td>
            </tr>
          </tbody>
        </table>
        <h3>Known limits (by design)</h3>
        <ul>
          <li>
            <b>One live cycle per worker</b> — a worker&apos;s vault can evidence one job at
            a time; the app enforces one live instrument per worker.
          </li>
          <li>
            <b>Payout timing can defer under overlapping deadlines</b> (the vault&apos;s
            single lock slot). The <i>outcome</i> is still fixed at each job&apos;s own
            deadline; <code>disburse</code> completes payment when the lock expires.
          </li>
          <li>
            <b>Completion ≠ quality.</b> The contract verifies the cycle, the backer prices
            the quality — with their own capital.
          </li>
        </ul>
      </section>
      <PrevNext slug="reference" />
    </>
  );
}
