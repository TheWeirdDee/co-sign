import type { Metadata } from "next";
import { DocHead, PrevNext } from "../shared";

export const metadata: Metadata = {
  title: "Troubleshooting",
  description:
    "Wallet not connecting, failing transactions, stale boards, deferred payouts — the fixes.",
};

export default function Page() {
  return (
    <>
      <DocHead slug="troubleshooting" lede="The six things that actually go wrong, and what each one means." />
      <section className="doc-sec" style={{ borderBottom: "none" }}>
        <ul>
          <li>
            <b>My address didn&apos;t appear after connecting</b> — hard refresh (Ctrl/Cmd +
            Shift + R) and connect again. Make sure the wallet account is on <b>Testnet</b>{" "}
            and is an <code>ST…</code> (STX) account, not a BTC address.
          </li>
          <li>
            <b>A transaction fails or the wallet shows an error</b> — the sending account is
            usually out of USDCx (the amount being escrowed/staked) or STX (gas). Top up and
            retry.
          </li>
          <li>
            <b>&quot;This worker already has a live instrument&quot;</b> — one job per worker
            at a time (their vault is the completion oracle). Settle the live one first.
          </li>
          <li>
            <b>The board looks stale or logs CORS errors</b> — that is the public Hiro API
            rate-limiting reads, not a bug in the flow. The app throttles and caches; wait
            for the next poll or refresh once.
          </li>
          <li>
            <b>A settled job says &quot;payout releasing&quot;</b> — its funds share the
            vault&apos;s lock with a later job (overlap case). The outcome is already fixed;
            the keeper submits <code>disburse</code> the moment the lock expires.
          </li>
          <li>
            <b>The deadline passed but nothing happened</b> — resolution is a transaction
            someone must submit. The keeper does it within a poll interval; or click{" "}
            <b>resolve</b> on the job page yourself — it&apos;s permissionless.
          </li>
        </ul>
        <div className="doc-note">
          Still stuck? Open an issue on{" "}
          <a href="https://github.com/TheWeirdDee/co-sign" target="_blank" rel="noreferrer">
            GitHub
          </a>{" "}
          — include the transaction id from the job page&apos;s tx log.
        </div>
      </section>
      <PrevNext slug="troubleshooting" />
    </>
  );
}
