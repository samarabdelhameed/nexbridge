#!/usr/bin/env bash
# =============================================================================
# NexBridge local-stack runner (anvil + vaults + backend + frontend)
#
#   npm run dev      # start everything (idempotent)
#   npm run stop     # stop everything
#   npm run status   # health of each piece
#
# Everything reads config from the repo-root .env (single source of truth).
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
FRONTEND_ENV="$ROOT/frontend/.env.local"

export PATH="$HOME/.foundry/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true

L1_RPC=http://127.0.0.1:8545
L2_RPC=http://127.0.0.1:8546
API_URL=http://127.0.0.1:8080
UI_URL=http://localhost:3000

L1_CHAIN_ID=11155111
L2_CHAIN_ID=11124

DEPLOYER_ADDR=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
RELAYER_ADDR=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
DEPLOYER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

log() { printf '\033[1;36m[nexbridge]\033[0m %s\n' "$*"; }

rpc_up() { curl -s -m 2 -X POST "$1" -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | grep -q '"result"'; }
api_up() { curl -s -m 2 "$API_URL/api/health" | grep -q '"ok":true'; }
ui_up() { curl -s -m 2 -o /dev/null "$UI_URL"; }

env_get() { grep -s "^$1=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r' || true; }
env_set() {
  local key="$1" value="$2" file="$3"
  if grep -q "^$key=" "$file"; then
    sed -i '' "s|^$key=.*|$key=$value|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

# --- Chains ---------------------------------------------------------------
start_chains() {
  if rpc_up "$L1_RPC"; then log "anvil L1 already up (:8545)"; else
    log "starting anvil L1 (sepolia) on :8545"
    nohup anvil --port 8545 --chain-id "$L1_CHAIN_ID" --block-time 1 > /tmp/nexbridge-anvil-l1.log 2>&1 &
    disown
  fi
  if rpc_up "$L2_RPC"; then log "anvil L2 already up (:8546)"; else
    log "starting anvil L2 (abstract) on :8546"
    nohup anvil --port 8546 --chain-id "$L2_CHAIN_ID" --block-time 1 > /tmp/nexbridge-anvil-l2.log 2>&1 &
    disown
  fi
  for _ in $(seq 1 30); do rpc_up "$L1_RPC" && rpc_up "$L2_RPC" && return 0; sleep 1; done
  echo "anvil chains failed to start" >&2; exit 1
}

# --- Vaults ---------------------------------------------------------------
contract_deployed() { # rpc address -> 0 if code exists
  local code; code=$(cast code "$2" --rpc-url "$1" 2>/dev/null || true)
  [ -n "$code" ] && [ "$code" != "0x" ]
}

deploy_vaults() {
  local l1_addr l2_addr
  l1_addr=$(env_get L1_VAULT_ADDRESS)
  l2_addr=$(env_get L2_VAULT_ADDRESS)

  if [ -n "$l1_addr" ] && contract_deployed "$L1_RPC" "$l1_addr" \
     && [ -n "$l2_addr" ] && contract_deployed "$L2_RPC" "$l2_addr"; then
    log "vaults already deployed (L1=$l1_addr L2=$l2_addr)"
    return
  fi

  log "deploying vaults..."
  (cd "$ROOT/contracts" \
    && DEPLOYER_ADDRESS="$DEPLOYER_ADDR" RELAYER_ADDRESS="$RELAYER_ADDR" \
       DEPLOYER_PRIVATE_KEY="$DEPLOYER_KEY" \
       forge script script/DeployL1.s.sol:DeployL1 --rpc-url "$L1_RPC" --broadcast --skip-simulation > /tmp/nexbridge-deploy-l1.log 2>&1)
  (cd "$ROOT/contracts" \
    && DEPLOYER_ADDRESS="$DEPLOYER_ADDR" RELAYER_ADDRESS="$RELAYER_ADDR" \
       DEPLOYER_PRIVATE_KEY="$DEPLOYER_KEY" \
       forge script script/DeployL2.s.sol:DeployL2 --rpc-url "$L2_RPC" --broadcast --skip-simulation > /tmp/nexbridge-deploy-l2.log 2>&1)

  l1_addr=$(sed -n 's/.*L1Vault deployed at: \(0x[0-9a-fA-F]*\).*/\1/p' /tmp/nexbridge-deploy-l1.log | tail -1)
  l2_addr=$(sed -n 's/.*L2Vault deployed at: \(0x[0-9a-fA-F]*\).*/\1/p' /tmp/nexbridge-deploy-l2.log | tail -1)
  if [ -z "$l1_addr" ] || [ -z "$l2_addr" ]; then
    echo "deploy failed — see /tmp/nexbridge-deploy-l1.log and /tmp/nexbridge-deploy-l2.log" >&2
    exit 1
  fi

  env_set L1_VAULT_ADDRESS "$l1_addr" "$ENV_FILE"
  env_set L2_VAULT_ADDRESS "$l2_addr" "$ENV_FILE"
  env_set NEXT_PUBLIC_L1_VAULT_ADDRESS "$l1_addr" "$FRONTEND_ENV"
  env_set NEXT_PUBLIC_L2_VAULT_ADDRESS "$l2_addr" "$FRONTEND_ENV"
  log "vaults deployed: L1=$l1_addr L2=$l2_addr"
}

# --- Backend --------------------------------------------------------------
start_backend() {
  if api_up; then log "backend already up (:8080)"; return; fi
  log "preparing database + starting backend..."
  (cd "$ROOT/backend" && npx prisma db push --schema prisma/schema.prisma > /dev/null 2>&1 || true)
  (cd "$ROOT/backend" && nohup npx tsx src/index.ts > /tmp/nexbridge-backend.log 2>&1 & disown)
  for _ in $(seq 1 60); do api_up && return 0; sleep 1; done
  echo "backend failed to start — see /tmp/nexbridge-backend.log" >&2; exit 1
}

# --- Frontend -------------------------------------------------------------
start_frontend() {
  if ui_up; then log "frontend already up (:3000)"; return; fi
  log "building + starting frontend..."
  (cd "$ROOT/frontend" && npm run build > /tmp/nexbridge-frontend-build.log 2>&1)
  (cd "$ROOT/frontend" && nohup npm start > /tmp/nexbridge-frontend.log 2>&1 & disown)
  for _ in $(seq 1 60); do ui_up && return 0; sleep 1; done
  echo "frontend failed to start — see /tmp/nexbridge-frontend.log" >&2; exit 1
}

# --- Commands -------------------------------------------------------------
cmd_start() {
  start_chains
  deploy_vaults
  start_backend
  start_frontend
  log "stack up: UI http://localhost:3000 · API http://localhost:8080/api/health"
}

cmd_stop() {
  log "stopping nexbridge stack..."
  pkill -f "anvil --port 8545" 2>/dev/null || true
  pkill -f "anvil --port 8546" 2>/dev/null || true
  pkill -f "tsx src/index.ts" 2>/dev/null || true
  pkill -f "next start" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true
  log "done"
}

cmd_status() {
  printf 'anvil L1   :8545  %s\n' "$(rpc_up "$L1_RPC" && echo UP || echo DOWN)"
  printf 'anvil L2   :8546  %s\n' "$(rpc_up "$L2_RPC" && echo UP || echo DOWN)"
  printf 'backend    :8080  %s\n' "$(api_up && echo UP || echo DOWN)"
  printf 'frontend   :3000  %s\n' "$(ui_up && echo UP || echo DOWN)"
}

case "${1:-start}" in
  start) cmd_start ;;
  stop)  cmd_stop ;;
  status) cmd_status ;;
  *) echo "usage: $0 {start|stop|status}"; exit 1 ;;
esac
