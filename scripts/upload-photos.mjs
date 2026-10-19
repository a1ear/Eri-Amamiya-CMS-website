// Uploads every JPG/PNG/WebP in photos-to-upload/ to the gallery on the LIVE
// site, through the same admin API the dashboard uses (server-side byte
// checks, rate limits). Signs in with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
// from .env.local, signs out at the end, and never prints credentials.
//
//   npm run upload:photos              upload, visible on the site
//   npm run upload:photos -- --hidden  upload hidden (review in dashboard first)
//   npm run upload:photos -- --dry-run sign in and list files, upload nothing
//
// Files are uploaded in name order and keep that order in the gallery (the
// first file ends up first). Uploaded files move to photos-to-upload/uploaded/
// so re-running never duplicates them.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { anyApi as api } from "convex/server";
import { imageSize } from "image-size";

const SITE = "https://eri-amamiya.vercel.app";
const CONVEX_URL = "https://cool-deer-612.convex.cloud";
const DIR = "photos-to-upload";
const DONE_DIR = path.join(DIR, "uploaded");
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const args = process.argv.slice(2);
const hidden = args.includes("--hidden");
const dryRun = args.includes("--dry-run");

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password } = process.env;
if (!email || !password) {
  console.error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.local (the production admin login).");
  process.exit(1);
}

mkdirSync(DONE_DIR, { recursive: true });
const files = readdirSync(DIR)
  .filter((f) => TYPES[path.extname(f).toLowerCase()] && statSync(path.join(DIR, f)).isFile())
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

// --- sign in exactly like the browser does ---
const signIn = await fetch(`${SITE}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: SITE },
  body: JSON.stringify({ email, password }),
});
if (!signIn.ok) {
  console.error(`Sign-in failed (HTTP ${signIn.status}). Check the email/password in .env.local.`);
  process.exit(1);
}
const cookie = signIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const signOut = () =>
  fetch(`${SITE}/api/auth/sign-out`, { method: "POST", headers: { "content-type": "application/json", origin: SITE, cookie }, body: "{}" });

try {
  const { token } = await (await fetch(`${SITE}/api/auth/convex/token`, { headers: { cookie } })).json();
  const convex = new ConvexHttpClient(CONVEX_URL);
  convex.setAuth(token);
  const before = await convex.query(api.photos.listAdmin, {});
  console.log(`Signed in. Gallery has ${before.length} photo(s). ${files.length} file(s) to upload${hidden ? " (hidden)" : ""}.`);
  if (dryRun || files.length === 0) {
    for (const f of files) console.log(`  would upload: ${f}`);
    process.exitCode = 0;
  } else {
    // Each new photo goes to the top, so upload in reverse to keep name order.
    let ok = 0;
    for (const file of [...files].reverse()) {
      const full = path.join(DIR, file);
      const bytes = readFileSync(full);
      if (bytes.length > MAX_BYTES) {
        console.log(`  SKIP ${file}: ${(bytes.length / 1048576).toFixed(1)} MB is over the 10 MB limit. Resize it or use the dashboard (it shrinks automatically).`);
        continue;
      }
      let size;
      try {
        size = imageSize(bytes);
      } catch {
        console.log(`  SKIP ${file}: not a readable image.`);
        continue;
      }
      // EXIF orientations 5–8 are rotated 90°: swap so the grid ratio matches what's shown.
      const rotated = size.orientation && size.orientation >= 5;
      const [width, height] = rotated ? [size.height, size.width] : [size.width, size.height];

      const uploadUrl = await convex.mutation(api.photos.generateUploadUrl, {});
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": TYPES[path.extname(file).toLowerCase()] },
        body: bytes,
      });
      if (!res.ok) {
        console.log(`  FAIL ${file}: upload HTTP ${res.status}`);
        continue;
      }
      const { storageId } = await res.json();
      const result = await convex.action(api.photos.add, { storageId, width, height });
      if (!result.ok) {
        console.log(`  FAIL ${file}: ${result.error}`);
        continue;
      }
      if (hidden) await convex.mutation(api.photos.update, { id: result.id, caption: "", tag: "", visible: false });
      renameSync(full, path.join(DONE_DIR, file));
      ok++;
      console.log(`  ok   ${file} (${width}×${height})`);
    }
    const after = await convex.query(api.photos.listAdmin, {});
    console.log(`Done: ${ok}/${files.length} uploaded. Gallery now has ${after.length} photo(s).`);
    console.log(hidden ? `Review them at ${SITE}/admin/photos and click Show.` : `See them at ${SITE}/#gallery`);
  }
} finally {
  await signOut();
}
