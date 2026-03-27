"use client";

import type React from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import useSidebarPersistence from "../hooks/useSidebarPersistence";

const MOBILE_BREAKPOINT = 768;
const COLLAPSED_SIDEBAR_WIDTH = 64;
const DESKTOP_REENTRY_BREAKPOINT = MOBILE_BREAKPOINT + COLLAPSED_SIDEBAR_WIDTH;

interface SidebarCollapseContextType {
  isCollapsed: boolean;
  isMobile: boolean;
  isOverlayOpen: boolean;
  isVisible: boolean;
  hasResolvedResponsiveState: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  setIsOverlayOpen: (open: boolean) => void;
  setIsVisible: (visible: boolean) => void;
  toggleCollapsed: () => void;
  openOverlay: () => void;
  closeOverlay: () => void;
}

const SidebarCollapseContext = createContext<SidebarCollapseContextType | undefined>(undefined);

export const useSidebarCollapse = () => {
  const context = useContext(SidebarCollapseContext);
  if (!context) {
    throw new Error("useSidebarCollapse must be used within a SidebarCollapseProvider");
  }
  return context;
};

interface SidebarCollapseProviderProps {
  children: React.ReactNode;
  initialCollapsed?: boolean;
}

export const SidebarCollapseProvider: React.FC<SidebarCollapseProviderProps> = ({
  children,
  initialCollapsed = true
}) => {
  const getIsMobileForWidth = useCallback((width: number, previousIsMobile?: boolean) => {
    if (typeof previousIsMobile === "boolean") {
      if (previousIsMobile) {
        return width < DESKTOP_REENTRY_BREAKPOINT;
      }

      return width < MOBILE_BREAKPOINT;
    }

    return width < DESKTOP_REENTRY_BREAKPOINT;
  }, []);

  const [isCollapsed, setIsCollapsedState] = useSidebarPersistence("sidebar-collapsed", initialCollapsed);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return getIsMobileForWidth(window.innerWidth);
  });
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [hasResolvedResponsiveState, setHasResolvedResponsiveState] = useState(false);

  const syncResponsiveState = useCallback(() => {
    const width = window.innerWidth;
    const nextIsMobile = getIsMobileForWidth(width, isMobile);
    const isSmallScreen = width < 1024; // lg breakpoint

    setIsMobile((previousIsMobile) => {
      const resolvedIsMobile = getIsMobileForWidth(width, previousIsMobile);
      return previousIsMobile === resolvedIsMobile ? previousIsMobile : resolvedIsMobile;
    });
    setHasResolvedResponsiveState(true);

    if (!isSmallScreen && isOverlayOpen) {
      setIsOverlayOpen(false);
    }

    if (nextIsMobile && !isCollapsed) {
      setIsCollapsedState(true);
    }
  }, [getIsMobileForWidth, isCollapsed, isMobile, isOverlayOpen, setIsCollapsedState]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      syncResponsiveState();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [syncResponsiveState]);

  // Handle responsive behavior and resize events
  useEffect(() => {
    window.addEventListener("resize", syncResponsiveState);
    return () => window.removeEventListener("resize", syncResponsiveState);
  }, [syncResponsiveState]);

  const setIsCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed);
  }, [setIsCollapsedState]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsedState(prev => !prev);
  }, [setIsCollapsedState]);

  const openOverlay = useCallback(() => {
    setIsOverlayOpen(true);
  }, []);

  const closeOverlay = useCallback(() => {
    setIsOverlayOpen(false);
  }, []);

  return (
    <SidebarCollapseContext.Provider
      value={{
        isCollapsed,
        isMobile,
        isOverlayOpen,
        isVisible,
        hasResolvedResponsiveState,
        setIsCollapsed,
        setIsOverlayOpen,
        setIsVisible,
        toggleCollapsed,
        openOverlay,
        closeOverlay,
      }}
    >
      {children}
    </SidebarCollapseContext.Provider>
  );
};
