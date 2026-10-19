// Exports the Convex deployment (all tables + uploaded files) to
// backups/backup-<timestamp>.zip. Pass --prod to back up production.
// Restore: npx convex import --replace-all [--prod] backups/<file>.zip
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const convexBin = path.join(path.dirname(require.resolve("convex/package.json")), "bin", "main.js");

mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join("backups", `backup-${stamp}.zip`);

const result = spawnSync(
  process.execPath,
  [convexBin, "export", "--include-file-storage", "--path", file, ...process.argv.slice(2)],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Backup written to ${file}`);
