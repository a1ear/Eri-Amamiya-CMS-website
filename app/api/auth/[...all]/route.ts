import { handler } from "@/lib/auth-server";

// Proxies /api/auth/* to Better Auth running on the Convex HTTP router.
export const { GET, POST } = handler;
