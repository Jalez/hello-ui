"use client";

import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { SidebarCollapseProvider, useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { RouteSidebarNavbar, Sidebar, SidebarProjectList, SidebarHeader } from "@/components/default/sidebar";
import Providers from "./AppProviders";

interface LayoutClientInnerProps {
  children: ReactNode;
  initialSidebarCollapsed: boolean;
  isUserAdmin: boolean;
  session: Session | null;
}

interface LayoutShellProps {
  children: ReactNode;
  isUserAdmin: boolean;
}

function LayoutShell({ children, isUserAdmin }: LayoutShellProps) {
  const { isCollapsed, isMobile, isVisible, hasResolvedResponsiveState } = useSidebarCollapse();
  const shouldReserveDesktopSidebarSpace = hasResolvedResponsiveState && isVisible && !isMobile;
  const desktopSidebarOffsetClass = shouldReserveDesktopSidebarSpace
    ? (isCollapsed ? "pl-16" : "pl-64")
    : "pl-0";

  return (
    <div className="relative flex h-full min-w-0">
      <Sidebar
        isUserAdmin={isUserAdmin}
        sidebarHeader={<SidebarHeader />}
      >
        <SidebarProjectList />
      </Sidebar>
      <main
        className={`flex min-w-0 flex-1 flex-col overflow-hidden bg-background transition-[padding] duration-300 ease-in-out ${desktopSidebarOffsetClass}`}
      >
        <RouteSidebarNavbar />
        <div className="min-w-0 flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}

export function LayoutClientInner({ 
  children, 
  initialSidebarCollapsed, 
  isUserAdmin,
  session 
}: LayoutClientInnerProps) {
  return (
    <Providers session={session}>
      <SidebarCollapseProvider initialCollapsed={initialSidebarCollapsed}>
        <LayoutShell isUserAdmin={isUserAdmin}>
          {children}
        </LayoutShell>
      </SidebarCollapseProvider>
    </Providers>
  );
}
