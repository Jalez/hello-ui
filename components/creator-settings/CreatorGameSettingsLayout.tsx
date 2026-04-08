"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CreatorGameSettingsProvider,
  useCreatorGameSettings,
  type CreatorGameSettingsInitialData,
} from "./CreatorGameSettingsContext";
import { CreatorGameSettingsSubnav } from "./CreatorGameSettingsSubnav";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function CreatorGameSettingsFrame({
  children,
  initialScrollTop,
}: {
  children: ReactNode;
  initialScrollTop: number;
}) {
  const { gameId, game, isLoading, error, draft, canEdit, saveError, saveSuccess, hasChanges, isSaving, handleSave } =
    useCreatorGameSettings();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = initialScrollTop;
  }, [initialScrollTop]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const cookieName = `creator-settings-scroll-${gameId}`;
    const handleScroll = () => {
      document.cookie = `${cookieName}=${encodeURIComponent(String(container.scrollTop))}; path=/creator/${gameId}/settings; SameSite=Lax`;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [gameId, pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading game settings...</p>
        </div>
      </div>
    );
  }

  if (error || !game || !draft || !canEdit) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Game Settings</CardTitle>
            <CardDescription>{error ?? "Unable to load settings."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/creator/${gameId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Creator
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-6xl px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Game Settings</h1>
            <p className="text-sm text-muted-foreground">{game.title || "Untitled Game"}</p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/creator/${gameId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Creator
            </Link>
          </Button>
        </div>
      </div>

      <div
        id="creator-game-settings-scroll"
        ref={scrollRef}
        className="flex-1 overflow-y-scroll bg-muted/20"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <aside>
              <CreatorGameSettingsSubnav gameId={gameId} />
            </aside>
            <section>{children}</section>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-6xl px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-sm min-h-5">
            {saveError && <p className="text-red-600">{saveError}</p>}
            {saveSuccess && <p className="text-emerald-600">{saveSuccess}</p>}
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CreatorGameSettingsLayout({
  gameId,
  initialData,
  initialScrollTop,
  children,
}: {
  gameId: string;
  initialData: CreatorGameSettingsInitialData;
  initialScrollTop: number;
  children: ReactNode;
}) {
  return (
    <CreatorGameSettingsProvider gameId={gameId} initialData={initialData}>
      <CreatorGameSettingsFrame initialScrollTop={initialScrollTop}>{children}</CreatorGameSettingsFrame>
      <script
        dangerouslySetInnerHTML={{
          __html: `(() => {
  const applyScroll = () => {
    const el = document.getElementById("creator-game-settings-scroll");
    if (!el) return false;
    el.scrollTop = ${JSON.stringify(initialScrollTop)};
    return true;
  };
  if (!applyScroll()) {
    requestAnimationFrame(applyScroll);
  }
})();`,
        }}
      />
    </CreatorGameSettingsProvider>
  );
}
