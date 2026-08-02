/**
 * In-memory idempotency guard for deposit events.
 *
 * The relayer may observe the same Deposited log more than once (reconnects,
 * multiple confirmations, restart with catch-up). `nonceManager` tracks which
 * source transaction hashes are currently being processed so a single deposit
 * is never released twice.
 */
export class NonceManager {
  private processing = new Set<string>();

  tryAcquire(sourceTxHash: string): boolean {
    if (this.processing.has(sourceTxHash)) return false;
    this.processing.add(sourceTxHash);
    return true;
  }

  release(sourceTxHash: string): void {
    this.processing.delete(sourceTxHash);
  }

  get size(): number {
    return this.processing.size;
  }

  clear(): void {
    this.processing.clear();
  }
}

export const nonceManager = new NonceManager();
