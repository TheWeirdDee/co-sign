# Co-Sign

**Put your money where your trust is.**

On-chain reputation today is a scoreboard. Co-Sign makes it a market — when someone
believes in a newcomer, they don't leave a review. They take a real, staked position in
that person's outcome, enforced by FlowVault's native lock mechanism on Stacks.

Built for the FlowVault Builder Bounty (Stacks testnet).

- **Coordinator contract:** `ST31DYZV2SMJHDWQ39T8MWBW8N0AKDR0PVM43D6T2.cosign`
- **FlowVault:** `STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2`
- **Token:** `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` (testnet)

## Repo layout

```
contracts/   Clarinet project: cosign.clar + tests (runs against the real flowvault-v2
             source, pulled as a testnet requirement)
keeper/      block watcher that submits resolve() at deadline blocks (Phase 3)
web/         Next.js reference implementation (wallet mode via @stacks/connect)
```

## How it works

A **client** opens a job for a **newcomer**, escrowing the job value + a 2% reward pool.
A **backer** may co-sign, staking **at least 20% of the job value** (enforced in the
contract). Backing improves the newcomer's payout terms: their deposit lock shortens in
proportion to the stake (the locked *amount* never drops — the improvement is timing
only). At the deadline block, resolution is mechanical:

- **Clean** — the newcomer's FlowVault lock cycle completed: the newcomer is paid the
  job value; the backer receives their stake back **plus 2% of job value**.
- **Ghost** — no completed cycle: the wronged client receives their escrow back **plus
  the backer's slashed stake**. Restitution is built into the trust primitive.

Risking 20 to earn 2 means no rational backer signs for someone they don't believe in.

## Custody model (read this before auditing)

**No party has discretionary control over staked or escrowed funds.** The stake and the
escrow are deposited into a FlowVault vault **owned by the coordinator contract**, locked
until the job deadline by FlowVault's own lock:

- The backer physically cannot withdraw the stake early — it is not their vault.
- The coordinator itself cannot withdraw early — FlowVault enforces the lock against it.
- There is **no privileged withdraw path**. The only functions that move funds out are
  `resolve` and `disburse`; both are permissionless, deadline-gated, and their outcome is
  fixed entirely by chain state. The deployer has no special powers.

The newcomer's completion cycle lives in the newcomer's **own** vault — that lock is the
completion oracle and carries the improved terms.

## How FlowVault is central

The lock mechanic does triple duty — payout tool, staking tool, and completion oracle:

- `set-routing-rules` + `deposit` — every position (newcomer's cycle, backer's stake,
  client's escrow) is a FlowVault lock bound to the job's deadline block.
- `get-vault-state` — `co-sign` verification and the completion evidence both read
  FlowVault's own state; trust is derived from it, never stored as a parallel ledger.
- `has-locked-funds` + `get-current-block-height` vs `lock-until-block` — the mechanical,
  unfakeable definition of "did the cycle complete." FlowVault physically prevents early
  withdrawal, so completion cannot be faked.

## The completion oracle (design note)

FlowVault's `has-locked-funds` is false after a lock expires whether the cycle completed
or never existed — and a *backed* newcomer's improved lock legitimately expires **before**
the deadline. So Co-Sign records completion evidence while it is unfakeable:
`confirm-funding(job-id)` is a **permissionless** snapshot anyone can submit while the
newcomer's lock is live; it verifies against FlowVault that at least the job value is
locked into this job's window. `resolve` uses the snapshot, with a live-evidence fallback
for jobs never snapshotted.

## Clean-path disbursement (single atomic transaction)

FlowVault routing rules allow only one `splitAddress`, so "escrow pays newcomer AND
backer reward" cannot be a single routing rule. Co-Sign instead disburses from the
coordinator vault by direct SIP-010 transfers inside **one atomic `resolve` transaction**:

1. `withdraw` (escrow + stake) from the coordinator's FlowVault vault — only possible at
   or after the deadline, because of FlowVault's lock;
2. transfer job-value → newcomer;
3. transfer stake + 2% reward → backer (or escrow + stake → client on ghost).

Each transfer is a separate, auditable `ft_transfer` event in the resolve transaction on
the explorer. No partial-payout state is possible.

## Known limitations (stated honestly)

- **Shared lock slot.** FlowVault gives each principal one lock. Stakes/escrows of
  overlapping jobs share the coordinator vault's lock, extended to the latest deadline.
  The *outcome* of every job is fixed at its own deadline by `resolve`; only the *timing*
  of payout can lag under overlap, and permissionless `disburse` completes it the moment
  the lock expires. (Covered by test 11.)
- **One live cycle per newcomer.** For the same reason, a newcomer can run only one
  job cycle at a time in their vault; two concurrent jobs for the same newcomer would
  share one deposit as evidence. Use one job per newcomer per window.
- **Completion ≠ quality.** "Complete" means the lock cycle ran its course — not that the
  work was good. Quality judgment is priced by the backer, who bears the capital risk.
  That is how underwriting works; the contract never plays judge.
- **Automation framing.** Stacks contracts don't self-execute. The keeper only *submits*
  `resolve`; the outcome is fully determined by chain state — no human decision anywhere.

## Contracts & tests

```bash
cd contracts
clarinet check          # cosign.clar type-checks against the real flowvault-v2 source
npm install && npm test # 13 tests: the 10-point architecture checklist + overlap +
                        # unbacked-resolution paths, exercising real FlowVault semantics
```

## Web (reference implementation)

```bash
cd web
npm install && npm run dev
```

Wallet mode only (`@stacks/connect` → `stx_callContract`); sender keys never touch the
frontend. `/` proves the pipes (connect + live block height); `/flows` drives all four
flows with a tx id + explorer link for every write.
