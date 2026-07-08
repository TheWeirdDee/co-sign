import type { Metadata } from "next";
import { DocHead, PrevNext } from "../shared";

export const metadata: Metadata = {
  title: "For developers",
  description:
    "Run Co-Sign locally (contracts, keeper, web) and integrate the primitive from your own Stacks app.",
};

export default function Page() {
  return (
    <>
      <DocHead
        slug="developers"
        lede="Run the three pieces locally, or integrate the primitive from your own app — no permission needed."
      />
      <section className="doc-sec" style={{ borderBottom: "none" }}>
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
          The contract has no admin keys and no allowlist — integration is plain contract
          calls. A marketplace calls <code>create-job</code> from its hire flow and exposes{" "}
          <code>co-sign</code> to vouchers; a DAO reads <code>get-standing</code> to gate
          grants on &quot;N clean cycles backed by real staked capital&quot; — a signal that
          is expensive to fake by construction. You never run settlement infrastructure:{" "}
          <code>resolve</code>/<code>disburse</code> are permissionless, so any keeper
          settles all jobs.
        </p>
        <div className="doc-note">
          Wallet mode only: the frontend signs everything through{" "}
          <code>@stacks/connect</code> (<code>stx_callContract</code>). Sender keys never
          touch the browser.
        </div>
      </section>
      <PrevNext slug="developers" />
    </>
  );
}
