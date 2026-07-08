;; cosign.clar -- Co-Sign coordinator contract (coordinator-owned vault design)
;;
;; Stores the relationship between a job, a newcomer, a backer, and a client,
;; and drives FlowVault to make the trust position real. Custody model (rule 3
;; as amended): the coordinator holds NO token balance at any transaction
;; boundary and has NO discretionary movement path -- all funds live inside
;; FlowVault vaults. The client's escrow and the backer's stake are deposited
;; into a FlowVault vault OWNED by this contract and locked until the job
;; deadline by FlowVault's native lock, so:
;;   - the backer physically cannot withdraw their stake before resolution,
;;   - the coordinator itself cannot withdraw before the deadline either,
;;   - at/after the deadline, permissionless `resolve` routes funds strictly
;;     per the chain-state-determined outcome (slash is trustless).
;; The NEWCOMER's completion cycle stays in the newcomer's OWN vault -- that
;; lock is the completion oracle and carries the improved terms.
;;
;; FlowVault (testnet): STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
;; Token (testnet):     ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
;;
;; Known limitation (FlowVault gives one lock slot per principal): stakes and
;; escrows of overlapping jobs share a single lock-until, extended to the
;; latest deadline. `resolve` always fixes the OUTCOME at the job's own
;; deadline; if the shared lock is still active, disbursement is deferred and
;; anyone may retry it later via `disburse`.

(use-trait sip-010-trait 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.sip-010-trait.sip-010-trait)

;; ========================
;; Constants
;; ========================

;; This contract's own principal (the FlowVault vault owner).
(define-private (get-self)
  (as-contract tx-sender)
)

;; The only token this coordinator moves. Pinned so nobody can deposit a
;; worthless token and withdraw value in another (FlowVault vaults are not
;; keyed by token).
(define-constant TOKEN-CONTRACT 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx)

;; Backer must lock at least 20% of job value (PRD sec.5). Enforced HERE, not UI.
(define-constant STAKE-FLOOR-PCT u20)
;; Backer reward on clean completion: 2% of job value (PRD sec.5), escrowed by
;; the client up front (client deposits job-value + 2% at create-job).
(define-constant REWARD-PCT u2)
;; Term-improvement factor: at full backing (stake == job-value) the remaining
;; lock duration halves (architecture sec.3, open parameter, start at 0.5).
(define-constant IMPROVEMENT-FACTOR-PCT u50)

(define-constant STATUS-OPEN "open")
(define-constant STATUS-BACKED "backed")
(define-constant STATUS-SETTLED "settled")
(define-constant STATUS-GHOSTED "ghosted")

;; Error codes
(define-constant ERR-JOB-NOT-FOUND (err u100))
(define-constant ERR-INVALID-VALUE (err u101))
(define-constant ERR-DEADLINE-NOT-FUTURE (err u102))
(define-constant ERR-BAD-STATUS (err u103))
(define-constant ERR-STAKE-BELOW-FLOOR (err u104))
(define-constant ERR-SELF-PARTY (err u105))
(define-constant ERR-DEADLINE-NOT-REACHED (err u107))
(define-constant ERR-ALREADY-RESOLVED (err u108))
(define-constant ERR-NOT-FUNDED (err u109))
(define-constant ERR-FUNDING-WINDOW-CLOSED (err u110))
(define-constant ERR-WRONG-TOKEN (err u111))
(define-constant ERR-STILL-LOCKED (err u112))
(define-constant ERR-ALREADY-DISBURSED (err u113))
(define-constant ERR-NOT-RESOLVED (err u114))

;; ========================
;; Data model (architecture sec.2)
;; ========================

