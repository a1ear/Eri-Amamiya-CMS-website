"use client";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-24" role="alert">
      <h1 className="text-3xl font-semibold tracking-tight">This page didn’t load</h1>
      <p className="mt-3 text-[var(--muted)]">It’s probably a hiccup on our side. Try again in a moment.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 w-fit bg-[var(--foreground)] px-5 py-2.5 text-sm font-medium text-[var(--background)] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Try again
      </button>
    </main>
  );
}
