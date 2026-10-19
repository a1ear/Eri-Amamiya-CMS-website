// Browser error monitoring. A no-op until NEXT_PUBLIC_SENTRY_DSN is set.
// Loaded with a dynamic import so the SDK (~100 KB) is never in the critical
// bundle: visitors without a DSN configured never download it, and with one it
// arrives after the page is interactive.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
        // Errors only: no performance tracing or session replay, which would
        // add weight on slow phones for little value on a portfolio site.
        tracesSampleRate: 0,
      }),
    )
    .catch(() => {
      // Monitoring must never break the site.
    });
}
