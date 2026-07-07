# Co-Sign — Product Requirements Document

**Positioning line:** On-chain reputation today is a scoreboard. Co-Sign makes it a market — where trusting someone means taking a real, staked position in their outcome, enforced by Bitcoin.

**Tagline:** Put your money where your trust is.

**Built for:** FlowVault Builder Bounty (Stacks) — Experimental Money Behaviors / Reputation-Based Payouts.

**Network:** Stacks Testnet

**Status:** Concept locked, pre-build.

**Judging weights this doc optimizes for:** Innovation & Design 35% · FlowVault Integration 30% · Technical Execution 20% · Ecosystem Value 15%.

---

## 1. The Problem

In any trustless payment system, a person with no track record is treated as maximum risk by default. Their payout locks for the full duration, no exceptions, because the system has no way to know if they're reliable.

Meanwhile, experienced people who *would* stake their reputation on a newcomer have no mechanical way to do it. In real freelance, agency, and open-source work this vouching happens constantly but informally ("I've worked with this dev, they're solid") — and it carries zero weight on-chain.

The result: newcomers are stuck in a cold-start trap, and the informal trust experienced people already extend is invisible and unusable.

---

## 2. The Innovation (what makes a judge sit up)

Every on-chain reputation system today is a **score** — a number that accumulates. Reviews, attestations, counters. Scores are free to farm and free to give, which is why they signal so little.

Co-Sign makes reputation a **position**. When someone believes in you, they don't leave a review — they take a stake in your outcome, in locked Bitcoin. It's the difference between someone rating you five stars and someone *buying a bond in you*.

And the twist that makes it stick: when a backer is wrong, their stake doesn't just vanish — it goes **to the person who got hurt**. Restitution is built into the trust primitive itself. That's not just skin in the game; it's a trust market where being wrong pays your victim.

This is the headline. Everything below is how it works.

---

## 3. Core Principle

**Reputation must cost something, or it signals nothing.**

Co-Sign requires the backer to lock their own capital, with a real downside enforced entirely by FlowVault's native lock mechanism — no arbitration, no human judge, no invented off-chain logic. The only thing ever "decided" is a binary FlowVault's own contract already guarantees: **did the newcomer's locked cycle reach its deadline block, or not?**

---

## 4. How FlowVault Is Central (not an add-on)

Co-Sign is built directly on FlowVault's real contract surface. The lock mechanic does triple duty — it is simultaneously the **payout tool**, the **staking tool**, and the **completion oracle**.

- **`setRoutingRules(lockAmount, lockUntilBlock, splitAddress, splitAmount)`** — the single call expressing every behavior. All four flows are different parameter sets on this one function.
- **`getVaultState` / `getRoutingRules`** — read a participant's real on-chain history to determine standing. Trust is *derived from FlowVault's own state*, not a separate ledger.
- **`hasLockedFunds`** — whether a participant currently has an unresolved lock cycle.
- **`getCurrentBlockHeight` vs `lockUntilBlock`** — the mechanical, unfakeable definition of "did the cycle complete." FlowVault physically prevents withdrawing locked funds before `lockUntilBlock`, so completion cannot be faked.

There is no separate contract holding the "real" logic that treats FlowVault as a payout printer. FlowVault's own state *is* the source of truth for every decision.

---

## 5. The Staking Rule (decided)

- **Stake floor: the backer must lock at least 20% of the newcomer's job value.** Below this, the backing does not register and confers no term improvement. High enough to hurt if lost, low enough to back several people.
- **No hard ceiling.** More stake can map to a larger term improvement for the newcomer. Capped in the demo only for clean math.
- **Backer reward on success: 2% of job value**, paid as a split on clean completion.
- **Why 20/2:** the asymmetry is deliberate. Risking 20% to earn 2% means no rational actor backs someone they don't believe in. The stake must dominate the reward, or the trust signal collapses.

---

## 6. The Four Flows (contract behavior)

### Flow A — Unbacked deposit (newcomer, no backer)
`setRoutingRules`: full `lockAmount` = job value, `lockUntilBlock` = deadline block, no split. Maximum-caution treatment.

### Flow B — Backed deposit (newcomer + backer)
Backer locks stake (≥20% of job value) in their **own** vault, `lockUntilBlock` = newcomer's deadline block. Newcomer's terms improve: shorter lock and/or smaller locked portion, because real capital now sits behind them. Both positions bound to the same deadline block.

### Flow C — Clean completion (automatic)
At/after the deadline block, newcomer's cycle has run full course (`hasLockedFunds` false at ≥ `lockUntilBlock`). Resolution fires: newcomer receives funds; backer's stake releases back + 2% reward. Both addresses now show a completed clean cycle → standing improves for both, read live from FlowVault next time.

