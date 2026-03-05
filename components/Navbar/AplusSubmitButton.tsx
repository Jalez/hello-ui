'use client';

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import { Flag, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAppSelector } from "@/store/hooks/hooks";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useGameStore } from "@/components/default/games";

interface LtiSessionInfo {
  isLtiMode: boolean;
  hasOutcomeService: boolean;
  isInIframe: boolean;
  courseName: string | null;
  returnUrl: string | null;
  role: string;
}

type NavbarActionDisplayMode = "icon-label" | "icon";

interface AplusSubmitButtonProps {
  displayMode?: NavbarActionDisplayMode;
}

export const AplusSubmitButton = ({ displayMode = "icon" }: AplusSubmitButtonProps) => {
  const params = useParams();
  const searchParams = useSearchParams();
  const currentGame = useGameStore((s) => s.getCurrentGame());
  const addGameToStore = useGameStore((s) => s.addGameToStore);

  const [ltiInfo, setLtiInfo] = useState<LtiSessionInfo | null>(null);
  const [ltiLoading, setLtiLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const points = useAppSelector((state) => state.points);

  const gameIdParam = params?.gameId;
  const gameId = typeof gameIdParam === "string" ? gameIdParam : Array.isArray(gameIdParam) ? gameIdParam[0] : null;
  const isGameRoute = Boolean(gameId);

  useEffect(() => {
    fetch(apiUrl("/api/games/lti-session"))
      .then((res) => res.json())
      .then((data) => {
        setLtiInfo(data);
        setLtiLoading(false);
      })
      .catch(() => setLtiLoading(false));
  }, []);

  const buildFinishUrl = useCallback(() => {
    if (!gameId) return apiUrl(`/api/games/${gameId}/finish`);
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

  const handleFinishGame = useCallback(async () => {
    if (!gameId) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const finishRes = await fetch(buildFinishUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: points.allPoints,
          maxPoints: points.allMaxPoints,
          pointsByLevel: Object.fromEntries(
            Object.entries(points.levels).map(([name, data]) => [
              name,
              { points: data.points, maxPoints: data.maxPoints, accuracy: data.accuracy, bestTime: data.bestTime, scenarios: data.scenarios },
            ])
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
        const gradeRes = await fetch(apiUrl("/api/games/submit-grade"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            points: points.allPoints,
            maxPoints: points.allMaxPoints,
          }),
        });
        const gradeData = await gradeRes.json();

        if (gradeData.success) {
          setResult({ success: true, message: gradeData.message });
          setShowDialog(false);
          if (gradeData.isInIframe && typeof window !== "undefined" && window.parent) {
            setTimeout(() => {
              window.parent.postMessage({ type: "a-plus-refresh-stats" }, "*");
              if (window.top) window.top.location.reload();
            }, 500);
          }
        } else {
          setResult({
            success: true,
            message: "Game marked as finished. Grade could not be sent to A+.",
          });
          setShowDialog(false);
        }
      } else {
        setResult({ success: true, message: "Game finished. Your result has been saved." });
        setShowDialog(false);
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Failed to finish game",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    gameId,
    buildFinishUrl,
    points.allPoints,
    points.allMaxPoints,
    currentGame,
    addGameToStore,
    ltiInfo?.hasOutcomeService,
  ]);

  const percentage =
    points.allMaxPoints > 0 ? Math.round((points.allPoints / points.allMaxPoints) * 100) : 0;

  if (!isGameRoute || !gameId) {
    return null;
  }

  return (
    <>
      {displayMode === "icon" ? (
        <PoppingTitle topTitle="Finish game">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowDialog(true)}
            title="Finish game and save result"
          >
            <Flag className="h-5 w-5" />
          </Button>
        </PoppingTitle>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => setShowDialog(true)}
          title="Finish game and save result"
        >
          <Flag className="h-5 w-5" />
          <span>Finish game</span>
        </Button>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="z-[1200]">
          <DialogHeader>
            <DialogTitle>Finish game</DialogTitle>
            <DialogDescription>
              Save your result and mark this game as finished. You can view your summary when you return.
              {ltiInfo?.hasOutcomeService && " Your score will also be submitted to A+ (Plussa)."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-muted rounded-lg p-4 text-center">
              <div className="text-3xl font-bold">
                {points.allPoints} / {points.allMaxPoints}
              </div>
              <div className="text-lg text-muted-foreground mt-1">{percentage}%</div>
            </div>

            {ltiInfo?.courseName && (
              <p className="text-sm text-muted-foreground mt-4">
                Course: <strong>{ltiInfo.courseName}</strong>
              </p>
            )}

            {result && (
              <div
                className={`mt-4 p-3 rounded-lg ${
                  result.success
                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                    : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                }`}
              >
                {result.success ? result.message : result.error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleFinishGame} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : ltiInfo?.hasOutcomeService ? (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Finish and submit to A+
                </>
              ) : (
                "Finish game"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
