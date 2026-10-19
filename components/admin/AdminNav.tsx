"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/profile", label: "Profile" },
  { href: "/admin/photos", label: "Photos" },
  { href: "/admin/videos", label: "Videos" },
  { href: "/admin/socials", label: "Socials" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/inbox", label: "Inbox" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const unread = useQuery(api.contact.unreadCount);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/admin/login");
  }

  return (
    <header className="border-b border-black dark:border-white">
      <nav
        aria-label="Admin"
        className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm"
      >
        {LINKS.map(({ href, label }) => {
          const current = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={`underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                current ? "font-semibold underline" : ""
              }`}
            >
              {label}
              {href === "/admin/inbox" && unread ? (
                <span className="ml-1.5 inline-flex min-w-5 justify-center bg-black px-1 text-xs font-semibold text-white dark:bg-white dark:text-black">
                  {unread}
                  <span className="sr-only"> new</span>
                </span>
              ) : null}
            </Link>
          );
        })}
        <span className="ml-auto flex items-center gap-4">
          <Link
            href="/"
            target="_blank"
            className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            View site<span className="sr-only"> (opens in new tab)</span> ↗
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="border border-black px-3 py-1 hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:border-white dark:hover:bg-white dark:hover:text-black"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </span>
      </nav>
    </header>
  );
}
