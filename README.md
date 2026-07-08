# Co-Sign

**On-chain reputation is a scoreboard. Co-Sign makes it a market.**

When someone believes in a newcomer, they don't leave a review — they take a real,
staked position in that person's outcome, enforced by FlowVault's lock and split
primitives on Stacks.

**Live demo:** https://co-sign-eight.vercel.app · Stacks testnet · built for the
FlowVault Builder Bounty.

- **Coordinator contract:** `ST31DYZV2SMJHDWQ39T8MWBW8N0AKDR0PVM43D6T2.cosign-v2`
- **FlowVault:** `STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2`
- **Token:** `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` (testnet)

## The idea in three sentences

A newcomer with no track record gets maximum-caution treatment: their payout locks for
the full job window, because the chain has no reason to trust them. Someone who *does*
trust them can co-sign the job — locking at least **20% of the job's value** as a stake,
which measurably improves the newcomer's payout terms. If the newcomer delivers, the
backer earns **2%**; if the newcomer ghosts, the stake is slashed **to the client who got
let down**. Risking twenty to earn two means nobody stakes on a person they don't believe
in — that asymmetry is what makes the trust signal honest.

## The mechanism

```
                        ┌─────────────────────────────────────┐
  client ──escrow──────▶│  coordinator's FlowVault vault      │
  (pay + 2%)            │  locked until the deadline block —  │
  backer ──stake───────▶│  nobody can touch it, including us  │
  (≥ 20% of job)        └───────────────┬─────────────────────┘
                                        │ deadline block reached →
  newcomer ──deposit──▶ own FlowVault   │ permissionless resolve
  (their payout cycle,  vault = the     │
   improved lock terms) completion      ├─ delivered: newcomer paid job value,
                        oracle          │  backer gets stake back + 2% reward
                                        │
                                        └─ ghosted: escrow + slashed stake route
                                           to the client — via a FlowVault
                                           split rule. Restitution built in.
```

## How FlowVault is central

The lock mechanic does triple duty — it is simultaneously the **payout tool**, the
**staking tool**, and the **completion oracle**:

