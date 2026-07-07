;; mock-usdcx.clar -- TEST-ONLY SIP-010 token with open mint.
;; Stands in for ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx in simnet
;; tests (the real token's mint is role-gated). NEVER deployed to testnet.

(impl-trait 'STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.sip-010-trait.sip-010-trait)

(define-fungible-token mock-usdcx)

(define-constant ERR-NOT-OWNER (err u4))

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)) ERR-NOT-OWNER)
    (ft-transfer? mock-usdcx amount sender recipient)
  )
)

(define-read-only (get-name) (ok "Mock USDCx"))
(define-read-only (get-symbol) (ok "mUSDCx"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance mock-usdcx who)))
(define-read-only (get-total-supply) (ok (ft-get-supply mock-usdcx)))
(define-read-only (get-token-uri) (ok none))

(define-public (mint (amount uint) (recipient principal))
  (ft-mint? mock-usdcx amount recipient)
)
