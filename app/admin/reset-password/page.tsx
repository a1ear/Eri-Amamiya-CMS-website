"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

const input =
  "w-full border border-[var(--line-strong)] bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-5 border border-[var(--line-strong)] p-6">
        <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
        <Suspense fallback={<p className="text-sm">Loading…</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "done" | "error"; message?: string }>({ kind: "idle" });

  if (!token || params.get("error")) {
    return (
      <>
        <p role="alert" className="text-sm">
          This reset link is invalid or has expired. Links work once and last 1 hour.
        </p>
        <Link href="/admin/forgot-password" className="block text-sm underline underline-offset-4">
          Send a new link
        </Link>
      </>
    );
  }

  if (state.kind === "done") {
    return (
      <>
        <p role="status" className="text-sm">
          Password changed. You&apos;ve been signed out on all devices.
        </p>
        <Link href="/admin/login" className="block text-sm underline underline-offset-4">
          Sign in
        </Link>
      </>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("password") ?? "");
    if (newPassword !== String(form.get("confirm") ?? "")) {
      setState({ kind: "error", message: "The two passwords don't match." });
      return;
    }
    if (newPassword.length < 12) {
      setState({ kind: "error", message: "Use at least 12 characters." });
      return;
    }
    setState({ kind: "saving" });
    const { error } = await authClient.resetPassword({ newPassword, token: token! });
    setState(
      error
        ? { kind: "error", message: error.status === 429 ? "Too many attempts. Wait a minute." : "This link is invalid or has expired. Request a new one." }
        : { kind: "done" },
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium">
          New password <span className="font-normal text-muted-foreground">(12+ characters)</span>
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required className={input} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="block text-sm font-medium">
          Type it again
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={input} />
      </div>
      {state.kind === "error" && (
        <p role="alert" className="text-sm font-medium">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={state.kind === "saving"} className="press w-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">
        {state.kind === "saving" ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
