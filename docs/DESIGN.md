# Design system: Eri Amamiya site

The UI/UX rules for the public site and the `/admin` dashboard, derived from
how the system is built. Every value here exists in the code; where the code
and this document disagree, fix one of them. Product scope lives in
[PRD.md](PRD.md), engineering decisions in the [README](../README.md).

---

## 1. Principles (and the architecture behind them)

| Principle | Why the system makes it true |
|---|---|
| **Phones first, bio-link first.** The first screen must show who she is and the "Watch" button. | Most visitors arrive from a TikTok/Instagram bio link on mobile data. Verified at 360×780: the CTA sits at 661px, above the fold. |
| **Content is data.** No copy, name or image is hard-coded in a component. | Every section reads a Convex query (`profile.getPublic`, `photos.listPublic`, …). The owner changes the site from the dashboard, never from code. |
| **Empty means hidden, not broken.** A section with no data does not render, and the nav does not link to it. | Components return `null` on empty data; `SiteNavLinks` builds its links from the same queries. Exceptions: **Schedule** ("coming soon") and **Contact** (always useful). |
| **Black and white; the photos are the colour.** No accent colour exists. | Four tokens only (§3.1). Cosplay photography carries all the colour on the page. |
| **Nothing third-party until the visitor chooses.** | Videos are link-out cards (no embedded players), Turnstile loads lazily, Sentry loads only if configured, the Convex client loads only when the contact form is sent. |
| **The UI is a courtesy; the server is the permission.** | Hiding a button never secures anything. Every admin action re-checks the session in Convex (`adminQuery` / `adminMutation` / `adminAction`), so the UI's job is clear messages, not enforcement (§7). |
| **Plain beats clever.** It has to be faster than asking someone to edit the site. | One page, one dashboard, one action per button, inline save status. No modals in the admin except the native confirm before deleting. |

---

## 2. Architecture → UX map

```
                    ┌──────────────── Vercel (Next.js 16, Cache Components) ───────────────┐
 Visitor ──HTTPS──▶ │  "/"  static shell (header frame)  +  per-request streamed sections   │
                    │        └─ server: fetchQuery(public queries)  ── no websocket ──┐     │
                    │  "/admin/*"  ConvexBetterAuthProvider (websocket, live queries) │     │
                    │  "/api/auth/*" ─ proxy ─────────────────────────────────────┐   │     │
                    └─────────────────────────────────────────────────────────────┼───┼─────┘
                                                                                  ▼   ▼
                                          Convex: auth (Better Auth component), queries/mutations,
                                          file storage, rate limiter, Resend queue, crons
```

What that means for design:

- **Public pages render on the server on every request.** The header frame is
  prerendered; everything else streams in behind a `<Suspense>`. Design every
  dynamic block with a fallback (§6). Edits in the dashboard appear on the next
  page load, not live; the copy never promises "instant".
- **The admin is live.** It holds a websocket (Convex React client), so lists
  update the moment a mutation lands. Reorders are optimistic: the row moves
  immediately and snaps back if the server refuses.
- **Visitors and the server see different timezones.** The schedule
  server-renders in Eri's timezone and switches to the visitor's after
  hydration (`useSyncExternalStore`), so there is no hydration mismatch.

### Surface inventory

| Surface | Route / component | Data (Convex) | Render | Hidden when |
|---|---|---|---|---|
| Header nav | `SiteNavLinks` | profile, photos, videos | streamed (own Suspense) | n/a (links filtered) |
| Hero | `Hero` | `profile.getPublic`, `socials.list` | streamed | never (seed guarantees a profile) |
| About | `About` | `profile.getPublic` | streamed | `about` empty |
| Gallery + lightbox | `Gallery`, `GalleryGrid` | `photos.listPublic` (≤200, visible only) | streamed + client lightbox | no visible photos |
| Featured videos | `Videos` | `videos.listPublic` (≤24, visible only) | streamed | no visible videos |
| Schedule | `Schedule`, `ScheduleView` | `schedule.getPublic` | streamed + client tz | never ("coming soon") |
| Contact | `Contact`, `ContactForm` | `contact.submit` (action) | static + client | never |
| Footer | `SiteFooter` | profile, socials | streamed (own Suspense) | n/a |
| Share card | `app/opengraph-image.tsx` | `profile.getPublic` | per request | n/a |
| 404 / error | `not-found.tsx`, `error.tsx` | none | static / client | n/a |
| Admin shell | `(dashboard)/layout.tsx`, `AdminNav` | `admin.isAdmin`, `contact.unreadCount` | gate streamed, nav live | n/a |
| Admin pages | `/admin/{profile,photos,videos,socials,schedule,inbox}` | the matching `*Admin`/`get` queries | live | n/a |
| Auth pages | `/admin/{login,forgot-password,reset-password}` | Better Auth endpoints | static + client | n/a |

