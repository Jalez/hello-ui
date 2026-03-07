"use client";

import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { stripBasePath } from "@/lib/apiUrl";
import { useSidebarCollapse } from "./context/SidebarCollapseContext";

export const RouteSidebarNavbar = () => {
  const { isMobile, isOverlayOpen, isVisible, openOverlay } = useSidebarCollapse();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);

  const isGameRoute = normalizedPathname.startsWith("/game/");
  const isCreatorRoute = normalizedPathname.startsWith("/creator/");
  const isAuthRoute = normalizedPathname.startsWith("/auth/");
  const shouldRender = isMobile && isVisible && !isOverlayOpen && !isGameRoute && !isCreatorRoute && !isAuthRoute;

  if (!shouldRender) {
    return null;
  }

  return (
    <nav aria-label="Sidebar navigation bar" className="bg-transparent border-0 shadow-none">
      <div className="flex h-12 items-center px-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 bg-background text-foreground border border-border shadow-sm hover:bg-background"
          onClick={openOverlay}
          title="Open sidebar"
          aria-label="Open sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
      </div>
    </nav>
  );
};
