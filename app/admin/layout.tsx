import type { Metadata } from "next";
import { ConvexClientProvider } from "./ConvexClientProvider";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// The auth-aware Convex client lives only under /admin, so public visitors
// never make a session/token request.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
