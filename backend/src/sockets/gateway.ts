import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { logger } from "../utils/logger.js";

/**
 * Socket.IO gateway — pushes live transaction status updates to the frontend.
 *
 * Clients join a room per wallet address (`user:<address>`) so updates are only
 * delivered to the wallet they belong to. Payloads are also broadcast to a
 * global room for admins/observers when `GLOBAL_ROOM` is enabled.
 */
export class SocketGateway {
  private io: Server | null = null;

  /** Attach the Socket.IO server to the HTTP server. */
  attach(httpServer: HttpServer, opts?: { corsOrigin?: string }): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: opts?.corsOrigin ?? process.env.CORS_ORIGIN ?? "*",
        methods: ["GET", "POST"],
      },
    });

    this.io.on("connection", (socket) => {
      socket.on("subscribe:user", (address: string) => {
        if (typeof address !== "string" || !address.startsWith("0x")) return;
        socket.join(`user:${address.toLowerCase()}`);
        logger.debug({ socket: socket.id, address }, "client subscribed to user room");
      });

      socket.on("subscribe:global", () => {
        socket.join("global");
      });
    });

    logger.info("socket gateway attached");
  }

  /** Emit a status change for a single transaction to interested clients. */
  emitUpdate(payload: {
    id: string;
    userAddress: string;
    direction: string;
    amount: string;
    amountHuman: string;
    sourceTxHash: string;
    destTxHash?: string | null;
    status: string;
    errorMessage?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): void {    if (!this.io) return;
    const room = `user:${payload.userAddress.toLowerCase()}`;
    this.io.to(room).emit("tx:update", payload);
    this.io.to("global").emit("tx:update", payload);
  }

  get connectedClients(): number {
    return this.io?.engine.clientsCount ?? 0;
  }
}

export const socketGateway = new SocketGateway();
