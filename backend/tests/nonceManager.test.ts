import { describe, it, expect, beforeEach } from "vitest";
import { NonceManager } from "../src/relayer/nonceManager.js";

describe("NonceManager", () => {
  let manager: NonceManager;

  beforeEach(() => {
    manager = new NonceManager();
  });

  it("acquires a hash once", () => {
    expect(manager.tryAcquire("0xabc")).toBe(true);
    expect(manager.tryAcquire("0xabc")).toBe(false);
  });

  it("allows acquisition again after release", () => {
    manager.tryAcquire("0xabc");
    manager.release("0xabc");
    expect(manager.tryAcquire("0xabc")).toBe(true);
  });

  it("tracks size", () => {
    manager.tryAcquire("0xa");
    manager.tryAcquire("0xb");
    expect(manager.size).toBe(2);
    manager.clear();
    expect(manager.size).toBe(0);
  });
});
