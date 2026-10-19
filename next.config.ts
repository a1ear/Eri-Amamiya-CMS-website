import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Profile photos are served from Convex file storage on the deployment's own
// host (http://127.0.0.1:3210 locally, https://<name>.convex.cloud in prod).
const convexUrl = new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://invalid.convex.cloud");
const convexWs = `${convexUrl.protocol === "https:" ? "wss:" : "ws:"}//${convexUrl.host}`;

const TURNSTILE = "https://challenges.cloudflare.com";
const SENTRY_INGEST = "https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io";

/**
 * Content Security Policy. Scripts allow 'unsafe-inline' because Next.js
 * streams inline bootstrap scripts and nonces would force every page
 * dynamic; XSS is handled at the source instead (React escaping, no raw HTML
 * from users, JSON-LD escaped). Everything else is locked to known hosts.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} ${TURNSTILE}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${convexUrl.origin} https://i.ytimg.com`,
  "font-src 'self'",
  `connect-src 'self' ${convexUrl.origin} ${convexWs} ${TURNSTILE} ${SENTRY_INGEST} ${isDev ? "ws: wss:" : ""}`,
  `frame-src ${TURNSTILE}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  isDev ? "" : "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ")
  .replace(/\s+/g, " ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      {
        protocol: convexUrl.protocol.replace(":", "") as "http" | "https",
        hostname: convexUrl.hostname,
        port: convexUrl.port,
        pathname: "/api/storage/**",
      },
      // YouTube thumbnails for featured videos (derived from the video id).
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
    ],
    // The optimizer blocks private IPs by default. Allowed only when the Convex
    // backend itself is the local dev backend (127.0.0.1); never in a real
    // deployment, whose Convex URL is a public *.convex.cloud host.
    dangerouslyAllowLocalIP: ["127.0.0.1", "localhost"].includes(convexUrl.hostname),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
