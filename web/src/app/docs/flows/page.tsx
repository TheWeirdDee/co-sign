import type { Metadata } from "next";
import { DocHead, PrevNext, SPLIT_PROOF } from "../shared";

export const metadata: Metadata = {
  title: "The four flows",
  description:
    "Unbacked, backed, clean completion, and ghost — who gets what in each outcome, all fixed by chain state.",
};

export default function Page() {
  return (
    <>
      <DocHead
        slug="flows"
        lede="Every job ends in one of two outcomes, from one of two starting states. All four paths are fixed by chain state."
      />
      <section className="doc-sec" style={{ borderBottom: "none" }}>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Flow</th>
              <th>What happens</th>
              <th>Who gets what</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>A · unbacked</td>
              <td>
                No backer signs. The worker&apos;s pay stays locked for the full window —
                maximum-caution treatment.
              </td>
              <td>
                Deliver: worker paid, the unused 2% returns to the client. Ghost: full escrow
                back to the client.
              </td>
            </tr>
            <tr>
              <td>B · backed</td>
              <td>
                A backer stakes ≥ 20%. The worker&apos;s lock shortens in proportion to the
                stake — the amount never drops, only the wait.
              </td>
              <td>Both positions locked to the same deadline block.</td>
            </tr>
            <tr>
              <td>C · clean</td>
              <td>
                The worker&apos;s cycle completed by the deadline (verified against
                FlowVault&apos;s own state).
              </td>
              <td>
                Worker paid the job value; backer receives stake back <b>+ 2%</b>; both gain
                standing.
              </td>
            </tr>
            <tr>
              <td>D · ghost</td>
              <td>
                Deadline passes with no completed cycle. The slash executes as a FlowVault
                split rule —{" "}
                <a href={SPLIT_PROOF} target="_blank" rel="noreferrer">
                  real example ↗
                </a>
                .
              </td>
              <td>
                Client receives their full escrow back <b>plus the backer&apos;s slashed
                stake</b>. Restitution, automatic.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <PrevNext slug="flows" />
    </>
  );
}
