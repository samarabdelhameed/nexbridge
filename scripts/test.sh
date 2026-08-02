#!/usr/bin/env bash
# Full verification: contracts + backend + frontend.
# Run: npm test  (at repo root)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.foundry/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true

echo "================ contracts ================"
(cd "$ROOT/contracts" && forge build && forge test)

echo "================ backend ================"
(cd "$ROOT/backend" && npm run lint && npm run typecheck && npm test && npm run build)

echo "================ frontend ================"
(cd "$ROOT/frontend" && npm run lint && npm run build)

echo ""
echo "ALL CHECKS PASSED ✓"
