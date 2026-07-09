"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { short, useWallet } from "@/hooks/useWallet";

export default function Nav() {
  const { address, connecting, connect, disconnect } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  const handleConnect = async () => {
    await connect();
    // connecting means you want to act — take the user to the board
    if (pathname === "/") router.push("/board");
  };

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Your address:", address);
    }
  };

  return (
    <nav>
      <Link href="/" className="wordmark">
        CO<span className="dot">·</span>SIGN
      </Link>
      <div className="nav-links">
        <Link href="/board">The board</Link>
        <Link href="/#how">How it works</Link>
        <Link href="/docs">Docs</Link>
      </div>
      <div className="nav-right">
        <span className="tag">Stacks testnet</span>
        {address ? (
          <span className="wallet-chip">
            <button className="connect linked" onClick={copyAddress} title="Copy your address">
              {copied ? "copied ✓" : short(address)}
            </button>
            <button
              className="disc"
              onClick={disconnect}
              title="Disconnect wallet"
              aria-label="Disconnect wallet"
            >
              ⏻
            </button>
          </span>
        ) : (
          <button className="connect" onClick={handleConnect} disabled={connecting}>
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        )}
      </div>
    </nav>
  );
}
