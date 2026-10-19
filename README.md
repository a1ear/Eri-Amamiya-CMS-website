# Streamer CMS

A one-page portfolio for a cosplayer/streamer (profile, gallery, featured
videos, stream schedule, socials, contact form) with a private dashboard at
`/admin` where the owner edits everything themselves.

- **Product spec:** [docs/PRD.md](docs/PRD.md)
- **Guide for the site owner:** [docs/HANDOVER.md](docs/HANDOVER.md)

## Stack

| Layer | Choice |
|---|---|
| Web | Next.js 16 (App Router, Cache Components), React 19, Tailwind 4 |
| Data, files, jobs | Convex (queries/mutations/actions, file storage, crons) |
| Auth | Better Auth via `@convex-dev/better-auth` (email + password, one admin) |
| Email | Resend via `@convex-dev/resend` (durable queue) |
| Abuse protection | Cloudflare Turnstile, `@convex-dev/rate-limiter` |
| Monitoring | Sentry (Next.js), Convex dashboard logs/exception reporting |
| Hosting | Vercel (Next.js) + Convex Cloud |

## Local development

Requires Node 22. npm 7 crashes on this dependency tree: use npm 10+
(`npm i -g npm@10`). `.npmrc` sets `legacy-peer-deps` because better-auth
declares dozens of optional framework peers that npm's resolver chokes on.

```bash
npm install
npx convex dev            # first run creates a local deployment and .env.local
```

In a second terminal, set the Convex env once, seed the owner, then run Next:

```bash
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL http://localhost:3000
npx convex env set TURNSTILE_SECRET_KEY 1x0000000000000000000000000000000AA
# add SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (12+ chars) / NEXT_PUBLIC_SITE_URL /
# NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA to .env.local, then:
npm run seed:admin
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/admin.

| Script | |
|---|---|
| `npm test` | Vitest: Convex functions (convex-test), auth, validation, schedule maths |
| `npm run typecheck` / `npm run lint` | |
| `npm run seed:admin [-- --prod]` | Creates the single owner account; refuses if one exists |
| `npm run reset:admin-password [-- --prod]` | Locked-out owner and no email set up: sets a new password, signs out all sessions |
| `npm run backup [-- --prod]` | Exports all tables **and files** to `backups/backup-<time>.zip` |

## Deploying to production

1. **Convex:** `npx convex login`, then `npx convex deploy`. In the dashboard
   (Settings → Environment Variables) for **production** set every variable
   listed under "Convex deployment env" in [.env.example](.env.example),
   including `RESEND_TEST_MODE=false` and `TURNSTILE_EXPECTED_HOSTNAME`.
2. **Resend:** verify the sending domain; use an address on it for `RESEND_FROM`.
3. **Turnstile:** create a widget for the domain; site key → Vercel, secret → Convex.
4. **Vercel:** import the repo. Build command
   `npx convex deploy --cmd 'npm run build'` with `CONVEX_DEPLOY_KEY` (production
   deploy key from the Convex dashboard) set, so functions and site ship together.
   Set the Next.js variables from `.env.example` (`NEXT_PUBLIC_SITE_URL` = the real
   domain). Add the custom domain; HTTPS is automatic.
5. **Owner account:** `npm run seed:admin -- --prod` with a temporary password,
   then have the owner change it (see HANDOVER).
6. **Monitoring:** create a Sentry project, set `NEXT_PUBLIC_SENTRY_DSN` and
   `SENTRY_DSN` in Vercel. In Convex: Settings → Integrations → Exception
   reporting → Sentry (same DSN) so backend errors are reported too.
7. **Backups:** enable Convex scheduled backups (Settings → Backups, daily) and
   keep `npm run backup -- --prod` for an off-platform copy before risky changes.
8. **Restore drill (once, before handover):** restore the latest production
   backup into a *development* deployment with
   `npx convex import --replace-all backups/<file>.zip` and check the site.

## Operations

- **Restore:** `npx convex import --replace-all [--prod] backups/<file>.zip`.
  Drilled locally: deleted a table, restored, all records and files back.
- **Crons** (`convex/crons.ts`): daily orphaned-upload cleanup; weekly purge of
  *archived* inbox messages older than a year.
- **Logs:** Convex dashboard → Logs (all function calls and `console.*`),
  Vercel → Logs, Sentry for exceptions.

## Decisions worth knowing

- **Authorization lives in Convex, not the UI.** Every admin function is built
  with `adminQuery` / `adminMutation` / `adminAction` (`convex/lib/requireAdmin.ts`),
  which require a live session *and* a row in the `admins` table. Convex has no
  row-level security; the fence is that browsers can only call functions, and
  public functions return explicit field allowlists. The `/admin` redirect is a
  courtesy only.
- **Sign-up is disabled.** The single owner is created by an internal seed
  action; internal functions cannot be called from a browser.
- **Uploads are verified by their bytes** (JPEG/PNG/WebP magic numbers), never
  the claimed Content-Type. Checks run in actions so a rejected file's deletion
  is not rolled back with the error.
- **Contact form:** Convex public functions can't see the client IP, and a
  client-supplied IP would be spoofable, so abuse control is a server-verified
  Turnstile token per submission plus per-sender and global rate limits. The
  message is stored *before* the email is queued; an email failure is recorded
  on the message, never allowed to lose it. Message content is immutable.
- **Schedule** times are stored as wall-clock times in the owner's timezone and
  converted to instants with Intl (DST-safe, tested), then shown in each
  visitor's own timezone.
- **Featured videos link out** (owner's call): no third-party players, scripts
  or cookies on the page.
- **Public pages render per request** (`connection()`), so dashboard edits show
  on the next load without cache invalidation plumbing. Convex caches query
  results; Vercel's CDN serves the static shell.
- **CSP** allows `'unsafe-inline'` scripts (Next.js inline bootstrap; nonces
  would force fully dynamic rendering). Everything else is pinned to known hosts.

## Deliberately out of scope (v1)

Multiple admins/roles, blog, comments, analytics dashboard, live "streaming
now" detection via the Twitch API, i18n, embedded video players, payments.
