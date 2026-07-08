// Docs — Co-Sign from zero. A single, extensive page: what it is, the trust
// model, wallet setup, the full walkthrough, the four flows, the numbers,
// the developer/contract reference, and troubleshooting. Same instrument
// aesthetic as the rest of the app; static content, no chain reads.

import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Co-Sign — Documentation",
  description:
    "Co-Sign from zero: wallet setup, the full walkthrough, the four flows, the trust model, and the contract reference.",
};

const COSIGN = "ST31DYZV2SMJHDWQ39T8MWBW8N0AKDR0PVM43D6T2.cosign-v2";
const FLOWVAULT = "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2";
const USDCX = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx";
const SPLIT_PROOF =
  "https://explorer.hiro.so/txid/0x695af90092644672be11794f0cda9fa3040f18cc165917361e0190335d9e73c7?chain=testnet";

const GROUPS: { label: string; items: [string, string][] }[] = [
  {
    label: "Overview",
    items: [
      ["what", "What is Co-Sign?"],
      ["flowvault", "What is FlowVault?"],
      ["trust", "The trust model"],
    ],
  },
  {
    label: "Guide",
    items: [
      ["setup", "One-time setup"],
      ["walkthrough", "Full walkthrough"],
      ["flows", "The four flows"],
      ["numbers", "Understanding the numbers"],
    ],
  },
  {
    label: "Protocol",
    items: [
      ["developers", "For developers"],
      ["reference", "Contract reference"],
      ["troubleshooting", "Troubleshooting"],
    ],
  },
];

