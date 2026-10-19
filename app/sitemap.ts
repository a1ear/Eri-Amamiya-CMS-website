import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// One public page; sections are anchors on it.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl()}/`, changeFrequency: "weekly", priority: 1 }];
}
