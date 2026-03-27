"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { apiUrl, stripBasePath } from "@/lib/apiUrl";
import { useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { Loader2, Send } from "lucide-react";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";

interface LtiSessionInfo {
  isLtiMode: boolean;
  hasOutcomeService: boolean;
  isInIframe: boolean;
  courseName: string | null;
  returnUrl: string | null;
  role: string;
}

let ltiSessionRequest: Promise<LtiSessionInfo | null> | null = null;

function fetchLtiSessionCached(): Promise<LtiSessionInfo | null> {
  if (!ltiSessionRequest) {
    ltiSessionRequest = fetch(apiUrl("/api/games/lti-session"))
      .then(async (res) => {
        if (!res.ok) {
          return null;
        }
        return res.json() as Promise<LtiSessionInfo>;
      })
      .catch(() => null);
  }

  return ltiSessionRequest;
}

function stripCodeLevelsFromProgressData(progressData: Record<string, unknown> | undefined) {
  if (!progressData) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(progressData).filter(([key]) => key !== "levels"));
}

interface FinishGameViewProps {
  gameId: string;
  gameTitle?: string;
}

export function FinishGameView({ gameId, gameTitle }: FinishGameViewProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentGame = useGameStore((s) => s.getCurrentGame());
  const addGameToStore = useGameStore((s) => s.addGameToStore);
  const collaboration = useOptionalCollaboration();
  const points = useAppSelector((state) => state.points);

  const [ltiInfo, setLtiInfo] = useState<LtiSessionInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const isGroupGameplay = Boolean(searchParams.get("groupId"));
  const currentUserId = session?.userId || session?.user?.email || null;

  useEffect(() => {
    let cancelled = false;
    fetchLtiSessionCached().then((data) => {
      if (!cancelled) {
        setLtiInfo(data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const percentage =
    points.allMaxPoints > 0 ? Math.round((points.allPoints / points.allMaxPoints) * 100) : 0;

  const backHref = useMemo(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("view");
    const nextQuery = nextParams.toString();
    return nextQuery ? `${normalizedPathname}?${nextQuery}` : normalizedPathname;
  }, [normalizedPathname, searchParams]);

  const buildFinishUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("accessContext", "game");
    const groupId = searchParams.get("groupId");
    const guestId = searchParams.get("guestId");
    const key = searchParams.get("key");
    if (groupId) params.set("groupId", groupId);
    if (guestId) params.set("guestId", guestId);
    if (key) params.set("key", key);
    return `${apiUrl(`/api/games/${gameId}/finish`)}?${params.toString()}`;
  }, [gameId, searchParams]);

  const submitGradeDirectly = useCallback(async () => {
    const gradeRes = await fetch(apiUrl("/api/games/submit-grade"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        points: points.allPoints,
        maxPoints: points.allMaxPoints,
      }),
    });

    return gradeRes.json() as Promise<{
      success?: boolean;
      message?: string;
      error?: string;
      isInIframe?: boolean;
    }>;
  }, [gameId, points.allMaxPoints, points.allPoints]);

  const triggerAplusRefresh = useCallback(() => {
    if (typeof window === "undefined" || !window.parent) {
      return;
    }

    setTimeout(() => {
      window.parent.postMessage({ type: "edu-game-refresh-grade" }, "*");
      if (window.top) {
        window.top.location.reload();
      }
    }, 500);
  }, []);

  const handleFinishGame = useCallback(async () => {
    setIsSubmitting(true);
    setResult(null);

    try {
      const finishRes = await fetch(buildFinishUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: points.allPoints,
          maxPoints: points.allMaxPoints,
          progressData:
            currentGame?.progressData && typeof currentGame.progressData === "object" && !Array.isArray(currentGame.progressData)
              ? stripCodeLevelsFromProgressData(currentGame.progressData)
              : undefined,
          pointsByLevel: Object.fromEntries(
            Object.entries(points.levels).map(([name, data]) => {
              const levelData = data as Record<string, unknown>;
              return [
                name,
                {
                  points: levelData.points,
                  maxPoints: levelData.maxPoints,
                  accuracy: levelData.accuracy,
                  bestTime: levelData.bestTime,
                  scenarios: levelData.scenarios,
                },
              ];
            }),
          ),
        }),
      });

      const finishData = await finishRes.json();
      if (!finishRes.ok || !finishData.success) {
        setResult({
          success: false,
          error: finishData.error || "Failed to finish game",
        });
        setIsSubmitting(false);
        return;
      }

      if (currentGame && finishData.instance?.progressData) {
        addGameToStore({
          ...currentGame,
          progressData: finishData.instance.progressData,
        });
      }

      if (ltiInfo?.hasOutcomeService) {
        const fallbackGradeData = await submitGradeDirectly();
        if (fallbackGradeData.success) {
          const syncProgressData: Record<string, unknown> = {
            ltiGradeRefreshAt: new Date().toISOString(),
          };
          if (isGroupGameplay && currentUserId) {
            syncProgressData.userFinishStates = {
              [currentUserId]: {
                finishedAt: new Date().toISOString(),
                finalScore: { points: points.allPoints, maxPoints: points.allMaxPoints },
              },
            };
          } else {
            syncProgressData.finishedAt =
              finishData.instance?.progressData?.finishedAt ?? new Date().toISOString();
            syncProgressData.finalScore = { points: points.allPoints, maxPoints: points.allMaxPoints };
          }
          collaboration?.syncProgressData(syncProgressData);
          if (fallbackGradeData.isInIframe) {
            triggerAplusRefresh();
          }
        } else {
          setResult({
            success: true,
            message: "Game marked as finished. Grade could not be sent to A+.",
          });
        }
      }

      router.replace(backHref);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Failed to finish game",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    addGameToStore,
    backHref,
    buildFinishUrl,
    collaboration,
    currentGame,
    ltiInfo?.hasOutcomeService,
    points.allMaxPoints,
    points.allPoints,
    points.levels,
    router,
    submitGradeDirectly,
    triggerAplusRefresh,
    currentUserId,
    isGroupGameplay,
  ]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl rounded-xl border bg-card p-6 shadow-sm space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Finish game</h1>
          {gameTitle ? <p className="text-sm text-muted-foreground">{gameTitle}</p> : null}
          <p className="text-sm text-muted-foreground">
            Save your result and mark this game as finished.
            {ltiInfo?.hasOutcomeService
              ? isGroupGameplay
                ? " In group games, each member must submit their own score to A+ (Plussa)."
                : " Your score will also be submitted to A+ (Plussa)."
              : ""}
          </p>
        </div>

        <div className="rounded-lg bg-muted p-6 text-center">
          <div className="text-4xl font-bold">
            {points.allPoints} <span className="font-normal text-muted-foreground">/ {points.allMaxPoints}</span>
          </div>
          <div className="mt-2 text-xl text-muted-foreground">{percentage}%</div>
        </div>

        {ltiInfo?.courseName ? (
          <p className="text-sm text-muted-foreground">
            Course: <strong>{ltiInfo.courseName}</strong>
          </p>
        ) : null}

        {result ? (
          <div
            className={`rounded-md p-3 text-sm ${result.success
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"}`}
          >
            {result.success ? result.message : result.error}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => router.push(backHref)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleFinishGame} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : ltiInfo?.hasOutcomeService ? (
              <>
                <Send className="mr-2 h-4 w-4" />
                {isGroupGameplay ? "Finish and submit your score" : "Finish and submit to A+"}
              </>
            ) : (
              "Finish game"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
