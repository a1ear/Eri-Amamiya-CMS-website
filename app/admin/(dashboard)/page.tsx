"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";

const SECTIONS = [
  { href: "/admin/profile", title: "Profile", description: "Name, photo, intro and About section" },
  { href: "/admin/photos", title: "Photos", description: "Upload, caption, reorder and hide cosplay photos" },
  { href: "/admin/videos", title: "Featured videos", description: "Links to your best TikToks, YouTube videos and clips" },
  { href: "/admin/socials", title: "Social links", description: "Where fans can follow you" },
  { href: "/admin/schedule", title: "Stream schedule", description: "Weekly streams, days off and extra streams" },
  { href: "/admin/inbox", title: "Inbox", description: "Collab and brand messages from your contact form" },
];

export default function AdminHome() {
  const me = useQuery(api.admin.me);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground" role="status">
        {me === undefined ? "Loading…" : `Signed in as ${me.email}`}
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="block h-full border border-[var(--line-strong)] p-4 hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="font-medium">{section.title}</span>
              <span className="mt-1 block text-sm opacity-75">{section.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
