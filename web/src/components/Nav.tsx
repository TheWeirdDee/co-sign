"use client";

import Link from "next/link";
import { short, useWallet } from "@/hooks/useWallet";

export default function Nav() {
  const { address, connecting, connect, disconnect } = useWallet();
  return (
    <nav>
      <Link href="/" className="wordmark">
        CO<span className="dot">·</span>SIGN
      </Link>
      <div className="nav-right">
        <span className="tag">Stacks testnet</span>
        {address ? (
          <button className="connect linked" onClick={disconnect} title="Disconnect">
            {short(address)}
          </button>
        ) : (
          <button className="connect" onClick={connect} disabled={connecting}>
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        )}
      </div>
    </nav>
  );
}