(define-map jobs
  uint
  {
    client: principal,               ;; funds the work + 2% reward escrow, protected on ghost
    newcomer: principal,             ;; does the work, gets improved terms
    backer: (optional principal),    ;; none until someone co-signs
    job-value: uint,                 ;; micro-units
    stake-amount: uint,              ;; backer's stake locked in the coordinator vault, 0 until co-signed
    escrow-amount: uint,             ;; client's deposit: job-value + 2% reward
    deadline-block: uint,            ;; the shared lockUntilBlock
    status: (string-ascii 12),       ;; "open" | "backed" | "settled" | "ghosted"
    funded: bool,                    ;; FlowVault-verified: newcomer's lock cycle observed live
    backed-block: uint,              ;; evidence floor: newcomer lock cycles ending before this
                                     ;; block belong to an older job and never count
    disbursed: bool                  ;; funds routed out of the coordinator vault
  }
)

(define-data-var job-nonce uint u0)

;; Convenience cache only -- source of truth remains FlowVault history.
(define-map standing principal { clean-completions: uint })

;; ========================
;; Private helpers
;; ========================

(define-private (bump-standing (who principal))
  (map-set standing who {
    clean-completions: (+ u1 (get clean-completions
      (default-to { clean-completions: u0 } (map-get? standing who))))
  })
)

;; Improved lock expiry for the newcomer (architecture sec.3). Improvement scales
;; with stake ratio r = stake / job-value (capped at 1.0):
;;   lock-until = deadline - floor(remaining * min(r, 1) * IMPROVEMENT-FACTOR)
;; The lockAmount never drops below job-value -- the improvement is timing only.
(define-private (improved-lock-until (deadline uint) (job-value uint) (stake uint))
  (if (or (is-eq stake u0) (>= stacks-block-height deadline))
    deadline
    (let
      (
        (remaining (- deadline stacks-block-height))
        (capped-stake (if (> stake job-value) job-value stake))
        (reduction (/ (* (* remaining capped-stake) IMPROVEMENT-FACTOR-PCT)
                      (* job-value u100)))
      )
      (- deadline reduction)
    )
  )
)

;; FlowVault allows one lock per vault and forbids shortening an active lock,
;; so a new deposit must lock until at least the current active lock's expiry.
(define-private (vault-lock-floor (desired uint))
  (let ((vs (contract-call? 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
                            get-vault-state (get-self))))
    (if (and (> (get locked-balance vs) u0)
             (> (get lock-until-block vs) desired))
      (get lock-until-block vs)
      desired
    )
  )
)

;; Pull `amount` from `from` and lock it in the coordinator's FlowVault vault
;; until (at least) `deadline`.
(define-private (escrow-into-vault (token <sip-010-trait>) (from principal) (amount uint) (deadline uint))
  (let ((lock-until (vault-lock-floor deadline)))
    (try! (contract-call? token transfer amount from (get-self) none))
    (try! (as-contract (contract-call? 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
                                       set-routing-rules amount lock-until none u0)))
    (try! (as-contract (contract-call? 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
                                       deposit token amount)))
    (ok true)
  )
)

(define-private (transfer-if-positive (token <sip-010-trait>) (amount uint) (to principal))
  (if (> amount u0)
    (as-contract (contract-call? token transfer amount tx-sender to none))
    (ok true)
  )
)