export default function Docs() {
  return (
    <main className="cs-page flex-1">
      <div className="wrap">
        <Nav />

        <div className="docs">
          <aside className="doc-side" aria-label="Documentation sections">
            {GROUPS.map((g) => (
              <div key={g.label}>
                <h6>{g.label}</h6>
                {g.items.map(([id, label]) => (
                  <a key={id} href={`#${id}`}>
                    {label}
                  </a>
                ))}
              </div>
            ))}
          </aside>

          <div className="doc-body">
            <div className="doc-eyebrow">Documentation</div>
            <h1>Co-Sign, from zero.</h1>
            <p className="lede" style={{ maxWidth: "62ch" }}>
              Never touched Stacks, a crypto wallet, or a smart contract? Perfect. This page
              walks you from a blank machine to a real, chain-settled trust position on the
              Stacks testnet — every click explained, every claim auditable on the explorer.
            </p>

            {/* 1 ------------------------------------------------------------ */}
            <section className="doc-sec" id="what">
              <h2>
                <span className="n">01</span>What is Co-Sign?
              </h2>
              <p>
                On-chain reputation today is a <b>scoreboard</b> — reviews, stars,
                attestations. Scores are free to give, so they signal almost nothing. Co-Sign
                makes reputation a <b>market</b>: when someone believes in a newcomer, they
                don&apos;t leave a review — they lock their own money on that person&apos;s
                outcome.
              </p>
              <p>Three parties sign every instrument:</p>
              <ul>
                <li>
                  <b>The client</b> opens a job and escrows the pay up front. They are
                  protected either way — if the worker delivers, the work got done; if the
                  worker ghosts, the escrow returns <b>plus the backer&apos;s slashed stake</b>.
                </li>
                <li>
                  <b>The backer</b> stakes at least <span className="fig">20%</span> of the
                  job&apos;s value on the worker. Right call earns{" "}
                  <span className="fig">2%</span>; wrong call loses the stake to the person it
                  hurt. Risking twenty to earn two is the whole signal.
                </li>
                <li>
                  <b>The worker</b> escapes the cold start: an unbacked newcomer&apos;s pay is
                  locked for the full window, but a staked backer makes their payout unlock{" "}
                  <b>earlier</b> — real capital now stands behind their name.
                </li>
              </ul>
              <p>
                At the deadline block the chain settles everything. No arbitrator, no dispute
                process, no admin. The whole lifecycle runs on the{" "}
                <Link href="/board">board</Link>.
              </p>
            </section>

            {/* 2 ------------------------------------------------------------ */}
            <section className="doc-sec" id="flowvault">
              <h2>
                <span className="n">02</span>What is FlowVault?
              </h2>
              <p>
                <a
                  href="https://explorer.hiro.so/txid/STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2?chain=testnet"
                  target="_blank"
                  rel="noreferrer"
                >
                  FlowVault
                </a>{" "}
                is a programmable asset-routing layer on Stacks — one contract (
                <code>flowvault-v2</code>) with per-wallet routing rules. When you deposit
                USDCx it can:
              </p>
              <ul>
                <li>
                  <b>Lock</b> an amount until a future block height (a time-lock the contract
                  physically enforces — early withdrawal is impossible);
                </li>
                <li>
                  <b>Split</b> an amount to another address, executed at deposit time;
                </li>
                <li>
                  <b>Hold</b> the remainder as a withdrawable balance.
                </li>
              </ul>
              <p>
                Co-Sign uses the lock as three things at once: the <b>payout tool</b> (escrow
                and stake are locked until the deadline), the <b>staking tool</b> (the
                backer&apos;s position is a lock), and the <b>completion oracle</b> (whether
                the worker&apos;s own locked cycle ran its course is the unfakeable definition
                of &quot;delivered&quot;). On the ghost path, the slash itself executes as a
                FlowVault <b>split</b> —{" "}
                <a href={SPLIT_PROOF} target="_blank" rel="noreferrer">
                  see a real one on the explorer ↗
                </a>
                .
              </p>
            </section>

            {/* 3 ------------------------------------------------------------ */}
            <section className="doc-sec" id="trust">
              <h2>
                <span className="n">03</span>The trust model (read this)
              </h2>
              <p>
                Escrow apps usually hide a trusted operator: a server-held key, a database of
                outcomes, an admin &quot;release&quot; path. Co-Sign has none of those, and
                you can verify each claim in the contract source:
              </p>
              <ul>
                <li>
                  <b>No server key.</b> The stake and escrow are deposited into a FlowVault
                  vault <b>owned by the coordinator contract itself</b>. No person or server
                  holds a key that can move them.
                </li>
                <li>
                  <b>No privileged path.</b> The only functions that move funds out are{" "}
                  <code>resolve</code> and <code>disburse</code> — both permissionless,
                  deadline-gated, and fully determined by chain state. The deployer has no
                  special powers.
                </li>
                <li>
                  <b>No database.</b> The board you see is read live from the contract; the
                  contract reads FlowVault. There is no off-chain source of truth to tamper
                  with.
                </li>
                <li>
                  <b>No judge.</b> &quot;Did the worker complete their cycle&quot; is decided
                  by three FlowVault reads — <code>get-current-block-height</code>,{" "}
                  <code>lock-until-block</code>, <code>has-locked-funds</code> — not by a
                  human. Quality judgment is priced by the backer, who bears the capital
                  risk. That is how underwriting works.
                </li>
              </ul>
              <h3>Can one wallet play two roles on the same job?</h3>
              <p>
                No — the contract rejects it (<code>ERR-SELF-PARTY</code>):{" "}
                <code>create-job</code> refuses a client naming themselves as the worker, and{" "}
                <code>co-sign</code> refuses a backer who is the job&apos;s worker <i>or</i>{" "}
                its client. One person with several wallets can&apos;t be detected by any
                chain, but the economics neutralize it: self-backing means locking 20% of
                your own money to win 2% of your own money — and if you ghost, you slash
                yourself to pay the client.
              </p>
              <div className="doc-note">
                <b>The keeper is a clock, not a decider.</b> Stacks contracts don&apos;t
                self-execute on a timer, so a small watcher submits <code>resolve</code> when
                the deadline block arrives. Its key has no privileged role — a compromised
                keeper can only pay gas to do the protocol&apos;s own housekeeping.
              </div>
            </section>

            {/* 4 ------------------------------------------------------------ */}
            <section className="doc-sec" id="setup">
              <h2>
                <span className="n">04</span>One-time setup (about 10 minutes)
              </h2>
              <div className="doc-steps">
                <div className="doc-step">
                  <div>
                    <h4>Install a Stacks wallet</h4>
                    <p>
                      <a href="https://www.xverse.app/" target="_blank" rel="noreferrer">
                        Xverse
                      </a>{" "}
                      (easiest) or{" "}
                      <a href="https://leather.io/" target="_blank" rel="noreferrer">
                        Leather
                      </a>
                      . Create an account and switch the network to <b>Testnet</b>. Your
                      address starts with <code>ST…</code>.
                    </p>
                  </div>
                </div>
                <div className="doc-step">
                  <div>
                    <h4>Get free testnet STX (for gas)</h4>
                    <p>
                      Open the{" "}
                      <a
                        href="https://explorer.hiro.so/sandbox/faucet?chain=testnet"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Hiro testnet faucet
                      </a>
                      , paste your <code>ST…</code> address, request STX. Play money — no
                      real value.
                    </p>
                  </div>
                </div>
                <div className="doc-step">
                  <div>
                    <h4>Get testnet USDCx (the token Co-Sign moves)</h4>
                    <p>
                      Use the FlowVault bounty&apos;s testnet USDCx dispenser, or ask in the
                      FlowVault Telegram. The token contract is <code>{USDCX}</code>.
                    </p>
                  </div>
                </div>
                <div className="doc-step">
                  <div>
                    <h4>Open the live app</h4>
                    <p>
                      Nothing to install:{" "}
                      <a href="https://co-sign-eight.vercel.app" target="_blank" rel="noreferrer">
                        co-sign-eight.vercel.app
                      </a>{" "}
                      → <b>Connect wallet</b> (top right) → you land on the board.
                    </p>
                  </div>
                </div>
              </div>
              <div className="doc-note">
                Want to be all three parties yourself? Create two or three accounts in the
                same wallet and fund each — you can play client, backer, and worker across
                them and watch the full lifecycle.
              </div>
            </section>

            {/* 5 ------------------------------------------------------------ */}
            <section className="doc-sec" id="walkthrough">
              <h2>
                <span className="n">05</span>Full walkthrough (real transactions)
              </h2>
              <div className="doc-steps">
                <div className="doc-step">
                  <div>
                    <h4>Client — draft the job</h4>
                    <p>
                      On the <Link href="/board">board</Link>, click <b>Draft a job</b>. Three
                      questions: the worker&apos;s <code>ST…</code> address, what it pays, and
                      the deadline. The form converts blocks to hours/days as you type, and
                      shows exactly what you&apos;ll escrow: the pay <b>plus a 2% reward
                      pool</b> for whoever backs the worker (it returns to you if nobody
                      does). Sign — that&apos;s your first on-chain transaction, and the job
                      card appears on the board as <b>open · needs a backer</b>.
                    </p>
                  </div>
                </div>
                <div className="doc-step">
                  <div>
                    <h4>Backer — co-sign it</h4>
                    <p>
                      From a different account, open the job card. You&apos;ll see the
                      backer&apos;s proposition next to the pay: stake at least{" "}
                      <span className="fig">20%</span> of the job, earn{" "}
                      <span className="fig">2%</span> if they deliver. Enter your stake and
                      sign. Your money moves into the contract-owned vault, locked until the
                      deadline — and the worker&apos;s payout terms <b>visibly improve</b> on
                      the card. The job is now <b>running</b>.
                    </p>
                  </div>
                </div>
                <div className="doc-step">
                  <div>
                    <h4>Worker — run your cycle</h4>
                    <p>
                      Connect as the worker and open the job. Click <b>deposit &amp; lock</b>:
                      your payout cycle locks in your own FlowVault vault with the improved
                      terms the contract computed (<code>read-terms</code>). A permissionless
                      snapshot (<code>confirm-funding</code>) records the evidence while it is
                      unfakeable.
                    </p>
                  </div>
                </div>
                <div className="doc-step">
                  <div>
                    <h4>The deadline settles it</h4>
                    <p>
                      When the deadline block arrives, the keeper submits{" "}
                      <code>resolve</code>. Delivered → worker paid, backer made whole{" "}
                      <b>+ 2%</b>, both gain standing. Ghosted → the client&apos;s escrow
                      returns <b>plus the slashed stake</b>, routed by a FlowVault split. Every
                      step produced a transaction id — the tx log on the job page links each
                      one to the explorer.
                    </p>
                  </div>
                </div>
                <div className="doc-step">
                  <div>
                    <h4>Share it</h4>
                    <p>
                      Every job has a permalink (<code>/job/&lt;id&gt;</code>) and a{" "}
                      <b>share</b> button that copies it — send it to the backer or worker you
                      want to sign.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 6 ------------------------------------------------------------ */}
            <section className="doc-sec" id="flows">
              <h2>
                <span className="n">06</span>The four flows
              </h2>
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
                      No backer signs. The worker&apos;s pay stays locked for the full window
                      — maximum-caution treatment.
                    </td>
                    <td>
                      Deliver: worker paid, the unused 2% returns to the client. Ghost: full
                      escrow back to the client.
                    </td>
                  </tr>
                  <tr>
                    <td>B · backed</td>
                    <td>
                      A backer stakes ≥ 20%. The worker&apos;s lock shortens in proportion to
                      the stake — the amount never drops, only the wait.
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
                      Worker paid the job value; backer receives stake back <b>+ 2%</b>; both
                      gain standing.
                    </td>
                  </tr>
                  <tr>
                    <td>D · ghost</td>
                    <td>
                      Deadline passes with no completed cycle. The slash executes as a
                      FlowVault split rule —{" "}
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

            {/* 7 ------------------------------------------------------------ */}
            <section className="doc-sec" id="numbers">
              <h2>
                <span className="n">07</span>Understanding the numbers
              </h2>
              <h3>Why does a ◈10 job cost the client ◈10.2?</h3>
              <p>
                The extra <span className="fig">◈0.2</span> is not a fee — it is the{" "}
                <b>2% reward pool</b> that pays whichever backer stakes on the worker. If
                nobody backs the job, or the worker ghosts, it returns to the client in full.
                The backer&apos;s own money is separate: they stake at least{" "}
                <span className="fig">20%</span> (◈2 on a ◈10 job).
              </p>
              <h3>Why 20% to earn 2%?</h3>
              <p>
                The asymmetry is the product. If backing were cheap, it would be a review — a
                free gesture that signals nothing. Risking ten times what you can earn means
                <b> no rational backer signs for someone they don&apos;t believe in</b>, so a
                backed job carries real information.
              </p>
              <h3>How much faster does a backed worker get paid?</h3>
              <p>
                The improvement scales with the stake ratio: at the 20% floor the remaining
                lock shortens by ~10%; a full 100% stake halves it. Computed on-chain by{" "}
                <code>read-terms</code>; the locked <i>amount</i> never drops — only the wait.
              </p>
              <h3>Blocks and time</h3>
              <p>
                Deadlines are block heights, because block height is the one clock a contract
                can trust. On this testnet a block lands roughly every{" "}
                <span className="fig">50 seconds</span>, so 72 blocks ≈ an hour and ~1,700 ≈ a
                day. The draft form and every job card convert for you.
              </p>
            </section>

            {/* 8 ------------------------------------------------------------ */}
            <section className="doc-sec" id="developers">
              <h2>
                <span className="n">08</span>For developers
              </h2>
              <h3>Run it locally</h3>
              <div className="doc-code">{`git clone https://github.com/TheWeirdDee/co-sign
cd co-sign

# contracts — type-check + 13 tests against the real flowvault-v2 source
cd contracts && clarinet check && npm install && npm test

# keeper — the resolution watcher (any key with a little testnet STX)
cd ../keeper && npm install && cp .env.example .env && npm run keeper

# web — the reference app (wallet mode; no keys in the frontend)
cd ../web && npm install && npm run dev`}</div>
              <h3>Integrate the primitive</h3>
              <p>
                The contract has no admin keys and no allowlist — integration is plain
                contract calls. A marketplace calls <code>create-job</code> from its hire
                flow and exposes <code>co-sign</code> to vouchers; a DAO reads{" "}
                <code>get-standing</code> to gate grants on &quot;N clean cycles backed by
                real staked capital&quot; — a signal that is expensive to fake by
                construction. You never run settlement infrastructure:{" "}
                <code>resolve</code>/<code>disburse</code> are permissionless, so any keeper
                settles all jobs.
              </p>
              <div className="doc-note">
                Wallet mode only: the frontend signs everything through{" "}
                <code>@stacks/connect</code> (<code>stx_callContract</code>). Sender keys
                never touch the browser.
              </div>
            </section>

            {/* 9 ------------------------------------------------------------ */}
            <section className="doc-sec" id="reference">
              <h2>
                <span className="n">09</span>Contract reference
              </h2>
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
                      Opens a job for a worker; escrows job-value + 2% into the
                      contract-owned vault, locked until the deadline block.
                    </td>
                  </tr>
                  <tr>
                    <td>co-sign</td>
                    <td>backer</td>
                    <td>
                      Stakes ≥ 20% of job value (floor enforced on-chain) into the same
                      vault; improves the worker&apos;s terms.
                    </td>
                  </tr>
                  <tr>
                    <td>confirm-funding</td>
                    <td>anyone</td>
                    <td>
                      Permissionless snapshot that the worker&apos;s qualifying lock is live —
                      the completion evidence, recorded while unfakeable.
                    </td>
                  </tr>
                  <tr>
                    <td>resolve</td>
                    <td>anyone</td>
                    <td>
                      At/after the deadline: fixes the outcome from chain state and disburses
                      — clean pays worker + backer; ghost splits escrow + slashed stake to the
                      client. Idempotent.
                    </td>
                  </tr>
                  <tr>
                    <td>disburse</td>
                    <td>anyone</td>
                    <td>
                      Retries a resolved job&apos;s payout if it was deferred by the shared
                      vault lock (overlapping deadlines).
                    </td>
                  </tr>
                  <tr>
                    <td>read-terms</td>
                    <td>read-only</td>
                    <td>
                      The exact FlowVault routing params the worker should deposit with —
                      improved lock-until under backing.
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
                  <b>One live cycle per worker</b> — a worker&apos;s vault can evidence one
                  job at a time; the app enforces one live instrument per worker.
                </li>
                <li>
                  <b>Payout timing can defer under overlapping deadlines</b> (the vault&apos;s
                  single lock slot). The <i>outcome</i> is still fixed at each job&apos;s own
                  deadline; <code>disburse</code> completes payment when the lock expires.
                </li>
                <li>
                  <b>Completion ≠ quality.</b> The contract verifies the cycle, the backer
                  prices the quality — with their own capital.
                </li>
              </ul>
            </section>

            {/* 10 ----------------------------------------------------------- */}
            <section className="doc-sec" id="troubleshooting" style={{ borderBottom: "none" }}>
              <h2>
                <span className="n">10</span>Troubleshooting
              </h2>
              <ul>
                <li>
                  <b>My address didn&apos;t appear after connecting</b> — hard refresh
                  (Ctrl/Cmd + Shift + R) and connect again. Make sure the wallet account is on
                  <b> Testnet</b> and is an <code>ST…</code> (STX) account, not a BTC address.
                </li>
                <li>
                  <b>A transaction fails or the wallet shows an error</b> — the sending
                  account is usually out of USDCx (the amount being escrowed/staked) or STX
                  (gas). Top up and retry.
                </li>
                <li>
                  <b>&quot;This worker already has a live instrument&quot;</b> — one job per
                  worker at a time (their vault is the completion oracle). Settle the live one
                  first.
                </li>
                <li>
                  <b>The board looks stale or logs CORS errors</b> — that is the public Hiro
                  API rate-limiting reads, not a bug in the flow. The app throttles and caches;
                  wait for the next poll or refresh once.
                </li>
                <li>
                  <b>A settled job says &quot;payout releasing&quot;</b> — its funds share the
                  vault&apos;s lock with a later job (overlap case). The outcome is already
                  fixed; the keeper submits <code>disburse</code> the moment the lock expires.
                </li>
                <li>
                  <b>The deadline passed but nothing happened</b> — resolution is a
                  transaction someone must submit. The keeper does it within a poll interval;
                  or click <b>resolve</b> on the job page yourself — it&apos;s permissionless.
                </li>
              </ul>
              <div className="doc-note">
                Still stuck? Open an issue on{" "}
                <a
                  href="https://github.com/TheWeirdDee/co-sign"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>{" "}
                — include the transaction id from the job page&apos;s tx log.
              </div>
            </section>
          </div>

          <aside className="doc-mini" aria-label="On this page">
            <div className="k">☰ On this page</div>
            {GROUPS.flatMap((g) => g.items).map(([id, label], i) => (
              <a key={id} href={`#${id}`}>
                {i + 1}. {label}
              </a>
            ))}
          </aside>
        </div>

        <footer>
          <div className="foot-mark">CO·SIGN</div>
          <div className="foot-note">Stacks testnet · FlowVault Builder Bounty</div>
        </footer>
      </div>
    </main>
  );
}
