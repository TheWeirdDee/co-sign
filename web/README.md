# Co-Sign — web reference implementation

Next.js app driving the Co-Sign coordinator + FlowVault on Stacks testnet.
Wallet mode only: every write is signed by the connected browser wallet
(Leather/Xverse) via `@stacks/connect` `stx_callContract`. Sender keys never
touch this codebase.

## Run

```bash
npm install
cp .env.example .env.local   # already filled with the live testnet principals
npm run dev
```

- `/` — Phase 0 proof: wallet connect (STX address only) + live
  `getCurrentBlockHeight` read through `flowvault-sdk`.
- `/flows` — Phase 2 crude flow driver: create-job, co-sign, newcomer deposit
  (terms from `read-terms`), resolve, disburse. Every write logs a tx id +
  explorer link; the job panel shows the three FlowVault reads
  (`getCurrentBlockHeight`, `lockUntilBlock`, `hasLockedFunds`) live.

## Structure

```
src/lib/flowvault.ts   FlowVault SDK wrapper (read client + wallet-executor client)
src/lib/cosign.ts      coordinator contract calls + typed read-onlys
src/app/page.tsx       Phase 0 pipes proof
src/app/flows/page.tsx Phase 2 flow driver (replaced by the real UI in Phase 4)
```

Environment (see `.env.example`): FlowVault + token principals per architecture
§0, `NEXT_PUBLIC_COSIGN_CONTRACT` set to the deployed coordinator.