;; Withdraw this job's funds from the coordinator vault and route them per the
;; resolved outcome. Returns (ok true) when disbursed, (ok false) when the
;; vault's shared lock still holds the funds (retry later via `disburse`).
(define-private (try-disburse (token <sip-010-trait>)
                              (client principal)
                              (newcomer principal)
                              (backer (optional principal))
                              (job-value uint)
                              (stake uint)
                              (escrow uint)
                              (clean bool))
  (let ((total (+ escrow stake)))
    (match (as-contract (contract-call? 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
                                        withdraw token total))
      result
        (begin
          (if clean
            (begin
              ;; newcomer is paid the job value...
              (try! (transfer-if-positive token job-value newcomer))
              ;; ...the backer gets their stake back + the 2% reward; with no
              ;; backer the reward remainder returns to the client.
              (match backer
                b (try! (transfer-if-positive token (+ stake (- escrow job-value)) b))
                (try! (transfer-if-positive token (- escrow job-value) client))
              )
            )
            ;; ghost: restitution -- the wronged client receives their escrow
            ;; back PLUS the backer's slashed stake, routed through a genuine
            ;; FlowVault SPLIT rule: the withdrawn funds are re-deposited with
            ;; split-address = client, split-amount = total, so FlowVault's own
            ;; routing engine executes the slash at deposit time (splits fire
            ;; on deposit in flowvault-v2). Rules are cleared afterwards so no
            ;; stale split survives the transaction.
            (begin
              (try! (as-contract (contract-call? 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
                                                 set-routing-rules u0 u0 (some client) total)))
              (try! (as-contract (contract-call? 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
                                                 deposit token total)))
              (unwrap-panic (as-contract (contract-call? 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
                                                         clear-routing-rules)))
            )
          )
          (ok true)
        )
      err-code (ok false)
    )
  )
)

;; ========================
;; Public functions
;; ========================

;; Client opens a job for a newcomer, escrowing job-value + 2% (the reward
;; pool) into the coordinator's FlowVault vault, locked until the deadline.
(define-public (create-job (newcomer principal) (job-value uint) (deadline-block uint) (token <sip-010-trait>))
  (let
    (
      (job-id (+ (var-get job-nonce) u1))
      (escrow (/ (* job-value (+ u100 REWARD-PCT)) u100))
    )
    (asserts! (is-eq (contract-of token) TOKEN-CONTRACT) ERR-WRONG-TOKEN)
    (asserts! (> job-value u0) ERR-INVALID-VALUE)
    (asserts! (> deadline-block stacks-block-height) ERR-DEADLINE-NOT-FUTURE)
    (asserts! (not (is-eq newcomer tx-sender)) ERR-SELF-PARTY)
    (try! (escrow-into-vault token tx-sender escrow deadline-block))
    (map-set jobs job-id {
      client: tx-sender,
      newcomer: newcomer,
      backer: none,
      job-value: job-value,
      stake-amount: u0,
      escrow-amount: escrow,
      deadline-block: deadline-block,
      status: STATUS-OPEN,
      funded: false,
      backed-block: stacks-block-height,
      disbursed: false
    })
    (var-set job-nonce job-id)
    (print { event: "create-job", job-id: job-id, client: tx-sender, newcomer: newcomer,
             job-value: job-value, escrow: escrow, deadline-block: deadline-block })
    (ok job-id)
  )
)

;; Backer commits a stake (>= 20% of job value) to a job. The stake moves from
;; the backer into the coordinator's FlowVault vault, locked until the
;; deadline: the backer cannot touch it again -- resolution alone routes it.
(define-public (co-sign (job-id uint) (stake-amount uint) (token <sip-010-trait>))
  (let
    (
      (job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND))
      (backer tx-sender)
    )
    (asserts! (is-eq (contract-of token) TOKEN-CONTRACT) ERR-WRONG-TOKEN)
    (asserts! (is-eq (get status job) STATUS-OPEN) ERR-BAD-STATUS)
    (asserts! (< stacks-block-height (get deadline-block job)) ERR-DEADLINE-NOT-FUTURE)
    (asserts! (not (is-eq backer (get newcomer job))) ERR-SELF-PARTY)
    (asserts! (not (is-eq backer (get client job))) ERR-SELF-PARTY)
    (asserts! (> stake-amount u0) ERR-INVALID-VALUE)
    ;; The 20% stake floor (PRD sec.5) -- enforced in the contract.
    (asserts! (>= stake-amount (/ (* (get job-value job) STAKE-FLOOR-PCT) u100))
              ERR-STAKE-BELOW-FLOOR)
    (try! (escrow-into-vault token backer stake-amount (get deadline-block job)))
    (map-set jobs job-id (merge job {
      backer: (some backer),
      stake-amount: stake-amount,
      status: STATUS-BACKED,
      backed-block: stacks-block-height
    }))
    (print { event: "co-sign", job-id: job-id, backer: backer, stake-amount: stake-amount })
    (ok true)
  )
)

