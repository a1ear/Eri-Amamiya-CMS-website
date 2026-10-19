import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-24">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]">404</p>
      <h1 className="mt-4 text-[clamp(2.5rem,8vw,4.5rem)] font-semibold leading-none tracking-[-0.04em]">
        This page doesn&apos;t exist.
      </h1>
      <p className="mt-4 text-lg text-[var(--muted)]">The link may be old, or the address mistyped.</p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-12 w-fit items-center bg-[var(--foreground)] px-6 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--background)] hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        Go to the homepage
      </Link>
    </main>
  );
}
