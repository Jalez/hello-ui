"use client";

import { Trash2, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import type React from "react";
import { useEffect, createContext, useContext } from "react";
import { Drawer, DrawerContentLeft } from "@/components/tailwind/ui/drawer";
import { useSidebarCollapse } from "./context/SidebarCollapseContext";
import { ExpandButton } from "./SidebarExpandButton";
import { SidebarLink } from "./SidebarLink";
import { UserProfileMenu } from "./UserProfileMenu";
import { useGameStore } from "../games";
import { stripBasePath } from "@/lib/apiUrl";

// Context to override isCollapsed for mobile drawer
const MobileSidebarContext = createContext<boolean>(false);
export const useMobileSidebar = () => useContext(MobileSidebarContext);

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
  description?: string;
}

interface LeftSidebarProps {
  isUserAdmin: boolean;
  sidebarHeader?: React.ReactNode;
  children?: React.ReactNode;
}

export const Sidebar: React.FC<LeftSidebarProps> = ({ isUserAdmin, sidebarHeader, children }) => {
  const {
    isCollapsed,
    isMobile,
    isOverlayOpen,
    closeOverlay,
    setIsOverlayOpen,
    isVisible,
    setIsVisible,
    toggleCollapsed,
  } = useSidebarCollapse();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const getCurrentGame = useGameStore((state) => state.getCurrentGame);
  const game = getCurrentGame();

  const isCreatorRoute = normalizedPathname.startsWith("/creator/");
  const isGameRoute = normalizedPathname.startsWith("/game/");
  const isAuthRoute = normalizedPathname.startsWith("/auth/");
  const isHomeRoute = normalizedPathname === "/";
  const isPlayerRoute = isGameRoute;
  const showInlineSidebarOnMobile = false;
  const isResolvingGameOnGameRoute = isGameRoute && !game;
  const shouldHideForPlayerContext = isPlayerRoute && Boolean(game?.hideSidebar);
  const shouldHideSidebar =
    isResolvingGameOnGameRoute || (!isCreatorRoute && shouldHideForPlayerContext) || isAuthRoute;
  useEffect(() => {
    setIsVisible(!shouldHideSidebar);
    if (shouldHideSidebar && isOverlayOpen) {
      closeOverlay();
    }
  }, [closeOverlay, isOverlayOpen, setIsVisible, shouldHideSidebar]);

  const handleItemClick = () => {
    // Close overlay on mobile after navigation (Link handles the actual navigation)
    if (isMobile && isOverlayOpen) {
      closeOverlay();
    }
  };

  const isActive = (href: string) => {
    return normalizedPathname === href;
  };

  const handleDesktopRailClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile || !isCollapsed) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest("a, button, input, select, textarea, [role='button']")) {
      return;
    }

    toggleCollapsed();
  };

  // Get navigation items based on admin status
  const getAdminNavItems = () => {
    const items: NavItem[] = [];

    // Add admin items if user is admin
    if (isUserAdmin) {
      items.push({
        id: "admin-users",
        label: "User Management",
        icon: <Users className="h-5 w-5" />,
        href: "/admin/users",
        description: "Manage users and permissions",
      });
      items.push({
        id: "admin-maintenance",
        label: "Maintenance",
        icon: <Trash2 className="h-5 w-5" />,
        href: "/admin/maintenance",
        description: "Purge orphan levels and maps",
      });
    }

    return items;
  };

  if (!isVisible || shouldHideSidebar) {
    return null;
  }

  // Render immediately with default values, responsive state will update shortly

  const renderSidebarContent = (forceExpanded: boolean) => (
    <div className="flex h-full w-full min-h-0 flex-col">
      {sidebarHeader}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="flex min-h-full flex-col">
          {/* Navigation Items (for admins) */}
          {getAdminNavItems().map((item) => (
            <SidebarLink
              key={item.id}
              {...item}
              onClick={handleItemClick}
              isActive={isActive(item.href)}
              isCollapsed={forceExpanded ? false : isCollapsed}
              title={!forceExpanded && isCollapsed ? item.label : undefined}
            />
          ))}

          {/* Application-specific content */}
          {children}

          <div className="mt-auto">
            {!forceExpanded && <ExpandButton />}
            <UserProfileMenu />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`${showInlineSidebarOnMobile ? "flex" : "hidden md:flex"} relative z-20 h-full overflow-visible`}
      >
        <div
          className={`flex min-w-0 overflow-hidden flex-col items-start justify-start gap-2 group h-full bg-background border-r border-border/70 shadow-sm transition-[width] duration-300 ease-in-out ${
            isCollapsed ? "w-16 cursor-expand-sidebar" : "w-64"
          }`}
          data-sidebar
          onClick={handleDesktopRailClick}
        >
          <MobileSidebarContext.Provider value={false}>
            {renderSidebarContent(false)}
          </MobileSidebarContext.Provider>
        </div>
        {isHomeRoute && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-full top-0 h-full w-32 bg-gradient-to-r from-background/85 via-background/55 to-transparent"
          />
        )}
      </div>

      {/* Mobile Sidebar Drawer */}
      <Drawer open={isOverlayOpen} onOpenChange={setIsOverlayOpen}>
        <DrawerContentLeft className="md:hidden h-full">
          <MobileSidebarContext.Provider value={true}>
            <div
              id="mobile-sidebar"
              className="flex flex-col items-start justify-start gap-2 h-full w-full min-h-0 z-20 bg-background border-r border-border/70 shadow-sm"
              data-sidebar
            >
              {renderSidebarContent(true)}
            </div>
          </MobileSidebarContext.Provider>
        </DrawerContentLeft>
      </Drawer>
    </>
  );
};
