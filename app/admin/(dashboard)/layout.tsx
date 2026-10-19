import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <Suspense fallback={<GateFallback />}>
        <AdminGate>
          <AdminNav />
          {children}
        </AdminGate>
      </Suspense>
    </div>
  );
}

/**
 * Redirects non-admins to the login page. This is a courtesy for the UI only:
 * every admin Convex function re-checks the session and admin row itself.
 */
async function AdminGate({ children }: { children: ReactNode }) {
  const isAdmin = await fetchAuthQuery(api.admin.isAdmin).catch(() => false);
  if (!isAdmin) redirect("/admin/login");
  return children;
}

function GateFallback() {
  return (
    <p role="status" className="p-8 text-sm text-muted-foreground">
      Checking your session…
    </p>
  );
}
