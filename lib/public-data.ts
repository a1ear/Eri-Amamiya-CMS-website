import "server-only";
import { fetchQuery } from "convex/nextjs";
import { connection } from "next/server";
import { cache } from "react";
import { api } from "@/convex/_generated/api";
import { addDays, dateInZone } from "@/convex/lib/schedule";

/*
 * Public data, read fresh per request so an edit in the dashboard shows on
 * the next page load. `connection()` keeps these out of the build-time
 * prerender (otherwise build-time data would be baked into the static shell).
 * `cache` dedupes each call across sections within one request.
 */

export const getPublicProfile = cache(async () => {
  await connection();
  return fetchQuery(api.profile.getPublic);
});

export const getPublicPhotos = cache(async () => {
  await connection();
  return fetchQuery(api.photos.listPublic);
});

export type PublicPhoto = Awaited<ReturnType<typeof getPublicPhotos>>[number];

export const getPublicVideos = cache(async () => {
  await connection();
  return fetchQuery(api.videos.listPublic);
});

export const getPublicSocials = cache(async () => {
  await connection();
  return fetchQuery(api.socials.list);
});

export type PublicVideo = Awaited<ReturnType<typeof getPublicVideos>>[number];
export type PublicSocial = Awaited<ReturnType<typeof getPublicSocials>>[number];

/** Schedule plus the request time it was computed for (one clock per request). */
export const getPublicSchedule = cache(async () => {
  await connection();
  const nowMs = Date.now();
  const fromDate = addDays(dateInZone(nowMs, "UTC"), -1);
  return { nowMs, schedule: await fetchQuery(api.schedule.getPublic, { fromDate }) };
});
