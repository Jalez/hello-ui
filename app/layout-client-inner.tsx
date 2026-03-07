"use client";

import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { SidebarCollapseProvider } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { RouteSidebarNavbar, Sidebar, SidebarProjectList, SidebarHeader } from "@/components/default/sidebar";
import Providers from "./AppProviders";

interface LayoutClientInnerProps {
  children: ReactNode;
  initialSidebarCollapsed: boolean;
  isUserAdmin: boolean;
  session: Session | null;
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
        <div className="flex h-full">
          <Sidebar 
            isUserAdmin={isUserAdmin}
            sidebarHeader={<SidebarHeader />}
          >
            <SidebarProjectList isUserAdmin={isUserAdmin} />
          </Sidebar>
          <main className="flex flex-1 flex-col overflow-hidden bg-background">
            <RouteSidebarNavbar />
            <div className="flex-1 overflow-hidden">
              {children}
            </div>
          </main>
        </div>
      </SidebarCollapseProvider>
    </Providers>
  );
}