;; Permissionless, evidence-based snapshot: while the newcomer's FlowVault lock
;; is LIVE, anyone may record that the job is funded. This is required for a
;; correct clean/ghost call at resolve time, because a backed newcomer's
;; improved lock legitimately expires BEFORE the deadline -- and FlowVault's
;; `has-locked-funds` is false after expiry whether the cycle completed or
;; never existed. The snapshot captures the completion evidence while it is
;; still unfakeable (FlowVault physically prevents early withdrawal).
(define-public (confirm-funding (job-id uint))
  (let
    (
      (job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND))
      (nv (contract-call? 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
                          get-vault-state (get newcomer job)))
    )
    (asserts! (or (is-eq (get status job) STATUS-OPEN)
                  (is-eq (get status job) STATUS-BACKED))
              ERR-BAD-STATUS)
    (asserts! (< stacks-block-height (get deadline-block job)) ERR-FUNDING-WINDOW-CLOSED)
    ;; Lock must be live right now (locked funds, unexpired)...
    (asserts! (contract-call? 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
                              has-locked-funds (get newcomer job))
              ERR-NOT-FUNDED)
    ;; ...cover the full job value...
    (asserts! (>= (get locked-balance nv) (get job-value job)) ERR-NOT-FUNDED)
    ;; ...and belong to THIS job's cycle (ends by the job deadline, and not
    ;; before the job's evidence floor).
    (asserts! (<= (get lock-until-block nv) (get deadline-block job)) ERR-NOT-FUNDED)
    (asserts! (>= (get lock-until-block nv) (get backed-block job)) ERR-NOT-FUNDED)
    (map-set jobs job-id (merge job { funded: true }))
    (print { event: "confirm-funding", job-id: job-id, newcomer: (get newcomer job) })
    (ok true)
  )
)

;; Permissionless resolution (architecture sec.4). Callable by anyone (the keeper)
;; once the deadline block is reached; the OUTCOME is fixed by chain state, so
;; a permissionless caller cannot bias it. Idempotent: a settled/ghosted job
;; cannot be re-resolved. Disbursement is attempted inline; if the coordinator
;; vault's shared lock is still active (overlapping later job), the outcome is
;; still recorded and `disburse` retries the payout later.
(define-public (resolve (job-id uint) (token <sip-010-trait>))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND)))
    (asserts! (is-eq (contract-of token) TOKEN-CONTRACT) ERR-WRONG-TOKEN)
    (asserts! (not (or (is-eq (get status job) STATUS-SETTLED)
                       (is-eq (get status job) STATUS-GHOSTED)))
              ERR-ALREADY-RESOLVED)
    (asserts! (>= stacks-block-height (get deadline-block job)) ERR-DEADLINE-NOT-REACHED)
    (let
      (
        (nv (contract-call? 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2
                            get-vault-state (get newcomer job)))
        ;; Fallback for jobs never snapshotted: the newcomer's vault still
        ;; shows a cycle bound to THIS job (lock ended by the deadline, began
        ;; no earlier than the evidence floor, full value still present).
        (live-evidence (and (> (get lock-until-block nv) u0)
                            (<= (get lock-until-block nv) (get deadline-block job))
                            (>= (get lock-until-block nv) (get backed-block job))
                            (>= (get total-balance nv) (get job-value job))))
        (clean (or (get funded job) live-evidence))
        (paid (try! (try-disburse token
                                  (get client job)
                                  (get newcomer job)
                                  (get backer job)
                                  (get job-value job)
                                  (get stake-amount job)
                                  (get escrow-amount job)
                                  clean)))
      )
      (map-set jobs job-id (merge job {
        status: (if clean STATUS-SETTLED STATUS-GHOSTED),
        disbursed: paid
      }))
      (if clean
        (begin
          (bump-standing (get newcomer job))
          (match (get backer job) b (bump-standing b) true)
        )
        true
      )
      (print { event: "resolve", job-id: job-id,
               outcome: (if clean STATUS-SETTLED STATUS-GHOSTED),
               disbursed: paid,
               newcomer-vault-lock-until: (get lock-until-block nv) })
      (ok (if clean STATUS-SETTLED STATUS-GHOSTED))
    )
  )
)

