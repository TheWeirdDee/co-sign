"use client";

import { useCallback, useEffect, useState } from "react";
import { connect, disconnect, getLocalStorage, isConnected } from "@stacks/connect";
import {
  flowVaultRead,
  isStxAddress,
  FLOWVAULT_PRINCIPAL,
  TOKEN_PRINCIPAL,
  NETWORK,
  READ_CONTEXT_ADDRESS,
} from "@/lib/flowvault";

// Phase 0 proof page: wallet connects and resolves an STX address; a live
// read-only getCurrentBlockHeight call renders on screen. No Co-Sign logic yet.
export default function Phase0() {
  const [stxAddress, setStxAddress] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const resolveAddress = useCallback(() => {
    const stored = getLocalStorage();
    const stx = stored?.addresses?.stx?.[0]?.address ?? null;
    if (!stx) {
      setStxAddress(null);
      return;
    }
    if (!isStxAddress(stx)) {
      setAddressError(`Rejected non-STX address: ${stx}`);
      setStxAddress(null);
      return;
    }
    setAddressError(null);
    setStxAddress(stx);
  }, []);

  useEffect(() => {
    if (isConnected()) resolveAddress();
  }, [resolveAddress]);

  const refreshBlockHeight = useCallback(async () => {
    setBlockError(null);
    try {
      const vault = flowVaultRead();
      const height = await vault.getCurrentBlockHeight(stxAddress ?? READ_CONTEXT_ADDRESS);
      setBlockHeight(height);
    } catch (e) {
      setBlockError(e instanceof Error ? e.message : String(e));
    }
  }, [stxAddress]);

  useEffect(() => {
    refreshBlockHeight();
    const timer = setInterval(refreshBlockHeight, 30_000);
    return () => clearInterval(timer);
  }, [refreshBlockHeight]);

  const handleConnect = async () => {
    setConnecting(true);
    setAddressError(null);
    try {
      await connect();
      resolveAddress();
    } catch (e) {
      setAddressError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setStxAddress(null);
  };

  return (
    <main className="flex-1 flex items-center justify-center bg-[#0E1116] text-[#E8E2D2] font-mono">
      <div className="w-full max-w-xl border border-[#2A2F37] bg-[#161B22] p-8 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="tracking-widest text-sm">CO·SIGN — PHASE 0</h1>
          {stxAddress ? (
            <button
              onClick={handleDisconnect}
              className="border border-[#2A2F37] px-3 py-1 text-xs hover:border-[#9A968B] focus:outline focus:outline-[#A8823D]"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="border border-[#2A2F37] px-3 py-1 text-xs hover:border-[#9A968B] focus:outline focus:outline-[#A8823D] disabled:opacity-50"
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </header>

        <dl className="space-y-4 text-xs">
          <div>
            <dt className="text-[#9A968B]">Connected STX address</dt>
            <dd className="break-all">{stxAddress ?? "— not connected —"}</dd>
            {addressError && <dd className="text-[#8B2635]">{addressError}</dd>}
          </div>
          <div>
            <dt className="text-[#9A968B]">
              Live testnet block height (FlowVault getCurrentBlockHeight)
            </dt>
            <dd className="text-2xl text-[#A8823D]">
              {blockHeight !== null ? blockHeight.toLocaleString() : "…"}
            </dd>
            {blockError && <dd className="text-[#8B2635] break-all">{blockError}</dd>}
          </div>
          <div>
            <dt className="text-[#9A968B]">FlowVault contract</dt>
            <dd className="break-all">{FLOWVAULT_PRINCIPAL}</dd>
          </div>
          <div>
            <dt className="text-[#9A968B]">Token</dt>
            <dd className="break-all">{TOKEN_PRINCIPAL}</dd>
          </div>
          <div>
            <dt className="text-[#9A968B]">Network</dt>
            <dd>{NETWORK}</dd>
          </div>
        </dl>

        <a href="/flows" className="inline-block text-[#A8823D] underline text-xs">
          Phase 2 flow driver →
        </a>
      </div>
    </main>
  );
}
