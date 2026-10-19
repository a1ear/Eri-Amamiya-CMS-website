// Creates the single owner account on the current Convex deployment.
// With --reset: sets a new password for the existing owner instead (and signs
// them out everywhere). Use when they are locked out and email isn't set up.
// Reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME from the
// environment or .env.local. The Convex function refuses if an admin exists.
//
// Production: run with --prod and a temporary password, then have the owner
// change it after first sign-in (Dashboard → Profile → Password).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME ?? "Owner";

if (!email || !password) {
  console.error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (e.g. in .env.local).");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const convexBin = path.join(
  path.dirname(require.resolve("convex/package.json")),
  "bin",
  "main.js",
);

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const extra = args.filter((a) => a !== "--reset"); // e.g. --prod
const fn = reset ? "seed:resetAdminPassword" : "seed:createAdmin";
const payload = reset ? { email, password } : { email, password, name };
const result = spawnSync(
  process.execPath,
  [convexBin, "run", ...extra, fn, JSON.stringify(payload)],
  { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" },
);

if (result.status !== 0) process.exit(result.status ?? 1);
console.log(reset ? "Password reset; all sessions signed out." : "Admin created:", result.stdout.trim());
