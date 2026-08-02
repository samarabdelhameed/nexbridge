import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  type Account,
  type Address,
  type Chain,
  type HttpTransport,
  type PublicClient,
  type WalletClient,
  type WebSocketTransport,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { ChainConfig } from "../config/chains.js";
import { logger } from "../utils/logger.js";

type ClientTransport = HttpTransport | WebSocketTransport;
type PublicClientFor = PublicClient<ClientTransport>;
type WalletClientFor = WalletClient<ClientTransport, Chain, Account>;

const publicClients = new Map<string, PublicClientFor>();
const walletClients = new Map<string, WalletClientFor>();

export function getPublicClient(config: ChainConfig): PublicClientFor {
  const existing = publicClients.get(config.label);
  if (existing) return existing;

  const transport = config.wsUrl ? webSocket(config.wsUrl) : http(config.rpcUrl);
  const client = createPublicClient({ chain: config.chain, transport });
  publicClients.set(config.label, client);
  return client;
}

export function getRelayerAccount(): { address: Address } {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) {
    throw new Error("RELAYER_PRIVATE_KEY is not set");
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  return { address: account.address };
}

export function getRelayerWalletClient(config: ChainConfig): WalletClientFor {
  const existing = walletClients.get(config.label);
  if (existing) return existing;

  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) {
    throw new Error("RELAYER_PRIVATE_KEY is not set");
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  const transport = config.wsUrl ? webSocket(config.wsUrl) : http(config.rpcUrl);
  const client = createWalletClient({
    chain: config.chain as Chain,
    account,
    transport,
  });
  walletClients.set(config.label, client as unknown as WalletClientFor);
  return client as unknown as WalletClientFor;
}

export function logClientHealth(config: ChainConfig): void {
  const client = getPublicClient(config);
  client
    .getBlockNumber()
    .then((n) => logger.info({ chain: config.label, block: n.toString() }, "rpc connected"))
    .catch((err) => logger.error({ chain: config.label }, `rpc error: ${(err as Error).message}`));
}