---

## 3. Foundations

### 3.1 Colour (CSS variables in `app/globals.css`)

| Token | Light | Dark | Use | Contrast on bg |
|---|---|---|---|---|
| `--backdrop` | `#ffffff` | gradient `#2a2a2e` → `#1c1c1f` → `#121214` (top → bottom) | the page itself (fixed `body::before` layer) | n/a |
| `--background` | `#ffffff` | `#1c1c1f` | solid fills: sticky header, inverted button text, dragged rows | n/a |
| `--foreground` | `#0a0a0a` | `#ececec` | text, rules, borders, filled buttons | 19.8:1 / 12.1–15.8:1 |
| `--muted` | `#555555` | `#a8a8ad` | section labels, secondary text, metadata | 7.5:1 / 6.0–7.9:1 (AA at any size) |
| `--surface` | `#f0f0f0` | `#313136` | image placeholders, skeletons | decorative only |

Dark-mode contrast is quoted across the whole gradient (lightest top to
darkest bottom).

Rules:
- Theme follows the device (`prefers-color-scheme`); there is no toggle.
  `color-scheme: light dark` makes native controls (dropdowns, date/time
  pickers, scrollbars) follow it too.
- **Dark mode is charcoal, not black.** Pure `#000`/`#0a0a0a` with pure
  white text (18:1) caused eye strain; the gradient and `#ececec` text keep
  contrast well above AA while softening glare. Don't reintroduce pure black
  page backgrounds. (The photo lightbox stays near-black on purpose: photos
  read best on black.)
- The gradient is fixed to the viewport, not stretched over the page, so it
  frames every screen the same way and scrolls without repainting.
- Never introduce a hue. State is shown by **weight, borders, fills and text**,
  never by colour alone: an error is bold text with `role="alert"`, an
  invalid field gets a 2px border, a hidden item gets 40% thumbnail opacity
  and a "Hidden" tag.
- Small grey text in the admin uses `text-neutral-600 dark:text-neutral-400`
  (`neutral-500` is 4.2:1 on the dark background, below AA for small text;
  always pair it with `dark:text-neutral-400`).

### 3.2 Typography

One family: **Geist** (`next/font`, self-hosted, no layout shift), fallback
`system-ui`. No monospace or serif.

| Role | Classes | Where |
|---|---|---|
| Display (name) | `text-[clamp(2.75rem,9vw,6.5rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-balance` | Hero `h1` |
| Headline | `text-[clamp(1.75rem,5vw,3rem)] font-semibold tracking-[-0.03em]` | Next stream, contact lead, footer name |
| 404 headline | `text-[clamp(2.5rem,8vw,4.5rem)] … leading-none tracking-[-0.04em]` | 404 |
| Section label | `text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]` | Every section `h2`, tagline |
| Meta label | `text-[0.7rem] uppercase tracking-[0.2em]` | Photo tag, "Watch on …" |
| Button label | `text-sm font-semibold uppercase tracking-[0.15em]` | Primary CTAs |
| Body large | `text-lg leading-relaxed text-pretty` | Bio, About, intros |
| Body | `text-sm` / base | Lists, forms |
| Admin page title | `text-2xl font-semibold tracking-tight` | Admin `h1` |

Rules: tight negative tracking on large type, wide positive tracking on tiny
uppercase labels; `tabular-nums` on times, dates, counts and counters.

### 3.3 Layout and spacing

| Thing | Value |
|---|---|
| Public container | `mx-auto max-w-6xl px-4` (16px side gutter at every width) |
| Admin container | `mx-auto max-w-3xl px-4 py-10` |
| Auth card | `max-w-sm` centered, 1px border |
| Section rhythm | `py-16 md:py-24`, separated by a full-width 1px `--foreground` top rule |
| Label column | `md:grid-cols-[12rem_minmax(0,1fr)]`: label left, content right (About, Schedule, Contact) |
| Hero grid | `md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]`, portrait first on mobile |
| Reading width | `max-w-2xl` for long text and the contact form |
| Sticky header | `min-h-14` (56px); section anchors use `scroll-mt-16` |

Breakpoints are Tailwind defaults: `sm` 640, `md` 768, `lg` 1024. Verified
widths: 360, 375, 1024, 1440. There is no horizontal scroll at any of them.

### 3.4 Shape, borders, elevation

