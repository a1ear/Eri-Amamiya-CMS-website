"use client";

import { useId, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { inputClass, primaryButton } from "./styles";

/** Change the admin password; signs out every other device. */
export function ChangePassword() {
  const id = useId();
  const [state, setState] = useState<{ kind: "idle" | "saving" | "done" | "error"; message?: string }>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const currentPassword = String(form.get("current") ?? "");
    const newPassword = String(form.get("new") ?? "");
    if (newPassword !== String(form.get("confirm") ?? "")) {
      setState({ kind: "error", message: "The new passwords don't match." });
      return;
    }
    if (newPassword.length < 12) {
      setState({ kind: "error", message: "Use at least 12 characters." });
      return;
    }
    setState({ kind: "saving" });
    const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    if (error) {
      setState({
        kind: "error",
        message:
          error.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : error.status === 400 || error.status === 401
              ? "Your current password is incorrect."
              : "Could not change the password. Try again.",
      });
      return;
    }
    formEl.reset();
    setState({ kind: "done", message: "Password changed. Other devices have been signed out." });
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="mt-12 border-t border-black pt-6 dark:border-white">
      <h2 id={`${id}-heading`} className="text-sm font-semibold uppercase tracking-wider">
        Password
      </h2>
      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-3">
        {(
          [
            ["current", "Current password", "current-password"],
            ["new", "New password (12+)", "new-password"],
            ["confirm", "New password again", "new-password"],
          ] as const
        ).map(([name, label, autoComplete]) => (
          <div key={name} className="space-y-1.5">
            <label htmlFor={`${id}-${name}`} className="block text-sm font-medium">
              {label}
            </label>
            <input id={`${id}-${name}`} name={name} type="password" autoComplete={autoComplete} required className={inputClass} />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
          <button type="submit" disabled={state.kind === "saving"} className={primaryButton}>
            {state.kind === "saving" ? "Saving…" : "Change password"}
          </button>
          <p role={state.kind === "error" ? "alert" : "status"} className="text-sm font-medium">
            {state.message}
          </p>
        </div>
      </form>
    </section>
  );
}