;; Permissionless payout retry for a resolved job whose funds were still under
;; the coordinator vault's shared lock at resolve time.
(define-public (disburse (job-id uint) (token <sip-010-trait>))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND)))
    (asserts! (is-eq (contract-of token) TOKEN-CONTRACT) ERR-WRONG-TOKEN)
    (asserts! (or (is-eq (get status job) STATUS-SETTLED)
                  (is-eq (get status job) STATUS-GHOSTED))
              ERR-NOT-RESOLVED)
    (asserts! (not (get disbursed job)) ERR-ALREADY-DISBURSED)
    (let
      (
        (paid (try! (try-disburse token
                                  (get client job)
                                  (get newcomer job)
                                  (get backer job)
                                  (get job-value job)
                                  (get stake-amount job)
                                  (get escrow-amount job)
                                  (is-eq (get status job) STATUS-SETTLED))))
      )
      (asserts! paid ERR-STILL-LOCKED)
      (map-set jobs job-id (merge job { disbursed: true }))
      (print { event: "disburse", job-id: job-id })
      (ok true)
    )
  )
)

;; ========================
;; Read-only functions
;; ========================

;; The FlowVault routing params the NEWCOMER should submit for their deposit,
;; given current backing (architecture sec.3). lockAmount never drops below
;; job-value -- the improvement is timing only.
(define-read-only (read-terms (job-id uint))
  (let ((job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND)))
    (ok {
      lock-amount: (get job-value job),
      lock-until-block: (improved-lock-until (get deadline-block job)
                                             (get job-value job)
                                             (get stake-amount job)),
      split-address: none,
      split-amount: u0
    })
  )
)

;; Per-party disbursement of a resolved job (architecture sec.4):
;;   settled -> newcomer is paid job-value; backer receives stake + 2% reward
;;              (reward returns to the client if the job was never backed)
;;   ghosted -> the wronged client receives their escrow back + the slashed stake
(define-read-only (read-resolution (job-id uint))
  (let
    (
      (job (unwrap! (map-get? jobs job-id) ERR-JOB-NOT-FOUND))
      (reward (- (get escrow-amount job) (get job-value job)))
    )
    (if (is-eq (get status job) STATUS-SETTLED)
      (ok {
        newcomer-amount: (get job-value job),
        backer-amount: (match (get backer job) b (+ (get stake-amount job) reward) u0),
        client-amount: (match (get backer job) b u0 reward),
        disbursed: (get disbursed job)
      })
      (if (is-eq (get status job) STATUS-GHOSTED)
        (ok {
          newcomer-amount: u0,
          backer-amount: u0,
          client-amount: (+ (get escrow-amount job) (get stake-amount job)),
          disbursed: (get disbursed job)
        })
        ERR-NOT-RESOLVED
      )
    )
  )
)

;; What a client must escrow to open a job of a given value.
(define-read-only (read-escrow (job-value uint))
  (/ (* job-value (+ u100 REWARD-PCT)) u100)
)

(define-read-only (get-job (job-id uint))
  (map-get? jobs job-id)
)

(define-read-only (get-job-count)
  (var-get job-nonce)
)

(define-read-only (get-standing (who principal))
  (default-to { clean-completions: u0 } (map-get? standing who))
)
