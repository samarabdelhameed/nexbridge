import { l2 } from "../config/chains.js";
import { startChainListener } from "./listener.js";

/** Start the L2 (Abstract Testnet) deposit listener. */
export function startL2Listener(): () => void {
  return startChainListener(l2);
}
