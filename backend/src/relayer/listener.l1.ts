import { l1 } from "../config/chains.js";
import { startChainListener } from "./listener.js";

/** Start the L1 (Sepolia) deposit listener. */
export function startL1Listener(): () => void {
  return startChainListener(l1);
}