- **Square corners everywhere** (editorial). The only rounded items: the admin
  avatar preview (circle) and the 64px app icon.
- **1px solid rules** separate and frame: sections, cards, inputs, the next-stream card.
- **No shadows**, except a lifted row while it is being dragged.

### 3.5 Motion

| Motion | Spec | Reduced-motion |
|---|---|---|
| Anchor scrolling | `scroll-behavior: smooth` | `auto` |
| Image hover | `scale-[1.02]`–`[1.03]`, 500ms ease-out | `motion-reduce:transition-none` |
| Live indicator | `animate-pulse` dot | `motion-reduce:animate-none` |
| Drag reorder | dnd-kit transform/transition | n/a (buttons do the same) |

Motion is feedback only. Nothing animates on load, and nothing loops except
the live dot.

### 3.6 Iconography

None as a library. Directional glyphs as text: `↗` external link, `▶`
video, `⠿` drag handle, `↑ ↓` move, `✕` close, `← →` lightbox. Glyphs that
carry meaning are paired with `sr-only` text or an `aria-label`.

---

## 4. Public components

### Header
- Name (truncates to 40% width on phones) + section links built from data.
- Phones: links scroll sideways in one row with a right-edge fade, instead of
  wrapping the sticky bar onto two lines. Each link is a 44px-tall target.
- Fallback while streaming: a 96×20 `--surface` bar.
- Skip link "Skip to content" is the first focusable element.

### Hero
- Order on phones: portrait (max 208px wide, 4:5) → tagline label → name →
  bio → CTA row. Desktop: text left, 22rem portrait right.
- **Primary CTA** "Watch on {Platform}": the first social link in priority
  order Twitch → Kick → YouTube → TikTok. Filled, `min-h-12`.
- Other socials: text links with `↗`, 24px tall.
- No photo → initials (`lib/initials.ts`) centered on `--surface`.
- Portrait is the LCP image: `priority`, sized `22rem / 18rem`.

### About
- Owner-written text rendered by `RichText`: blank line = paragraph, newline =
  `<br>`, `**bold**`, bare `https://` links (opened in a new tab,
  `rel="noopener noreferrer nofollow ugc"`). Never interprets HTML.

### Gallery and lightbox
- CSS columns, 2 → 3 at `lg`, natural aspect ratios (width/height stored per
  photo, so no layout shift).
- Tile = button → image, then tag (meta label) and caption.
- **Alt text** derived: `caption` → `"{tag} cosplay"` → `"Cosplay photo"`, plus
  `" by {name}"`.
- Lightbox: native `<dialog>` (focus trap, Esc, inert page). Counter `n / N`
  (`aria-live`), ← → buttons and arrow keys, swipe ≥50px on touch, click the
  backdrop to close, page scroll locked, **focus returns to the tile of the
  last photo viewed**.

### Featured videos
- Cards in a 1 → 2 (`sm`) → 3 (`lg`) grid; 16:9 frame with a 1px border.
- Thumbnail: uploaded cover → YouTube `hqdefault` → typographic platform name.
- `▶` badge bottom-left, title, then "Watch on {Platform} ↗". The whole card
  is one link (new tab).

### Schedule
- **Next stream card:** "Next stream · in 17 hours" + day/time headline + title
  + note; or **"Live now"** with a pulsing dot when a stream is running
  (including streams that crossed midnight). Button: "Follow to get notified"
  or "Watch now".
- **Next 7 days list:** date | time range | title (+ `SPECIAL` tag). Days off
  appear inline: struck-through "No stream" + the owner's note.
- Footnote: "Times shown in your timezone (X). Eri streams from Y." When both
  zones match: "Times shown in Y."
- Empty: "Schedule coming soon." + follow link.
- Times use the visitor's locale and timezone after hydration; refreshed every 60s.

### Contact
- Fields: name, email, topic (Collaboration / Brand partnership / Something
  else), message (≤2000), off-screen honeypot, Turnstile widget (`size:
  flexible`, reserves 65px so nothing jumps).
- Success replaces the form: "Message sent. Thank you!" + "Send another message".
- Sending shows "Sending…" and disables the button. Errors: §7.

### Footer
Name as a headline, social links, `© {year} {name}`.

### 404 and error
- 404: label "404", "This page doesn't exist.", button "Go to the homepage". `noindex`.
- Error boundary: "This page didn't load" + "Try again". It never shows technical detail.

---

## 5. Admin components

### Shell
- Top nav: Overview, Profile, Photos, Videos, Socials, Schedule, Inbox
  (**unread badge** = live count of `new` messages), then "View site ↗" and
  "Sign out". Current page: bold + underline + `aria-current="page"`.
