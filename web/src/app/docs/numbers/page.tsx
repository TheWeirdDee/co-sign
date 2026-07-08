import type { Metadata } from "next";
import { DocHead, PrevNext } from "../shared";

export const metadata: Metadata = {
  title: "Understanding the numbers",
  description:
    "Why a ◈10 job escrows ◈10.2, why the stake floor is 20% for a 2% reward, and how blocks convert to time.",
};

export default function Page() {
  return (
    <>
      <DocHead slug="numbers" lede="The 2%, the 20%, the term improvement, and the block clock — explained." />
      <section className="doc-sec" style={{ borderBottom: "none" }}>
        <h3>Why does a ◈10 job cost the client ◈10.2?</h3>
        <p>
          The extra <span className="fig">◈0.2</span> is not a fee — it is the <b>2% reward
          pool</b> that pays whichever backer stakes on the worker. If nobody backs the job,
          or the worker ghosts, it returns to the client in full. The backer&apos;s own money
          is separate: they stake at least <span className="fig">20%</span> (◈2 on a ◈10
          job).
        </p>
        <h3>Why 20% to earn 2%?</h3>
        <p>
          The asymmetry is the product. If backing were cheap, it would be a review — a free
          gesture that signals nothing. Risking ten times what you can earn means{" "}
          <b>no rational backer signs for someone they don&apos;t believe in</b>, so a backed
          job carries real information.
        </p>
        <h3>How much faster does a backed worker get paid?</h3>
        <p>
          The improvement scales with the stake ratio: at the 20% floor the remaining lock
          shortens by ~10%; a full 100% stake halves it. Computed on-chain by{" "}
          <code>read-terms</code>; the locked <i>amount</i> never drops — only the wait.
        </p>
        <h3>Blocks and time</h3>
        <p>
          Deadlines are block heights, because block height is the one clock a contract can
          trust. On this testnet a block lands roughly every{" "}
          <span className="fig">50 seconds</span>, so 72 blocks ≈ an hour and ~1,700 ≈ a day.
          The draft form and every job card convert for you.
        </p>
      </section>
      <PrevNext slug="numbers" />
    </>
  );
}
