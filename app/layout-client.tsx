import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { LayoutClientInner } from "./layout-client-inner";

interface LayoutClientProps {
  children: ReactNode;
}

export async function LayoutClient({ children }: LayoutClientProps) {
  // Read sidebar state from cookies on the server
  const initialSidebarCollapsed = await (async () => {
    try {
      const cookieStore = await cookies();
      const sidebarCookie = cookieStore.get("sidebar-collapsed")?.value;
      if (!sidebarCookie) {
        return true;
      }

      const decodedValue = decodeURIComponent(sidebarCookie);
      if (decodedValue === "true") {
        return true;
      }
      if (decodedValue === "false") {
        return false;
      }
      if (decodedValue === "undefined") {
        return true; // Default to collapsed if undefined
      }

      // Fall back to JSON parsing for future extensibility
      return JSON.parse(decodedValue);
    } catch (error) {
      console.error("Error reading sidebar cookie:", error);
      return true;
    }
  })();

  // Get session on server to pass to SessionProvider (eliminates initial /api/auth/session call)
  const session = (await getServerSession(authOptions)) as Session | null;

  // Check admin status on the server so sidebar shows admin nav (e.g. Maintenance).
  // 1) Env fallback: ADMIN_EMAIL (e.g. in Docker when DB seed not run) — match session email case-insensitively.
  // 2) DB: prefer email (case-insensitive), then userId; sync duplicate user rows if needed.
  let isUserAdmin = false;
  const adminEmailEnv = process.env.ADMIN_EMAIL?.trim();
  if (session?.user?.email && adminEmailEnv) {
    isUserAdmin = session.user.email.trim().toLowerCase() === adminEmailEnv.toLowerCase();
  }
  if (!isUserAdmin) {
    const { isAdminByEmail, isAdmin, ensureAdminForEmailMatch } = await import("@/app/api/_lib/services/adminService");
    try {
      if (session?.user?.email) {
        isUserAdmin = await isAdminByEmail(session.user.email);
        if (isUserAdmin && session?.userId && !(await isAdmin(session.userId))) {
          await ensureAdminForEmailMatch(session.user.email, session.userId);
          isUserAdmin = true;
        }
      }
      if (!isUserAdmin && session?.userId) {
        isUserAdmin = await isAdmin(session.userId);
      }
    } catch {
      isUserAdmin = false;
    }
  }

  return (
    <LayoutClientInner 
      initialSidebarCollapsed={initialSidebarCollapsed} 
      isUserAdmin={isUserAdmin}
      session={session}
    >
      {children}
    </LayoutClientInner>
  );
}
