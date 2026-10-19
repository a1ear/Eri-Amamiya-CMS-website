"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    // The same answer whether or not the address exists.
    setState(error && error.status !== 400 ? "error" : "sent");
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-5 border border-black p-6 dark:border-white">
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
        {state === "sent" ? (
          <p role="status" className="text-sm">
            If that email belongs to the site&apos;s admin account, a reset link is on its way. It expires in 1 hour.
            Check your spam folder too.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Enter your admin email and we&apos;ll send you a link to choose a new password.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input id="email" name="email" type="email" autoComplete="username" required className="w-full border border-black bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white" />
            </div>
            {state === "error" && (
              <p role="alert" className="text-sm font-medium">
                Too many requests or a connection problem. Wait a few minutes and try again.
              </p>
            )}
            <button type="submit" disabled={state === "sending"} className="w-full bg-black px-4 py-2.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:bg-white dark:text-black">
              {state === "sending" ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <Link href="/admin/login" className="block text-sm underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
