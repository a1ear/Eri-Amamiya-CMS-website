"use client";

import { ConvexError } from "convex/values";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const code = error instanceof ConvexError ? (error.data as { code?: string })?.code : undefined;
  const signedOut = code === "UNAUTHENTICATED" || code === "FORBIDDEN";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10" role="alert">
      <h1 className="text-xl font-semibold">
        {signedOut ? "Your session has ended" : "Something went wrong"}
      </h1>
      <p className="mt-2 text-sm">
        {signedOut
          ? "Sign in again to keep editing."
          : "Your changes were not lost on the server. Try again, and if it keeps happening, send a screenshot of this page to your developer."}
      </p>
      <div className="mt-6 flex gap-3">
        {signedOut ? (
          <Link href="/admin/login" className="bg-primary px-4 py-2 text-sm text-primary-foreground">
            Sign in
          </Link>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Try again
          </button>
        )}
      </div>
    </main>
  );
}
