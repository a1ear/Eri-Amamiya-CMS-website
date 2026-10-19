"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (error) {
      // One message for wrong email and wrong password, so the form never
      // confirms which accounts exist. Rate limiting gets its own message so
      // the owner knows to wait instead of retrying.
      setError(
        error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "Email or password is incorrect.",
      );
      return;
    }
    router.replace("/admin");
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 border border-black p-6 dark:border-white"
      >
        <h1 className="text-xl font-semibold tracking-tight">Admin sign in</h1>

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="w-full border border-black bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full border border-black bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-black px-4 py-2.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <Link href="/admin/forgot-password" className="block text-center text-sm underline underline-offset-4">
          Forgot your password?
        </Link>
      </form>
    </main>
  );
}
