"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CreatorStatisticsPayload = {
  overview: {
    totalAttempts: number;
    uniquePlayers: number;
    uniqueGroups: number;
    averageDurationMs: number | null;
    averageFinalPoints: number | null;
    averageMaxPoints: number | null;
    averageAccuracyPercent: number | null;
    groupAttempts: number;
    individualAttempts: number;
  };
  levels: Array<{
    levelName: string;
    levelIndex: number;
    difficulty: string | null;
    attempts: number;
    averagePoints: number | null;
    averageMaxPoints: number | null;
    averageAccuracyPercent: number | null;
    averageBestTimeMs: number | null;
  }>;
  participants: Array<{
    displayName: string;
    userId: string | null;
    attempts: number;
    contributionScore: number;
    pasteCount: number;
    largePasteCount: number;
    focusLossCount: number;
    activeEditMs: number;
    editCount: number;
    resetLevelCount: number;
    resetGameCount: number;
  }>;
};

function formatDuration(ms: number | null): string {
  if (ms == null || ms < 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface CreatorStatisticsDialogProps {
  gameId: string;
  trigger?: (options: { openDialog: () => void }) => ReactNode;
}

export function CreatorStatisticsDialog({ gameId, trigger }: CreatorStatisticsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CreatorStatisticsPayload | null>(null);

  useEffect(() => {
    if (!open) return;
    let isCancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(apiUrl(`/api/games/${gameId}/statistics`));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to load statistics");
        }
        if (!isCancelled) {
          setPayload(data);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load statistics");
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
  }, [gameId, open]);

  return (
    <>
      {trigger ? (
        trigger({ openDialog: () => setOpen(true) })
      ) : (
        <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
          <BarChart3 className="h-4 w-4" />
          Statistics
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="z-[1200] max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Game statistics</DialogTitle>
            <DialogDescription>
              Completion, timing, level outcomes, and light telemetry indicators for this game.
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
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">Attempts</p><p className="text-2xl font-semibold">{payload.overview.totalAttempts}</p></div>
                <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">Unique players</p><p className="text-2xl font-semibold">{payload.overview.uniquePlayers}</p></div>
                <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">Average finish time</p><p className="text-2xl font-semibold">{formatDuration(payload.overview.averageDurationMs)}</p></div>
                <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">Average accuracy</p><p className="text-2xl font-semibold">{payload.overview.averageAccuracyPercent ?? 0}%</p></div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Levels</h3>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-background border-b">
                        <tr className="text-left">
                          <th className="px-3 py-2">Level</th>
                          <th className="px-3 py-2">Difficulty</th>
                          <th className="px-3 py-2">Avg accuracy</th>
                          <th className="px-3 py-2">Avg time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payload.levels.map((level) => (
                          <tr key={`${level.levelIndex}-${level.levelName}`} className="border-b last:border-b-0">
                            <td className="px-3 py-2">{level.levelName}</td>
                            <td className="px-3 py-2 capitalize">{level.difficulty ?? "—"}</td>
                            <td className="px-3 py-2">{level.averageAccuracyPercent ?? 0}%</td>
                            <td className="px-3 py-2">{formatDuration(level.averageBestTimeMs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Participants</h3>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-background border-b">
                        <tr className="text-left">
                          <th className="px-3 py-2">Player</th>
                          <th className="px-3 py-2">Contribution</th>
                          <th className="px-3 py-2">Paste</th>
                          <th className="px-3 py-2">Focus loss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payload.participants.map((participant) => (
                          <tr key={`${participant.userId ?? participant.displayName}`} className="border-b last:border-b-0">
                            <td className="px-3 py-2">{participant.displayName}</td>
                            <td className="px-3 py-2">{participant.contributionScore}</td>
                            <td className="px-3 py-2">{participant.pasteCount} / {participant.largePasteCount}</td>
                            <td className="px-3 py-2">{participant.focusLossCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
