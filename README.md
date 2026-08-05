# NexBridge

**Lock-and-release cross-chain ETH bridge** — Sepolia (L1 testnet) ⇄ Abstract Testnet (L2), powered by an off-chain relayer. Built with Foundry (Solidity), Node.js/Express + Prisma, and a Next.js 14 + wagmi v2 + RainbowKit frontend.

[![Solidity](https://img.shields.io/badge/Solidity-^0.8.20-black?logo=solidity)](contracts)
[![Node](https://img.shields.io/badge/Node-22-339933?logo=node.js)](backend)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](frontend)
[![License](https://img.shields.io/badge/License-MIT-blue)](#license)

> Reference concept: Abstract's native bridge. Rebuilt from scratch with original code, architecture, and a fully custom UI/UX. A testnet demo — **not for real value**.

> **🟢 Live demo (Vercel):** https://nexbridge-jus4z1ydz-samarabdelhameeds-projects-df99c328.vercel.app
> The vaults run on **real testnets** (Sepolia + Abstract Testnet at `0x0bdccc047f288456dd7933026e5ff5a4bb49f4d1` on both). The backend relayer + API run locally on :8080, so the live link works while that machine is online.

---

## Table of contents

- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Quick start (local demo)](#quick-start-local-demo)
- [Project layout](#project-layout)
- [Configuration](#configuration)
- [Contracts](#contracts)
- [Backend](#backend)
- [Frontend](#frontend)
- [Testing](#testing)
- [Docker](#docker)
- [CI](#ci)
- [Known limitations](#known-limitations)
- [License](#license)

---

## How it works

The bridge moves test ETH between two EVM chains **for the same wallet address**, in both directions:

| Direction | Source | Destination |
| --- | --- | --- |
| `L1 → L2` | Sepolia | Abstract Testnet |
| `L2 → L1` | Abstract Testnet | Sepolia |

Because these are testnets, NexBridge uses the battle-tested **lock-and-release** pattern with an off-chain relayer (rather than a rollup-native message-passing bridge, which would require the L2's sequencer/proof infrastructure):

1. **Lock** — the user calls `deposit()` on the source-chain vault; ETH is locked and a `Deposited` event is emitted.
2. **Detect** — the backend relayer watches each chain for `Deposited` events and records the transfer.
3. **Confirm** — the relayer waits for the configured number of block confirmations.
4. **Release** — the relayer (a wallet funded on the destination chain) calls `release()`, transferring the equivalent ETH to the same user address. It waits for the transaction receipt before marking the transfer as `RELEASED`.
5. **Track live** — every step (`PENDING → CONFIRMED → RELEASING → RELEASED | FAILED`) is pushed to the frontend over Socket.IO and shown in the UI.

Replay protection is **per `(user, nonce)`**: each deposit increments a per-user nonce, and `release()` can only spend a given `(user, nonce)` pair once — a deposit can never be released twice, and both directions never collide.

---

## Architecture

```
                    ┌────────────── FRONTEND (Next.js 14) ──────────────┐
                    │  wallet connect · bridge form · live progress     │
                    └──────────────┬─────────────────┬──────────────────┘
                              deposit()             REST + Socket.IO
                                   │                      │
                    ┌──────────────▼──────────────────────▼──────────────────┐
                    │                   BACKEND (Express + Prisma)            │
                    │  listeners (viem) → confirmations → release() executor │
                    │  REST API (/api/transactions, /api/transaction,        │
                    │           /api/stats, /api/health)                     │
                    │  Socket.IO gateway (live per-wallet status)            │
                    └───────┬────────────────────────────────────┬───────────┘
                        L1Vault                                 L2Vault
                     (Sepolia)                          (Abstract Testnet)
                   deposit() locks                  release() unlocks & sends
                            ▲                             ▲
                            └─────────── relayer wallet (funded on both) ────────┘
```

---

## Quick start (local demo)

Everything runs locally with **zero external services** — two `anvil` chains, deployed vaults, backend, and frontend.

### Prerequisites

- Node.js ≥ 22 and npm
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `anvil`, `cast`)
- Google Chrome (for the real-user E2E)

### One command

```bash
git clone <repo-url>
cd NexBridge
npm install        # installs workspace tooling
cp .env.example .env   # local-anvil values already work out of the box
npm run dev        # idempotent: starts anvil L1+L2, deploys vaults, backend, frontend
```

Then open http://localhost:3000, connect a wallet pointed at one of the local anvil RPCs (e.g. MetaMask → `http://127.0.0.1:8545`), and bridge.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the full stack (idempotent). |
| `npm run status` | Health of anvil L1/L2, backend, frontend. |
| `npm run stop` | Stop everything. |
| `npm test` | Contracts + backend unit tests + frontend lint/build. |
| `npm run test:integration` | Full two-anvil relayer integration test. |
| `npm run dev` is safe to re-run — it only starts what is not already running. |

> **Funds are real.** The demo uses real anvil wallets pre-funded with 10k test ETH on both chains (see `.env`), real on-chain deposits, real relayer releases, and a real SQLite database. Nothing is mocked.

---

## Project layout

```
nexbridge/
├── contracts/            # Solidity vaults + Foundry tests + deploy scripts
├── backend/              # Relayer, REST API, Socket.IO gateway, Prisma
├── frontend/             # Next.js 14 app (wagmi v2 + RainbowKit + Tailwind)
├── scripts/              # local.sh (stack runner) + test.sh (verifier)
├── docker-compose.yml    # Postgres + backend + frontend
├── .github/workflows/    # CI
├── .env                  # single source of truth (see .env.example)
└── .env.example          # template for new clones
```

---

## Configuration

The **root `.env` is the single source of truth**. The backend loads it automatically (`backend/src/config/env.ts`: real process env wins → root `.env` → `backend/.env`), `scripts/local.sh` uses it to deploy vaults and start the stack, and it mirrors `NEXT_PUBLIC_*` into `frontend/.env.local`.

For a new clone, **`cp .env.example .env`** is enough for the local demo. Templates also exist at `backend/.env.example` and `frontend/.env.example`.

### Key variables

| Variable | Purpose |
| --- | --- |
| `L1_CHAIN_ID` / `L2_CHAIN_ID` | Chain IDs (11155111 Sepolia / 11124 Abstract Testnet). |
| `L1_RPC_URL` / `L2_RPC_URL` | Chain RPCs. |
| `L1_WS_URL` / `L2_WS_URL` | Optional WebSocket RPCs (fallback to HTTP polling). |
| `L1_VAULT_ADDRESS` / `L2_VAULT_ADDRESS` | Deployed vault addresses. |
| `L1_CONFIRMATIONS` / `L2_CONFIRMATIONS` | Block confirmations the relayer waits for. |
| `DEPLOYER_PRIVATE_KEY` | Deploys vaults (anvil #0 by default). |
| `RELAYER_PRIVATE_KEY` | Relayer wallet, **must be funded on both chains**. |
| `L2_LIQUIDITY_WEI` | Test ETH seeded into the L2 vault at deploy time. |
| `DATABASE_URL` | SQLite (`file:./dev.db`) locally; Postgres in Docker. |
| `PORT` / `HOST` | Backend listener (8080 / 0.0.0.0). |
| `NEXT_PUBLIC_*` | Frontend build-time config (vaults, RPCs, backend URL, WalletConnect). |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional; get one at [cloud.walletconnect.com](https://cloud.walletconnect.com). |

---

## Contracts

Two vaults with **identical interfaces** (`src/interfaces/IVault.sol`) sharing one implementation (`src/VaultBase.sol`):

| File | Purpose |
| --- | --- |
| `src/L1Vault.sol` | Deployed on Sepolia. |
| `src/L2Vault.sol` | Deployed on Abstract Testnet; pre-funded so it can release L1→L2 transfers. |
| `src/VaultBase.sol` | Shared logic: `deposit`, `release`, `setRelayer`, `pause`/`unpause`, `emergencyWithdraw`. OpenZeppelin `Ownable` + `Pausable` + `ReentrancyGuard`. |
| `test/` | 40 tests (fuzz + unit): deposit, release, replay protection, pause, emergency withdraw, access control. |

### Toolchain

Foundry. Install libraries, build, test:

```bash
cd contracts
git clone --depth 1 https://github.com/foundry-rs/forge-std.git lib/forge-std
git clone --depth 1 https://github.com/OpenZeppelin/openzeppelin-contracts.git lib/openzeppelin-contracts
forge build
forge test -vvv
```

### Deploy to testnets

```bash
forge script script/DeployL1.s.sol:DeployL1 --rpc-url "$SEPOLIA_RPC_URL" --broadcast --verify
forge script script/DeployL2.s.sol:DeployL2 --rpc-url "$ABSTRACT_TESTNET_RPC_URL" --broadcast --verify
```

> The relayer wallet must be funded on **both** chains and the L2 vault seeded with liquidity (the deploy script does this automatically).

---

## Backend

Node.js + TypeScript + Express + Prisma + viem + Socket.IO.

| Piece | File | What it does |
| --- | --- | --- |
| Chain config | `src/config/chains.ts` | RPC URLs, chain IDs, vault addresses, confirmations. |
| Listeners | `src/relayer/listener.ts`, `listener.l1.ts`, `listener.l2.ts` | Watch `Deposited` events → `PENDING` → confirmations → `CONFIRMED`. |
| Release executor | `src/relayer/release.ts` | Submits `release()` on the destination chain **and waits for the receipt** before reporting `RELEASED`, with retry/backoff. |
| Nonce manager | `src/relayer/nonceManager.ts` | In-memory idempotency guard against duplicate logs. |
| REST API | `src/api/routes/*` | History, single tx, stats, health. Zod-validated, rate-limited. |
| Live status | `src/sockets/gateway.ts` | Socket.IO push of status changes to per-wallet rooms. |
| DB | `prisma/` | `BridgeTransaction` model. SQLite (local) + PostgreSQL (Docker). |

### API

```
GET /api/transactions/:address?direction=&status=&limit=&offset=
GET /api/transaction/:txHash
GET /api/stats
GET /api/health
```

### Run locally

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate:dev
cp .env.example .env    # set RELAYER_PRIVATE_KEY + vault addresses
npm run dev             # http://localhost:8080
```

---

## Frontend

Next.js 14 (App Router) + TypeScript + Tailwind + **wagmi v2** + viem + **RainbowKit**.

- **Bridge screen** (`/`): direction toggle, amount input with real balance + MAX, wrong-network switch prompt, `Bridge` button calling `deposit()`, live 3-step progress tracker, gas estimate, toasts, and a **"New bridge"** reset after each completed transfer.
- **History** (`/history`): table with status/direction filters, explorer links, live-updating rows.
- **Stats** (`/stats`): total volume, per-direction counts, status breakdown.

All balances, statuses and history come from real RPCs + the backend — no mocked data in production paths.

### Run locally

```bash
cd frontend
npm install
cp .env.example .env.local    # vault addresses, RPCs, backend URL
npm run dev                   # http://localhost:3000
```

---

## Testing

| Layer | How |
| --- | --- |
| Contracts | `cd contracts && forge test` — 40 unit/fuzz tests. |
| Backend unit | `cd backend && npm test` (vitest). |
| Integration | `npm run test:integration` — spins up two anvil chains, deploys vaults, seeds liquidity, runs the real backend against a temp SQLite DB, performs real deposits in both directions and asserts on-chain balances. |
| Real-user E2E | `node /tmp/nexbridge-browser/e2e-user.mjs` (repo-private tooling) — drives the real UI with a headless Chrome + injected EIP-1193 wallet that really signs anvil transactions; verifies both directions against real on-chain balances and the backend DB. |

---

## Docker

Full stack (Postgres + backend + frontend):

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

- Backend: http://localhost:8080 (`/api/health`)
- Frontend: http://localhost:3000

---

## CI

`.github/workflows/ci.yml` runs on push/PR:

- **Contracts** — `forge build` + `forge test`
- **Backend** — lint, typecheck, unit tests, build, Prisma validate (Postgres) against a service container
- **Frontend** — `next lint` + `next build`

---

## Known limitations

- **Centralized relayer**: a single funded key executes releases. Safe for a testnet demo; real value would require a decentralized or multi-sig relayer set (or the L2's real rollup bridge).
- **Relayer liquidity**: the destination vault must hold enough ETH to cover outstanding deposits (seeded at deploy). Withdrawable by the owner via `emergencyWithdraw` (only while paused).
- **Testnet demo only** — funds are testnet ETH with no real value.

---

## License

MIT — see the repository license file for details.
