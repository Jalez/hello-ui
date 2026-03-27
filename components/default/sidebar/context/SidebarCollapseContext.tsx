"use client";

import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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
  const isMobileRef = useRef(isMobile);
  const isCollapsedRef = useRef(isCollapsed);
  const isOverlayOpenRef = useRef(isOverlayOpen);
  const resizeFrameRef = useRef<number | null>(null);

  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  useEffect(() => {
    isCollapsedRef.current = isCollapsed;
  }, [isCollapsed]);

  useEffect(() => {
    isOverlayOpenRef.current = isOverlayOpen;
  }, [isOverlayOpen]);

  const syncResponsiveState = useCallback(() => {
    const width = window.innerWidth;
    const nextIsMobile = getIsMobileForWidth(width, isMobileRef.current);
    const isSmallScreen = width < 1024; // lg breakpoint

    setIsMobile((previousIsMobile) => {
      const resolvedIsMobile = getIsMobileForWidth(width, previousIsMobile);
      return previousIsMobile === resolvedIsMobile ? previousIsMobile : resolvedIsMobile;
    });
    setHasResolvedResponsiveState(true);

    if (!isSmallScreen && isOverlayOpenRef.current) {
      setIsOverlayOpen(false);
    }

    if (nextIsMobile && !isCollapsedRef.current) {
      setIsCollapsedState(true);
    }
  }, [getIsMobileForWidth, setIsCollapsedState]);

  const scheduleResponsiveSync = useCallback(() => {
    if (resizeFrameRef.current != null) {
      return;
    }

    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null;
      syncResponsiveState();
    });
  }, [syncResponsiveState]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      syncResponsiveState();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (resizeFrameRef.current != null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [syncResponsiveState]);

  // Handle responsive behavior and resize events
  useEffect(() => {
    window.addEventListener("resize", scheduleResponsiveSync, { passive: true });
    return () => window.removeEventListener("resize", scheduleResponsiveSync);
  }, [scheduleResponsiveSync]);

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
