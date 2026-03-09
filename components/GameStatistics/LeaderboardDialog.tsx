"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { Trophy, Loader2, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LeaderboardPayload = {
  entries: Array<{
    rank: number;
    attemptId: string;
    scope: string;
    finishedAt: string;
    durationMs: number | null;
    finalPoints: number;
    maxPoints: number;
    accuracyPercent: number;
    displayName: string;
  }>;
  summary: {
    totalAttempts: number;
    topScore: number;
    topDurationMs: number | null;
    myStats: null | {
      bestAttemptId: string;
      bestRank: number | null;
      bestScore: number;
      bestMaxPoints: number;
      bestDurationMs: number | null;
      recentAttempts: Array<{
        attemptId: string;
        finishedAt: string;
        finalPoints: number;
        maxPoints: number;
        durationMs: number | null;
        accuracyPercent: number;
      }>;
    };
    timeToBeatTop: number | null;
    timeToBeatTop10: number | null;
  };
  canResetLeaderboard?: boolean;
};

function formatDuration(ms: number | null): string {
  if (ms == null || ms < 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readGuestId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("ui-designer-guest-id");
  } catch {
    return null;
  }
}

interface LeaderboardDialogProps {
  gameId: string;
  gameTitle?: string;
  trigger?: (options: { openDialog: () => void }) => ReactNode;
}

export function LeaderboardDialog({ gameId, gameTitle, trigger }: LeaderboardDialogProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<LeaderboardPayload | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const leaderboardUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (!session?.user) {
      const guestId = readGuestId();
      if (guestId) {
        params.set("guestId", guestId);
      }
    }
    const query = params.toString();
    return `${apiUrl(`/api/games/${gameId}/leaderboard`)}${query ? `?${query}` : ""}`;
  }, [gameId, session?.user]);

  useEffect(() => {
    if (!open) return;
    let isCancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(leaderboardUrl);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to load leaderboard");
        }
        if (!isCancelled) {
          setPayload(data);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load leaderboard");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      isCancelled = true;
    };
  }, [leaderboardUrl, open, refreshToken]);

  const handleResetLeaderboard = async () => {
    if (!payload?.canResetLeaderboard) {
      return;
    }

    const confirmed = window.confirm(
      "Reset the leaderboard for this game? This deletes all recorded attempt statistics for the game.",
    );
    if (!confirmed) {
      return;
    }

    try {
      setIsResetting(true);
      const response = await fetch(apiUrl(`/api/games/${gameId}/leaderboard/reset`), {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to reset leaderboard");
      }
      setRefreshToken((value) => value + 1);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Failed to reset leaderboard");
    } finally {
      setIsResetting(false);
    }
  };

  const content = (
    <>
      {trigger ? (
        trigger({ openDialog: () => setOpen(true) })
      ) : (
        <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
          <Trophy className="h-4 w-4" />
          Leaderboard
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="z-[1200] max-w-3xl">
          <DialogHeader>
            <DialogTitle>Leaderboard</DialogTitle>
            <DialogDescription>
              {gameTitle ? `${gameTitle}. ` : ""}Ranked by highest score first, then fastest finish time.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : payload ? (
            <div className="space-y-6">
              {payload.canResetLeaderboard && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleResetLeaderboard}
                    disabled={isResetting}
                  >
                    {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Reset Leaderboard
                  </Button>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Top score</p>
                  <p className="text-2xl font-semibold">{payload.summary.topScore}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Time to beat #1</p>
                  <p className="text-2xl font-semibold">{formatDuration(payload.summary.timeToBeatTop)}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Time to beat top 10</p>
                  <p className="text-2xl font-semibold">{formatDuration(payload.summary.timeToBeatTop10)}</p>
                </div>
              </div>

              {payload.summary.myStats && (
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-sm font-medium">Your best</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>Rank: {payload.summary.myStats.bestRank ?? "—"}</span>
                    <span>Score: {payload.summary.myStats.bestScore} / {payload.summary.myStats.bestMaxPoints}</span>
                    <span>Time: {formatDuration(payload.summary.myStats.bestDurationMs)}</span>
                  </div>
                </div>
              )}

              <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-left">
                      <th className="px-3 py-2">Rank</th>
                      <th className="px-3 py-2">Player</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Accuracy</th>
                      <th className="px-3 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.entries.map((entry) => (
                      <tr key={entry.attemptId} className="border-b last:border-b-0">
                        <td className="px-3 py-2 font-medium">#{entry.rank}</td>
                        <td className="px-3 py-2">{entry.displayName}</td>
                        <td className="px-3 py-2">{entry.finalPoints} / {entry.maxPoints}</td>
                        <td className="px-3 py-2">{entry.accuracyPercent}%</td>
                        <td className="px-3 py-2">{formatDuration(entry.durationMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );

  return content;
}
