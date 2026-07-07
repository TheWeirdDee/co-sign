"use client";

import { useCallback, useEffect, useState } from "react";
import { connect, disconnect, getLocalStorage, isConnected } from "@stacks/connect";
import { isStxAddress } from "@/lib/flowvault";

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const resolve = useCallback(() => {
    const stx = getLocalStorage()?.addresses?.stx?.[0]?.address ?? null;
    setAddress(stx && isStxAddress(stx) ? stx : null);
  }, []);

  useEffect(() => {
    if (isConnected()) resolve();
  }, [resolve]);

  const doConnect = useCallback(async () => {
    setConnecting(true);
    try {
      await connect();
      resolve();
    } finally {
      setConnecting(false);
    }
  }, [resolve]);

  const doDisconnect = useCallback(() => {
    disconnect();
    setAddress(null);
  }, []);

  return { address, connecting, connect: doConnect, disconnect: doDisconnect };
}

export const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