- `set-routing-rules` + `deposit` — every position (client's escrow, backer's stake,
  newcomer's work cycle) is a FlowVault lock bound to the job's deadline block.
- `get-vault-state` — co-sign verification and completion evidence both read FlowVault's
  own state; trust is derived from it, never stored as a parallel ledger.
- `has-locked-funds` + `get-current-block-height` vs `lock-until-block` — the mechanical,
  unfakeable definition of "did the cycle complete." FlowVault physically prevents early
  withdrawal, so completion cannot be faked.
- `set-routing-rules` with a **split** (`split-address` = the wronged client) — on the
  ghost path, the slash itself is executed by FlowVault's own routing engine, not by a
  bespoke transfer.

Integration depth: **Lock + Split + custom routing**, with every trust decision derived
from live FlowVault state.

## The completion oracle (the hard problem)

The naive definition — "check `has-locked-funds` at the deadline" — is broken for
exactly the users this product exists for. A *backed* newcomer's improved lock
legitimately expires **before** the deadline, and after expiry `has-locked-funds` is
false whether the cycle completed or never existed.

So Co-Sign records completion evidence while it is unfakeable: `confirm-funding(job-id)`
is a **permissionless** snapshot anyone may submit while the newcomer's lock is live. It
verifies against FlowVault that at least the job value is locked into this job's window,
with a `backed-block` evidence floor so an older job's cycle can never be replayed as
evidence for a new one. `resolve` uses the snapshot, with a live-evidence fallback for
jobs never snapshotted, and the keeper submits the snapshot as a safety net.

We found FlowVault's advertised surface couldn't enforce this design as-imagined, and
redesigned around its real semantics — that redesign is the most interesting engineering
in the repo.

## Custody model (read this before auditing)

**No party has discretionary control over staked or escrowed funds.** The stake and the
escrow are deposited into a FlowVault vault **owned by the coordinator contract**, locked
until the job deadline by FlowVault's own lock:

- The backer physically cannot withdraw the stake early — it is not their vault. (This is
  also why the stake can't live in the backer's own vault: only a vault's owner can set
  its routing rules, so a losing backer would simply never sign the slash.)
- The coordinator itself cannot withdraw early — FlowVault enforces the lock against it.
- There is **no privileged withdraw path**. The only functions that move funds out are
  `resolve` and `disburse`; both are permissionless, deadline-gated, and their outcome is
  fixed entirely by chain state. The deployer has no special powers, and the coordinator
  holds zero token balance at every transaction boundary (asserted in the tests).

The newcomer's completion cycle lives in the newcomer's **own** vault — that lock is the
completion oracle and carries the improved terms.

## Disbursement: one atomic transaction, split-routed slash

FlowVault routing rules allow a single `split-address`, and the clean path pays two
parties (newcomer and backer), so the clean path disburses by direct SIP-010 transfers
inside **one atomic `resolve` transaction**: withdraw (possible only at/after the
deadline, because of FlowVault's lock), pay the newcomer, pay the backer. Each transfer
is a separate, auditable `ft_transfer` event; no partial-payout state is possible.

The **ghost path has exactly one recipient — the wronged client — so the slash is a
genuine FlowVault split**: the withdrawn funds are re-deposited under a routing rule with
`split-address` = client and `split-amount` = escrow + slashed stake, and FlowVault's own
deposit-time routing executes the restitution. The slash isn't merely *recorded* by
FlowVault; it is *performed* by it.

## Testnet proof

All four flows executed on testnet with explorer-auditable transactions — see
[`contracts/flows-report.json`](contracts/flows-report.json) for the full trail.
Highlights:

- **Flow B — backed job, improved deposit:**
  [explorer](https://explorer.hiro.so/txid/0x1e9bccc1d1b23847b4ddad3a7bdf4581735624ed6fad9b28f62cf18492540290?chain=testnet)
- **Flow C — clean resolution (newcomer paid, backer rewarded):**
  [explorer](https://explorer.hiro.so/txid/0x3b9f07c9f2aecc197c2d48692df4e51dd79c778a06401d45b59a7799de9f2b68?chain=testnet)
- **Flow D — ghost resolution (stake slashed to client):**
  [explorer](https://explorer.hiro.so/txid/0x52273623d968216edf8f29b7923996706fc0aa4d8e8b6739105573e0b1ee63ca?chain=testnet)

Flows A–D above ran on the initial deployment (`…D6T2.cosign`). The current contract
(`…D6T2.cosign-v2`) upgrades the ghost path to route the slash through a real FlowVault
split rule; its own on-chain proof:

- **cosign-v2 ghost resolution — slash executed by FlowVault split** (a 10.0 USDCx job
  with a 2.0 stake; the resolve tx carries FlowVault's own `deposit` event with
  `split-amount u12200000, split-to (some <client>)`):
  [explorer](https://explorer.hiro.so/txid/0x695af90092644672be11794f0cda9fa3040f18cc165917361e0190335d9e73c7?chain=testnet)

## Automation (the keeper)

Stacks contracts do not self-execute on a timer, and we never pretend otherwise. **The
outcome of every job is fully determined by chain state** — `resolve` is permissionless,
deadline-gated, and idempotent; the keeper only *submits* the transaction when the
deadline block is reached. Each tick it sweeps all jobs and:

- submits `resolve(job-id)` for open/backed jobs whose deadline has been reached;
- submits `disburse(job-id)` for resolved jobs whose payout was deferred by the
  coordinator vault's shared lock (the overlap case), until it succeeds;
- submits `confirm-funding(job-id)` as a safety net when a newcomer's vault shows live
  qualifying evidence that hasn't been snapshotted yet.

The keeper key has **no privileged contract role** — all three functions are
permissionless and their effects are fixed by chain state, so a compromised keeper key
cannot steal or redirect funds; it can only pay fees to do the protocol's own
housekeeping. Contract-side idempotency (`ERR-ALREADY-RESOLVED`, `ERR-ALREADY-DISBURSED`,
`ERR-STILL-LOCKED`) means the keeper can be dumb and stateless: rejections are logged and
cooled down, never retried hot.

## Integrating Co-Sign (for other Stacks apps)

Co-Sign is a primitive, not a destination. The contract has **no admin keys and no
allowlist** — every function is permissionless, so integration is plain contract calls:

- **Escrow + vouching for a marketplace or DAO.** Call
  `create-job(worker, value, deadline-block, token)` from your app (or your treasury
  contract) and expose `co-sign(job-id, stake, token)` to anyone who trusts the worker.
  You inherit the whole machine — locked escrow, stake-improved payout terms, automatic
  restitution on ghosting — without writing escrow code. You don't run a resolver
  either: `resolve` and `disburse` are permissionless, so any keeper settles all jobs.
- **Portable reputation, read-only.** `get-standing(principal)` returns clean
  completions, and the evidence behind it is FlowVault's own vault history. Any app can
  gate grants, sort candidates, or underwrite credit on "N clean cycles, backed by real
  staked capital" — a signal that is expensive to fake by construction, because someone
  had to lock money at 20%-to-earn-2% odds behind it.
- **Composability surface:** `get-job`, `read-terms` (the exact FlowVault routing params
  a worker should submit), `read-resolution` (per-party payout of a settled job), and
  `read-escrow` (what a client must lock for a given job value). All read-only, no fees.

Roadmap for integrators: a `cosign-trait` and a thin TypeScript wrapper package, so
third-party contracts can accept any Co-Sign-compatible coordinator.

## Known limitations (documented and tested)

Consequences of FlowVault's one-lock-per-vault design, stated plainly:

- **Payout timing can lag under overlapping jobs.** Stakes/escrows of overlapping jobs
  share the coordinator vault's single lock, extended to the latest deadline. The
  *outcome* of every job is still fixed at its own deadline by `resolve`; only payout
  timing can defer, and permissionless `disburse` completes it the moment the lock
  expires. Covered by test 11.
- **One live cycle per newcomer.** Two concurrent jobs for the same newcomer would share
  one vault deposit as evidence — use one job per newcomer per window.
- **Completion ≠ quality.** "Complete" means the lock cycle ran its course, not that the
  work was good. Quality judgment is priced by the backer, who bears the capital risk —
  that is how underwriting works. The contract never plays judge.
- **The keeper is a submitter, not a decider.** No human decision exists anywhere in
  resolution; the keeper is a clock.

## Run it locally

```bash
# contracts — type-check against the real flowvault-v2 source + run the suite
cd contracts
clarinet check
npm install && npm test        # 13 tests: architecture checklist + overlap + unbacked paths

# keeper — automated resolution watcher
cd keeper
npm install
cp .env.example .env           # set KEEPER_PRIVATE_KEY (any key with a little testnet STX)
npm run keeper

# web — reference implementation (wallet mode via @stacks/connect)
cd web
npm install && npm run dev
```

`/` is the story; `/board` is the app — a live grid of every instrument on the
coordinator contract, with drafting, co-signing, deposits, and resolution driven by the
connected wallet, and a tx id + explorer link for every write.

## Repo layout

```
contracts/   Clarinet project: cosign.clar + tests (runs against the real flowvault-v2
             source, pulled as a testnet requirement)
keeper/      block watcher: submits resolve/disburse/confirm-funding automatically
web/         Next.js reference implementation (wallet mode via @stacks/connect)
```
