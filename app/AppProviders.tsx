"use client";

import { SessionProvider, useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { ThemeProvider, useTheme } from "next-themes";
import { type ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { LoadingProvider } from "@/components/default/loading";
import { NotificationProvider } from "@/components/default/notifications";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReduxProvider } from "@/components/providers/ReduxProvider";
import { IframeThemeOverride } from "@/components/tailwind/utils/IframeThemeOverride";

const ToasterProvider = () => {
  const { theme } = useTheme() as {
    theme: "light" | "dark" | "system";
  };
  return <Toaster theme={theme} />;
};

const AppInitializer = () => {
  const { status } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    // Billing/credits initialization intentionally disabled.
    if (status === "loading") {
      return;
    }
  }, [status]);

  useEffect(() => {
    const targetHeight = 900;
    const sendResizeMessage = () => {
      try {
        window.parent.postMessage({ subject: "lti.frameResize", height: targetHeight }, "*");
        window.parent.postMessage({ type: "a-plus-resize-iframe", height: targetHeight }, "*");
      } catch (error) {
        console.warn("Could not post frameResize message to parent", error);
      }
    };

    sendResizeMessage();
    const rafId = window.requestAnimationFrame(sendResizeMessage);
    const timeoutId = window.setTimeout(sendResizeMessage, 150);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [pathname]);

  return null;
};

interface ProvidersProps {
  children: ReactNode;
  session?: Session | null;
}

export default function Providers({ children, session }: ProvidersProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <SessionProvider
        session={session}
        basePath={
          process.env.NEXT_PUBLIC_BASE_PATH
            ? `${process.env.NEXT_PUBLIC_BASE_PATH}/api/auth`
            : undefined
        }
        refetchOnWindowFocus={false}
        refetchInterval={0}
        refetchWhenOffline={false}
      >
        <ThemeProvider attribute="class" enableSystem disableTransitionOnChange defaultTheme="system">
          <IframeThemeOverride />
          <LoadingProvider>
            <ReduxProvider>
              <NotificationProvider />
              <AppInitializer />
              <ToasterProvider />
              {children}
            </ReduxProvider>
          </LoadingProvider>
        </ThemeProvider>
      </SessionProvider>
    </TooltipProvider>
  );
}
