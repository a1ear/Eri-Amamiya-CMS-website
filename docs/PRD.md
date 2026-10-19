# Streamer / Cosplayer CMS Website: PRD + Tech Stack

> Status (2026-10-19): built through step 9; see README for deploy steps. Sections below are updated where decisions changed during the build.

## Context
A cosplayer/streamer client needs a public portfolio site (profile, gallery, videos, schedule, socials, collab contact) **and** a private admin dashboard so they can edit everything themselves without asking the developer. The folder `Streamer-CMS-website` is empty, so this is a greenfield build. Decisions already made: **Next.js + Convex + Better Auth**, fresh black-and-white design (no existing site to match), contact form stores to DB and emails via Resend with an admin inbox, schedule supports weekly recurring slots plus one-off overrides.

---

## 1. Product Requirements (PRD)

### Users
- **Visitor** (anonymous): fans, brands. Mostly on mobile, often coming from a TikTok/IG bio link.
- **Owner/Admin** (exactly one account, the streamer). Non-technical, edits from a phone as often as a laptop.

### Public site (single page + real 404)
One long, anchored page (`/`) with sticky nav, because bio-link traffic expects to scroll, not navigate.

| Section | Content | Empty state |
|---|---|---|
| Hero | Display name, avatar, tagline, primary CTA (Watch live / Follow) | Never empty (seeded) |
| About | Rich-ish text (paragraphs, bold, links), cosplay journey | Section hidden |
| Gallery | Grid of photos with captions + character/series tag; lightbox with keyboard + swipe | Section hidden |
| Featured Videos | Link-out cards to any platform (owner's decision: no embedded players). YouTube thumbnail automatic; optional uploaded cover for others | Section hidden |
| Schedule | Weekly slots shown in **visitor's local time** with owner's TZ noted; next upcoming stream highlighted; overrides ("cancelled Fri", "special Oct 31") | "Schedule coming soon" |
| Socials | Icon + label links (TikTok, FB, IG, YouTube, Twitch, X, Kick, custom) | Section hidden |
| Contact / Collabs | Form: name, email, type (collab/brand/other), message; Turnstile; success + error states | Always shown |

Also: `/404`, `sitemap.xml`, `robots.txt`, OG image (generated from avatar + name), JSON-LD `Person` with `sameAs` social links.

### Admin dashboard (`/admin`, private)
- **Login**: email + password (Better Auth). No public sign-up; the one admin account is created by a seed script. Change password in Profile; reset by email; developer CLI recovery.
- **Profile**: name, tagline, avatar upload, bio, About text, timezone, contact notification email.
- **Photos**: multi-upload (client-side resize/compress before upload), edit caption/tag, drag-to-reorder (with up/down buttons for keyboard + mobile), delete with confirm. Toggle visible/hidden.
- **Videos**: paste any https video URL → platform auto-detected for the label, edit title, optional cover image, hide, reorder, delete.
- **Social links**: add / edit / remove / reorder, platform select with URL validation.
- **Schedule**: weekly slots (day, start, end, label e.g. "Just Chatting"), overrides (date, cancelled or special time + note), timezone.
- **Inbox**: list contact messages, mark read / archived. Unread count badge.
- Every screen has loading, empty, error and saved states. Changes go live immediately (Convex reactivity).

### Out of scope (v1, stated on purpose)
Multiple admins/roles, blog, comments, analytics dashboard, live "is streaming now" detection via Twitch API (good v2 candidate), i18n, payments/merch.

---

## 2. Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | SSR/ISR for SEO on the public page, same app hosts `/admin` |
| Backend + DB | **Convex** | Typed queries/mutations, realtime, built-in file storage, scheduled jobs, no ORM/server to run |
| Auth | **Better Auth** via `@convex-dev/better-auth` component | Sessions stored in Convex, email+password, password reset |
| File storage | Convex File Storage | Photos/avatar; served via storage URLs through `next/image` |
| Email | Resend via `@convex-dev/resend` component | Contact notifications + password reset; durable queue with retries |
| Rate limiting | `@convex-dev/rate-limiter` component | Contact form, login attempts, upload URL generation |
| Spam | Cloudflare Turnstile, verified server-side in a Convex action | No user-facing CAPTCHA friction |
| Styling | Tailwind CSS v4 + a few shadcn/ui primitives (admin only) | Monochrome tokens, fast to build forms |
| Validation | Convex `v` validators + Zod on forms | Same rules client and server; server is authoritative |
| Drag/drop | `@dnd-kit` | Accessible sortable lists |
| Hosting | Vercel (Next.js) + Convex Cloud (prod + dev deployments) | Free tiers fit; real domain + HTTPS |
| Monitoring | Sentry (Next.js), Convex dashboard logs, Vercel Analytics | Errors reach dev before the client notices |
| CI | GitHub Actions: typecheck, lint, Vitest (`convex-test`), Playwright smoke; Vercel preview per PR | |

### Data model (Convex `schema.ts`)
- `profile` (singleton): displayName, tagline, avatarStorageId, bio, about, timezone, notifyEmail, updatedAt
- `photos`: storageId, caption, tag, order, visible, width, height, createdAt — index `by_order`
- `videos`: platform (`youtube|tiktok|twitch|other`), url, embedId, title, order, visible — index `by_order`
- `socialLinks`: platform, label, url, order — index `by_order`
- `scheduleSlots`: dayOfWeek (0-6), startMinute, endMinute, label — index `by_day`
- `scheduleOverrides`: date (YYYY-MM-DD in owner TZ), kind (`cancelled|special`), startMinute?, endMinute?, note — index `by_date`
- `contactMessages`: name, email, topic, message, status (`new|read|archived`), emailStatus (`queued|not_configured|failed`), createdAt — index `by_status_created`. **Immutable content**: admin can change status only, never edit the message.
- Better Auth tables (managed by the component).

Order uses fractional/float `order` so reordering patches one row, not all.

---

## 3. 13-layer audit (scoped on purpose)

1. **Frontend**: in scope, all loading/empty/error states listed above.
2. **Backend & APIs**: in scope. All writes are Convex mutations with `v` validators; URLs parsed and platform-whitelisted server-side; text length caps.
3. **Database & Storage**: in scope. Indexes above; orphaned storage files deleted when a photo/avatar is replaced or removed.
4. **Auth & Permissions**: in scope. Single `requireAdmin(ctx)` helper called at the top of **every** admin query/mutation/action; checks session **and** that the user id matches the configured admin. Sign-up disabled in Better Auth config.
5. **Hosting & Deploy**: in scope. Vercel + Convex prod, custom domain, HTTPS, env vars per environment.
6. **Cloud & Compute**: deliberately minimal. Serverless only; no servers to size.
7. **CI/CD**: in scope. GitHub Actions + Vercel previews; `npx convex deploy` on main.
8. **Security**: in scope. Convex has no row-level security; the fence is that clients can **only** call functions, never the DB, so every public query returns only `visible` content and every mutation is admin-gated. Internal functions (`internalMutation`) for anything triggered by actions. CSP + security headers in `next.config`. Upload: `generateUploadUrl` is admin-only and rate-limited; server re-checks MIME type and size after upload, deletes if invalid.
9. **Rate limiting**: in scope. Contact: server-verified Turnstile token per submission + 3/10min per sender email + global bucket (per-IP dropped: Convex public functions can't see the client IP and a client-supplied one is spoofable); login/reset: Better Auth limiter stored in the DB; uploads: per-admin bucket.
10. **Caching & CDN**: in scope (light). Public page server-rendered with `preloadQuery`, images via `next/image` + Vercel CDN, video embeds as click-to-load facades.
11. **Scaling**: skipped on purpose. One creator's audience fits free/low tiers; Convex and Vercel scale without design changes.
12. **Monitoring & Logs**: in scope. Sentry for client/server errors, Convex function logs, Resend delivery failures logged.
13. **Availability & Recovery**: in scope. Weekly Convex snapshot export (scheduled backup) + one documented restore run into a dev deployment before handover.

---

## 4. Project structure

```
app/
  (public)/page.tsx            # one-page site, sections as server components
  (public)/not-found.tsx
  admin/login/page.tsx
  admin/(dashboard)/layout.tsx # auth guard (redirect) — courtesy only, server functions enforce
  admin/(dashboard)/{profile,photos,videos,socials,schedule,inbox}/page.tsx
  api/auth/[...all]/route.ts   # Better Auth handler
  sitemap.ts, robots.ts, opengraph-image.tsx
components/{public,admin,ui}/
convex/
  schema.ts, auth.ts, convex.config.ts (components)
  lib/requireAdmin.ts, lib/validators.ts, lib/videoUrl.ts
  profile.ts, photos.ts, videos.ts, socials.ts, schedule.ts, contact.ts, storage.ts
  crons.ts                      # backups, purge archived messages > 1 yr
  seed.ts                       # creates admin user + default profile
lib/schedule.ts                 # TZ conversion + "next stream" (date-fns-tz)
```

---

## 5. Build order (boring core first)
1. Scaffold Next.js + Convex + Tailwind; Better Auth component; seed admin; `requireAdmin` helper + tests that unauthenticated calls throw.
2. Schema + profile CRUD + public hero/about.
3. Photos (upload, compress, reorder, delete, storage cleanup) + gallery/lightbox.
4. Videos (URL parse/validate) + embeds; social links.
5. Schedule slots + overrides + TZ rendering + next-stream logic (unit tested across DST).
6. Contact form: Turnstile, rate limit, store, Resend email, admin inbox.
7. Visual design pass (B&W editorial), responsive, a11y.
8. SEO (metadata, OG, sitemap, JSON-LD), performance pass.
9. Sentry, backups cron, deploy to prod domain, restore drill, handover doc for the client.

---

## 6. Verification (7 gates)
- **Functional**: Playwright walk: log in, edit every entity, confirm public page updates live; every CRUD path.
- **Security**: `convex-test` suite calling each admin mutation unauthenticated and as a non-admin session → must throw; tamper attempts (setting `status` via a public function, oversize/non-image upload, `javascript:` social URL, script in captions); spam the contact endpoint until rate-limited; confirm sign-up endpoint rejects.
- **Responsive**: 360, 768, 1024, 1440, 1920 widths in the browser pane.
- **SEO & Web**: title/meta/OG check, sitemap, alt text required on photos (caption fallback), real 404.
- **Performance**: Lighthouse on prod URL; gallery images sized, embeds deferred; target LCP < 2.5s on mobile.
- **Accessibility**: keyboard-only through nav, lightbox, reorder, forms; focus rings; contrast (B&W passes AAA trivially, check grey text).
- **Production**: final checks against the real domain, real Convex prod, real email delivery, Sentry receiving a test error, one backup actually restored.

## Open items to confirm with the client later (not blocking)
Domain name, which social platforms they use, client's timezone, the email that should receive collab inquiries.
