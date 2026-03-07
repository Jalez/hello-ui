"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { setupIframeThemeListener, type Theme } from "./iframeThemeListener";

/**
 * IframeThemeOverride Component
 *
 * This component detects when the app is running in an iframe and overrides
 * the theme selection with messages received from the parent iframe.
 *
 * It should be placed inside a ThemeProvider to work correctly.
 */
export const IframeThemeOverride: React.FC = () => {
  const { setTheme } = useTheme();

  useEffect(() => {
    // Listen for THEME_CHANGE postMessage events from embedding hosts.
    const cleanup = setupIframeThemeListener((receivedTheme: Theme) => {
      setTheme(receivedTheme);
    });

    // Cleanup on unmount
    return cleanup;
  }, [setTheme]);

  return null; // This component doesn't render anything
};