### Flow D — Ghost / failure (automatic)
Deadline block passes with no completed cycle on the newcomer's address. Backer's stake does **not** return — `setRoutingRules` on the backer's vault routes it (`splitAddress`) to the wronged party (client/employer). Trigger is purely "deadline reached without completion," from `getCurrentBlockHeight` vs `lockUntilBlock` and `hasLockedFunds`.

---

## 7. Automation

Resolution is **not** triggered by a person clicking "resolve." The deadline block crossing `lockUntilBlock` is the trigger. A keeper/watcher fires the resolving `setRoutingRules` transaction the instant the block is reached — the *decision* is fully determined by chain state; only the transaction submission is triggered.

**Honest precision for technical judges:** Stacks contracts don't self-execute on a timer. "Automation" here means the outcome is fully determined by chain state (no human decision), and a lightweight watcher submits the transaction when the block is reached. We never imply the contract runs itself.

---

## 8. Known Limitation (stated honestly)

"Completion" means the newcomer saw the lock cycle through to its deadline — **not** that the work was high quality. A newcomer could complete the cycle and deliver mediocre work.

This is intentional. **Quality judgment is priced by the backer, not the contract.** The backer stakes real money on their belief that this person delivers. Back someone who technically completes but does bad work, and that reflects on the backer's judgment — they bear the capital risk. The contract never assesses quality because a human with skin in the game already did. This is how real underwriting works.

---

## 9. What Co-Sign Is (product shape)

Co-Sign is a **reputation-staking primitive** that platforms integrate — not a standalone destination you open cold. It does not solve discovery ("find me a developer"); it makes *existing* trust between people financially real, and protects the client who's taking a chance on an unknown worker.

The deliverable is the **primitive + a reference implementation** (a clean UI that walks the three-party flow end to end on testnet with real transactions). The reference app proves the primitive; it is not pitched as "the app."

This framing directly serves the bounty's stated priorities: composability, reusable integrations, and ecosystem value.

---

## 10. Users

- **Newcomers** — freelancers, junior devs, new contributors with no on-chain track record.
- **Backers** — experienced contributors, team leads, agencies willing to stake capital on people they trust.
- **Clients/employers** — fund the work; protected because a ghosted job routes the backer's stake to them.

---

## 11. The Three "What We Care About" Signals — coverage check

- **Financial behavior design** ✓ reputation-as-staked-position
- **Automation** ✓ block-triggered resolution (§7)
- **Programmable routing** ✓ four distinct `setRoutingRules` configurations
- **Composability** ✓ primitive framing (§9)
- **Reusable integrations** ✓ primitive framing (§9)
- **Ecosystem value** ✓ portable reputation on Stacks

---

## 12. Deliverables (bounty requirements)

- Public GitHub repository
- Working demo (deployed)
- Short demo video
- Written explanation of FlowVault integration
- At least one successful testnet transaction (explorer-verifiable)
- Meaningful use of FlowVault primitives (lock + split, driven by FlowVault-derived state)

---

## 13. Demo Script (the 90-second win)

The demo must make the FlowVault-native mechanism *visible*, or judges miss the cleverness.

1. Newcomer with no history requests a payout → unbacked terms (full lock). Show `getVaultState` / `lockUntilBlock` on screen.
2. A backer co-signs → locks ≥20% of job value in their own vault. Show the stake locking on the explorer.
3. Newcomer's terms visibly improve (shorter lock) because of the backing.
4. **Clean path:** fast-forward to deadline block → stake releases to backer + 2% reward, newcomer paid, both standings up. Show `getCurrentBlockHeight` crossing `lockUntilBlock` live.
5. **Ghost path (second run):** deadline passes with no completion → backer's stake routes to the client. Show the split firing on the explorer.

The three FlowVault reads — `getCurrentBlockHeight`, `lockUntilBlock`, `hasLockedFunds` — visible on screen at the decision moment, so it's undeniable the trust decision comes from FlowVault's own contract data.

---

## 14. Open Parameters (tune during build)

- Term-improvement curve for the newcomer as a function of stake size (20% floor → baseline improvement; more stake → more).
- Demo-only upper cap on stake for clean math.
- Block-height durations for the demo (compressed so cycles resolve in demo time).

---

## 15. What Co-Sign Is NOT (scope guardrails)

- Not a generic dashboard or treasury visualizer.
- Not a savings circle.
- Not a reactive single-wallet discipline tool.
- Not an arbitration/dispute system — deliberately avoids anything needing a human judge.
- Not a wallet wrapper — the routing logic is the product.
- Not a marketplace — it doesn't help you find people, it makes existing trust real.
