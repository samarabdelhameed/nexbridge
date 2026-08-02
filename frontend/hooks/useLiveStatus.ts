"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { io, type Socket } from "socket.io-client";
import { api, type BridgeTransaction } from "@/lib/api";

/**
 * Subscribe to live status updates from the backend Socket.IO gateway.
 * The hook joins the room for the connected wallet and stores the latest
 * update per source transaction hash.
 */
export function useLiveStatus() {
  const { address } = useAccount();
  const socketRef = useRef<Socket | null>(null);
  const [updates, setUpdates] = useState<Record<string, BridgeTransaction>>({});

  useEffect(() => {
    if (!address) {
      setUpdates({});
      return;
    }

    const socket = io(api.baseUrl, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("subscribe:user", address.toLowerCase());
    });

    socket.on("tx:update", (tx: BridgeTransaction) => {
      setUpdates((prev) => ({ ...prev, [tx.sourceTxHash]: tx }));
    });

    socket.on("connect_error", () => {
      // Backend may be offline; ignore — history is still fetched via REST.
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [address]);

  return { updates, latest: (sourceTxHash: string) => updates[sourceTxHash] };
}