- The route gate shows "Checking your session…" while it verifies, then
  redirects to `/admin/login` if needed. Admin pages are `noindex`.

### Page template
`h1` → one-line purpose sentence (muted) → **add/create form first** → list
of existing items → empty state ("No photos yet" + what to do).

### Controls (`components/admin/styles.ts`)

| Control | Look | Use |
|---|---|---|
| `primaryButton` | filled foreground | one per form: Save / Add |
| `secondaryButton` | 1px outline, inverts on hover | Undo, Hide/Show, Delete, Open ↗ |
| `iconButton` | 36px square outline | drag handle, ↑ ↓ |
| `inputClass` | 1px outline, 2px when `aria-invalid` | every text input/select |

### Field pattern (Profile and others)
Label (top) → counter `12/60` (right, `tabular-nums`, bold when over) →
input → hint (muted) → error (bold, `role` via live region). Inputs carry
`aria-invalid` and `aria-describedby` → hint + error. The server returns all
field errors at once, and all are shown together.

### Saving pattern
- **Dirty tracking:** Save appears/enables only when something changed; "Undo"
  or "Discard" restores the saved values; Profile warns before leaving with
  unsaved edits.
- **Inline status** next to the button (`role="status"`, or `role="alert"` for
  errors): "Saving…" → "Saved. Your site is updated." No toasts, no modals.
- **One-click actions** (Hide/Show, Mark read, Archive) save immediately and
  report in the same status line.
- **Destructive actions** use the native `confirm()` with the item named:
  "Delete "Frieren at AniCon"? This removes it from your site and can't be
  undone."

### Ordering (`SortableList`)
Each row has a drag handle (mouse, touch, keyboard via dnd-kit) **and** ↑ ↓
buttons (easier on phones). Moves are optimistic. The help text is shown once
above the list: "The top item shows first on your site."

### Uploads
- Photos: multi-select or drag-drop onto the dashed area; resized in the
  browser to 2048px WebP (1024px for the avatar, 1280px for video covers);
  uploaded **one at a time** with a queue ("Uploading 3 of 8…", per-file errors).
- The server checks the real file bytes; a rejected file shows "Use a JPG, PNG
  or WebP image." and is deleted.

### Inbox
Tabs New / Read / Archived (`role="tablist"`). Cards: name `<email>`, time,
topic, message (`whitespace-pre-wrap`), and a note when the notification
email isn't set up yet or failed (the message itself is always safe). Actions: Reply by email (mailto), Mark read/unread,
Archive / Move back. **No edit, no delete:** messages are a record.

---

## 6. State matrix

Every surface must handle all four states. "-" = not applicable.

| Surface | Loading | Empty | Error | Success / filled |
|---|---|---|---|---|
| Public sections | `HeroSkeleton` (one boundary covers hero → schedule) | section hidden; schedule "coming soon" | route error boundary | content |
| Header nav | 96px placeholder bar | only Schedule + Contact links | (part of page) | filtered links |
| Footer | nothing (`null` fallback) | name only | (part of page) | links |
| Contact form | widget space reserved | - | inline alert per §7 | thank-you panel |
| Admin gate | "Checking your session…" | - | redirect to login | dashboard |
| Admin lists | "Loading photos…" etc. | dashed box + next step | dashboard error boundary | rows |
| Admin forms | "Loading your profile…" | "No profile found. Ask your developer…" | inline field + summary | "Saved…" |
| Auth pages | button "Signing in…" | - | generic message (§7) | redirect / confirmation |

---

## 7. Messages: server outcome → what the user sees

Copy is written for a non-technical owner and for visitors: say what happened
and what to do, never error codes.

| Server outcome | Where | Shown |
|---|---|---|
| `INVALID` + `fields` | any form | each field's message under it, plus "Fix the highlighted fields and save again." |
| `UNAUTHENTICATED` / `FORBIDDEN` | admin | "Your session has ended" + "Sign in again to keep editing." |
| Rate limited (`kind: RateLimited`) | uploads | "Too many uploads in a short time. Try again in N min." |
| Rate limited | contact | "Lots of messages right now. Please try again in a few minutes." |
| HTTP 429 | login / reset | "Too many attempts. Wait a minute and try again." |
| `CAPTCHA_FAILED` | contact | "The security check didn't pass. Please try again." (widget resets) |
| No token yet | contact | "Please wait for the security check above the button to finish." |
| Network / unknown | anywhere | "Could not save. Check your connection and try again." |
| Upload rejected | uploads | "Use a JPG, PNG or WebP image." / "Image is larger than N MB." |

