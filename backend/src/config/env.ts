import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Environment precedence (highest → lowest):
 *   1. real process env            (docker-compose, CI, shell, spawned tests)
 *   2. <repo-root>/.env            (single source of truth for the local stack)
 *   3. backend/.env                (fallback when the backend runs standalone)
 *
 * The repo-root .env is loaded with a "root wins over backend/.env" rule, but
 * never overrides variables the real environment actually set — so the
 * integration test, docker-compose and CI keep full control.
 */
const here = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = join(here, "..", "..", "..", ".env");

const realEnv = new Set(Object.keys(process.env));

dotenv.config(); // loads ./env from cwd (backend/.env) if present

if (existsSync(rootEnvPath)) {
  const rootVars = dotenv.parse(readFileSync(rootEnvPath, "utf8"));
  for (const [key, value] of Object.entries(rootVars)) {
    if (!realEnv.has(key)) process.env[key] = value;
  }
}
