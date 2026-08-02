# NexBridge — Sepolia ⇄ Abstract Testnet ETH Bridge

> Project codename: **NexBridge**
> Type: Relayer-based Lock-and-Release cross-chain ETH bridge (L1 ⇄ L2 testnet)
> Reference concept: Abstract's native bridge (native-bridge.abs.xyz) — rebuilt from scratch with original code, original architecture naming, and a fully custom UI/UX.

---

## 1. Project Overview

NexBridge lets a user move **test ETH** between two chains for the same wallet address:

- **L1 → L2**: Sepolia → Abstract Testnet
- **L2 → L1**: Abstract Testnet → Sepolia

Because these are testnets, the safest and simplest architecture (and the one actually used by most custom/hackathon bridges, as opposed to a full rollup-native message-passing bridge which requires the L2's actual sequencer/proof infrastructure) is a **Lock-and-Release model with an off-chain relayer**:

1. User locks ETH in a smart contract on the source chain.
2. A backend relayer service detects the `Deposit` event.
3. The relayer (holding a funded relayer wallet on the destination chain) calls `release()` on the destination chain's contract, sending the equivalent ETH to the same user address.
4. Every step is logged, has a status (`PENDING → CONFIRMED → RELEASED → FAILED`), and is shown live in the frontend.

This is a legitimate, well-known bridge pattern (lock/release + relayer), distinct from and simpler than the actual rollup canonical bridge, which is appropriate for a testnet demo/portfolio project.

---

## 2. Full Technical Prompt (paste this into antigravity)

```
You are building "NexBridge" — a full-stack cross-chain ETH bridge between Sepolia (Ethereum L1 testnet) and Abstract Testnet (L2), using a lock-and-release architecture with an off-chain relayer.

GOALS:
1. Smart contracts (Solidity, Hardhat) deployed to both Sepolia and Abstract Testnet:
   - L1Vault.sol on Sepolia: accepts ETH deposits via deposit(), emits Deposited(address user, uint256 amount, uint256 nonce), has an onlyRelayer release(address to, uint256 amount, uint256 nonce) function, tracks processed nonces to prevent replay, is Ownable + Pausable.
   - L2Vault.sol on Abstract Testnet: mirrors L1Vault.sol exactly (same interface), deployed and pre-funded by the project owner with test ETH liquidity so it can release funds when someone bridges from L1.
   - Both contracts must have: nonReentrant guards, event logs with full details, admin functions (pause, withdraw emergency, set relayer address), and full NatSpec comments.
2. Backend (Node.js + TypeScript + Express + PostgreSQL via Prisma):
   - Relayer service using viem or ethers.js v6, running two listeners (one per chain) subscribed to Deposited events via WebSocket RPC.
   - On event: write a transaction row to Postgres with status PENDING, wait for N confirmations, move to CONFIRMED, then submit release() on the destination chain, then move to RELEASED (or FAILED with retry/backoff logic).
   - REST API: 
     GET /api/transactions/:address — full bridge history for a wallet
     GET /api/transaction/:txHash — status of one transfer
     GET /api/stats — total volume bridged, tx count, per-direction breakdown
     GET /api/health — relayer + RPC health check
   - WebSocket channel (socket.io) pushing live status updates to the frontend as a transfer progresses.
   - Rate limiting, request validation (zod), structured logging (pino).
3. Frontend (Next.js 14 App Router + TypeScript + Tailwind + wagmi v2 + viem + RainbowKit):
   - Wallet connect (MetaMask, WalletConnect, Coinbase Wallet).
   - Bridge screen: direction toggle (Sepolia → Abstract Testnet / Abstract Testnet → Sepolia), amount input with balance + max button, gas estimate, network auto-switch prompts, a big "Bridge" button that calls deposit() on the source chain, then shows a live progress tracker (Deposit confirmed → Relayer picked up → Released on destination) driven by the WebSocket channel.
   - Transaction history table with filters, explorer links.
   - Custom, original visual design (dark theme, distinct color system, motion on the progress tracker) — do NOT copy Abstract's actual visual design, only the functional concept.
   - Fully responsive, accessible, with toast notifications and error states for wrong network, insufficient balance, and RPC failures.
4. Real data integration: All balances, transaction statuses, and history must come from the real Sepolia/Abstract Testnet RPCs and the backend database — no mocked or hardcoded data anywhere in production code paths.
5. DevOps: Docker Compose for backend + Postgres, .env.example for every service, GitHub Actions CI (lint + test + build) for contracts, backend, and frontend.

Build this fully from scratch, incrementally: contracts first (with Hardhat tests), then backend relayer + API, then frontend, then wire the full integration end to end, then containerize.
```

---

## 3. Repo Structure

```
nexbridge/
├── contracts/
│   ├── src/
│   │   ├── L1Vault.sol
│   │   ├── L2Vault.sol
│   │   └── interfaces/
│   │       └── IVault.sol
│   ├── script/
│   │   ├── DeployL1.s.sol
│   │   └── DeployL2.s.sol
│   ├── test/
│   │   ├── L1Vault.t.sol
│   │   └── L2Vault.t.sol
│   ├── hardhat.config.ts
│   ├── foundry.toml
│   └── .env.example
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── chains.ts          # RPC URLs, chain IDs, contract addresses
│   │   ├── relayer/
│   │   │   ├── listener.l1.ts     # watches L1Vault Deposited events
│   │   │   ├── listener.l2.ts     # watches L2Vault Deposited events
│   │   │   ├── release.ts         # signs & submits release() tx
│   │   │   └── nonceManager.ts
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── transactions.ts
│   │   │   │   ├── stats.ts
│   │   │   │   └── health.ts
│   │   │   └── middleware/
│   │   │       ├── rateLimit.ts
│   │   │       └── validate.ts
│   │   ├── db/
│   │   │   ├── prisma/schema.prisma
│   │   │   └── client.ts
│   │   ├── sockets/
│   │   │   └── gateway.ts         # socket.io live status push
│   │   ├── utils/logger.ts
│   │   └── index.ts               # app entrypoint
│   ├── prisma/migrations/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Bridge screen
│   │   ├── history/page.tsx
│   │   └── stats/page.tsx
│   ├── components/
│   │   ├── BridgeCard.tsx
│   │   ├── DirectionToggle.tsx
│   │   ├── AmountInput.tsx
│   │   ├── ProgressTracker.tsx
│   │   ├── TxHistoryTable.tsx
│   │   ├── WalletButton.tsx
│   │   └── ui/                     # buttons, inputs, toasts (shadcn-style, custom theme)
│   ├── hooks/
│   │   ├── useBridge.ts
│   │   ├── useBalances.ts
│   │   └── useLiveStatus.ts        # socket.io client hook
│   ├── lib/
│   │   ├── wagmi.config.ts
│   │   ├── contracts.ts            # ABI + addresses
│   │   └── api.ts                  # backend REST client
│   ├── styles/globals.css
│   ├── public/
│   ├── next.config.js
│   └── .env.example
│
├── docker-compose.yml               # orchestrates postgres + backend + (optional) frontend
├── .github/workflows/ci.yml
└── README.md
```

---

## 4. Smart Contracts — What Each File Does

### `L1Vault.sol` / `L2Vault.sol` (identical interface, deployed separately)
- `deposit()` — `payable`, locks the sender's ETH, emits `Deposited(user, amount, nonce)`, increments a global nonce.
- `release(address to, uint256 amount, uint256 nonce)` — `onlyRelayer`, checks `nonce` hasn't been used, sends ETH to `to`, emits `Released(to, amount, nonce)`.
- `setRelayer(address newRelayer)` — `onlyOwner`.
- `pause()` / `unpause()` — `onlyOwner`, blocks `deposit()`/`release()` while paused.
- `emergencyWithdraw()` — `onlyOwner`, only usable when paused, for stuck-funds recovery.
- Uses OpenZeppelin's `Ownable`, `Pausable`, `ReentrancyGuard`.

### `IVault.sol`
- Shared interface so backend/frontend can use one ABI type for both chains.

---

## 5. Backend — What Each Piece Does

- **listener.l1.ts / listener.l2.ts**: subscribe via WebSocket RPC to `Deposited` events, write `PENDING` row to Postgres, wait for confirmations, flip to `CONFIRMED`.
- **release.ts**: relayer wallet (funded on both chains) submits `release()` on the *other* chain once a deposit is `CONFIRMED`; updates row to `RELEASED` or `FAILED` (with retry queue).
- **transactions.ts / stats.ts routes**: expose the Postgres data to the frontend.
- **gateway.ts**: pushes live status changes to connected frontend clients per wallet address room.
- **Prisma schema**: single `BridgeTransaction` table — `id, userAddress, direction, amount, sourceTxHash, destTxHash, nonce, status, createdAt, updatedAt`.

---

## 6. Frontend — What Each Piece Does

- **BridgeCard.tsx**: main widget — direction toggle, amount input, submit button.
- **ProgressTracker.tsx**: 3-step live tracker driven by `useLiveStatus` (socket.io).
- **useBridge.ts**: wraps `wagmi`'s `useWriteContract` to call `deposit()` on the selected chain, handles network switching.
- **TxHistoryTable.tsx**: pulls `/api/transactions/:address`, shows explorer links (Sepolia + Abstract explorers).
- Custom Tailwind theme (own color tokens, own type scale) — not a copy of Abstract's site design.

---

## 7. Suggested Env Variables (per service)

```
# contracts/.env
SEPOLIA_RPC_URL=
ABSTRACT_TESTNET_RPC_URL=
DEPLOYER_PRIVATE_KEY=

# backend/.env
DATABASE_URL=postgresql://...
SEPOLIA_WS_RPC_URL=
ABSTRACT_TESTNET_WS_RPC_URL=
RELAYER_PRIVATE_KEY=
L1_VAULT_ADDRESS=
L2_VAULT_ADDRESS=

# frontend/.env
NEXT_PUBLIC_L1_VAULT_ADDRESS=
NEXT_PUBLIC_L2_VAULT_ADDRESS=
NEXT_PUBLIC_BACKEND_URL=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

---

## 8. Build Order (recommended for antigravity to follow)

1. `contracts/` — write + test `L1Vault.sol`/`L2Vault.sol` with Hardhat, deploy to both testnets, verify on explorers.
2. `backend/` — Prisma schema + migrations, listeners, release logic, REST API, socket gateway.
3. `frontend/` — wallet connect, bridge form, wire to contracts directly (write) + backend (read/status).
4. End-to-end test: real deposit on Sepolia → watch relayer fire → confirm release on Abstract Testnet → confirm UI updates live.
5. Dockerize backend + Postgres, write README with setup steps.

---

### Notes
- Relayer wallets on both chains need to be pre-funded with testnet ETH so `release()` has liquidity to send.
- This is a testnet-only demo architecture (centralized relayer). If this ever needs to go to mainnet or handle real value, it would need a decentralized/multi-sig relayer set or a real rollup message-passing bridge instead of a single relayer key — worth flagging in the README as a known limitation.