**Security-driven copy (do not "improve" these):**
- Login failure is always "Email or password is incorrect." Never say which.
- Password-reset request always answers "If that email belongs to the site's
  admin account, a reset link is on its way." Never confirm the account.
- Honeypot hits get the normal success screen.
- Expired/invalid reset link: "This reset link is invalid or has expired. Links work once and last 1 hour."

---

## 8. Voice and content

- Second person to the owner ("Your site", "your stream"), first person
  plural nowhere, Eri's voice only in her own content.
- Buttons are verbs: "Add photos", "Save changes", "Send message", "Watch on Twitch".
- Hints teach by example: "e.g. Frieren at AniCon 2026".
- Owner-facing limits are stated as advice ("Keep it under 120 characters."),
  not rules ("Max length exceeded").
- Times: visitor's locale (`8:00 PM` / `20:00` as the browser prefers);
  relative where it helps ("in 17 hours").

---

## 9. Accessibility (implemented; keep it that way)

- Semantic landmarks: `header > nav`, `main#main`, `footer > nav`; one `h1` per page.
- Visible focus on every interactive element (`focus-visible:outline-2`); keyboard order verified.
- Targets: ≥44px for nav and primary buttons; ≥24px minimum elsewhere (WCAG 2.2 AA).
- Live regions: status lines `role="status"`, errors `role="alert"`, lightbox counter `aria-live`.
- External links say "(opens in new tab)" to screen readers.
- Decorative images `alt=""`; content images have derived alt (§4 Gallery).
- Contrast per §3.1; no meaning carried by colour.
- Reduced motion respected (§3.5).

---

## 10. Media rules

| Media | Upload limit | Stored as | Displayed |
|---|---|---|---|
| Profile photo | 5 MB, JPG/PNG/WebP | ~1024px WebP | 4:5 crop (`object-cover`), `next/image` |
| Gallery photo | 10 MB | ~2048px WebP + width/height | natural ratio; lightbox `object-contain` |
| Video cover | 5 MB | ~1280px WebP | 16:9 crop |
| YouTube thumb | n/a | derived URL | 16:9 crop |

Replaced and deleted files are removed from storage; abandoned uploads are
swept daily after 24h.

---

## 11. Share and search surfaces

- **Title:** `{name} · {tagline}` (or just the name). **Description:** bio → tagline → generic.
- **OG card (1200×630):** black field, tagline label, name in large type,
  portrait on the right behind a 2px rule; text-only if there's no photo.
- JSON-LD `Person` with `sameAs` = social links. Sitemap = `/` only. `/admin` and `/api` disallowed.
- App icon: black rounded square with a white play triangle.

---

## 12. Performance budget

Measured on the production build:

| Metric | Budget | Measured |
|---|---|---|
| First-party JS (compressed) | ≤ 200 KB | 178 KB |
| HTML | ≤ 30 KB | 16 KB |
| CLS | 0 | 0 |
| Third-party requests before interaction | Turnstile only (lazy) | Turnstile only |

Rules that keep it there: no embedded players; anything heavy loads on
intent (`import()` on submit / when configured); images through `next/image`
with explicit `sizes`; no web fonts beyond Geist (one family, latin subset).

---

## 13. Known gaps (decisions to revisit)

1. **Admin colours are literal** (`border-black`, `bg-black`, `neutral-*`)
   rather than the CSS tokens the public site uses. They look identical today;
   move them to tokens if the palette ever changes.
2. **One Suspense boundary covers hero → schedule**, so the slowest query
   delays all of them. Fine at current data sizes; split if any section gets heavy.
3. **No theme toggle**: the site follows the device. Add one only if Eri asks.
4. **Admin UI has not had a signed-in visual walk-through.** It was covered by
   API and route tests, not by eye. Do one before handover.
5. **Gallery shows at most 200 photos, videos at most 24.** Add pagination if
   she gets near either.

---

## 14. Adding a new public section

1. Add a public query that returns an **explicit field allowlist** (never `...doc`).
2. Add a loader in `lib/public-data.ts` (`cache` + `connection()`).
3. Component returns `null` when empty, or a deliberate empty state.
4. `<section id aria-labelledby className="scroll-mt-16 border-t …">`,
   section label `h2`, `max-w-6xl px-4 py-16 md:py-24`.
5. Add its link to `SiteNavLinks` behind the same emptiness check.
6. Place it inside the main `<Suspense>` in `app/page.tsx`.
7. Check: phone at 360px, dark mode, keyboard only, no new third-party requests.
