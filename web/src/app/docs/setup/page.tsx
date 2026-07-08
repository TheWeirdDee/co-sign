import type { Metadata } from "next";
import { DocHead, PrevNext, USDCX } from "../shared";

export const metadata: Metadata = {
  title: "One-time setup",
  description:
    "Wallet install, free testnet STX, testnet USDCx, and the live app — about 10 minutes from a blank machine.",
};

export default function Page() {
  return (
    <>
      <DocHead slug="setup" lede="About 10 minutes, once. All of it is free testnet play money." />
      <section className="doc-sec" style={{ borderBottom: "none" }}>
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
                . Create an account and switch the network to <b>Testnet</b>. Your address
                starts with <code>ST…</code>.
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
                , paste your <code>ST…</code> address, request STX. Play money — no real
                value.
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
          Want to be all three parties yourself? Create two or three accounts in the same
          wallet and fund each — you can play client, backer, and worker across them and
          watch the full lifecycle.
        </div>
      </section>
      <PrevNext slug="setup" />
    </>
  );
}
