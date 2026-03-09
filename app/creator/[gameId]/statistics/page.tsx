'use client';

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useGameStore } from "@/components/default/games";
import { apiUrl } from "@/lib/apiUrl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

interface CreatorStatisticsPageProps {
  params: Promise<{
    gameId: string;
  }>;
}

function formatDuration(ms: number | null): string {
  if (ms == null || ms < 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function CreatorStatisticsPage({ params }: CreatorStatisticsPageProps) {
  const { gameId } = use(params);
  const { data: session } = useSession();
  const hasUser = Boolean(session?.user);
  const { loadGameById, setCurrentGameId, getCurrentGame } = useGameStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CreatorStatisticsPayload | null>(null);

  const game = getCurrentGame();

  useEffect(() => {
    const initializePage = async () => {
      if (!hasUser) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const loadedGame = await loadGameById(gameId);
        if (!loadedGame) {
          setError("Game not found");
          setIsLoading(false);
          return;
        }

        if (!(loadedGame.canEdit ?? loadedGame.isOwner)) {
          setError("You do not have permission to view this game's statistics.");
          setIsLoading(false);
          return;
        }

        setCurrentGameId(gameId);

        const response = await fetch(apiUrl(`/api/games/${gameId}/statistics`));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to load statistics");
        }

        setPayload(data);
        setIsLoading(false);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load statistics");
        setIsLoading(false);
      }
    };

    initializePage();
  }, [gameId, hasUser, loadGameById, setCurrentGameId]);

  const handleResetLeaderboard = async () => {
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

      const refreshResponse = await fetch(apiUrl(`/api/games/${gameId}/statistics`));
      const refreshData = await refreshResponse.json().catch(() => ({}));
      if (!refreshResponse.ok) {
        throw new Error(refreshData.error || "Failed to refresh statistics");
      }
      setPayload(refreshData);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Failed to reset leaderboard");
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading statistics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto px-4">
        <div className="w-full max-w-xl text-center space-y-4">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">{error}</h2>
          <Button asChild variant="outline">
            <Link href={`/creator/${gameId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Creator
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!payload) {
    return null;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Game Statistics</h1>
            <p className="text-muted-foreground mt-1">
              {game?.title ? `${game.title}. ` : ""}Completion, timing, level outcomes, and light telemetry indicators.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/creator/${gameId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Creator
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={handleResetLeaderboard} disabled={isResetting} className="gap-2">
              {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Reset Leaderboard
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Attempts</CardDescription>
              <CardTitle className="text-3xl">{payload.overview.totalAttempts}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unique Players</CardDescription>
              <CardTitle className="text-3xl">{payload.overview.uniquePlayers}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Finish Time</CardDescription>
              <CardTitle className="text-3xl">{formatDuration(payload.overview.averageDurationMs)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Accuracy</CardDescription>
              <CardTitle className="text-3xl">{payload.overview.averageAccuracyPercent ?? 0}%</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Group Attempts</CardDescription>
              <CardTitle className="text-2xl">{payload.overview.groupAttempts}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Individual Attempts</CardDescription>
              <CardTitle className="text-2xl">{payload.overview.individualAttempts}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Score</CardDescription>
              <CardTitle className="text-2xl">
                {Math.round(payload.overview.averageFinalPoints ?? 0)} / {Math.round(payload.overview.averageMaxPoints ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unique Groups</CardDescription>
              <CardTitle className="text-2xl">{payload.overview.uniqueGroups}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Levels</CardTitle>
              <CardDescription>Average outcomes by level</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left">
                    <tr>
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3">Difficulty</th>
                      <th className="px-4 py-3">Attempts</th>
                      <th className="px-4 py-3">Avg Accuracy</th>
                      <th className="px-4 py-3">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.levels.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                          No completed attempt data yet.
                        </td>
                      </tr>
                    ) : (
                      payload.levels.map((level) => (
                        <tr key={`${level.levelIndex}-${level.levelName}`} className="border-b last:border-b-0">
                          <td className="px-4 py-3">{level.levelName}</td>
                          <td className="px-4 py-3 capitalize">{level.difficulty ?? "—"}</td>
                          <td className="px-4 py-3">{level.attempts}</td>
                          <td className="px-4 py-3">{level.averageAccuracyPercent ?? 0}%</td>
                          <td className="px-4 py-3">{formatDuration(level.averageBestTimeMs)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
              <CardDescription>Activity and telemetry indicators</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left">
                    <tr>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Attempts</th>
                      <th className="px-4 py-3">Contribution</th>
                      <th className="px-4 py-3">Paste</th>
                      <th className="px-4 py-3">Focus Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.participants.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                          No participant statistics yet.
                        </td>
                      </tr>
                    ) : (
                      payload.participants.map((participant) => (
                        <tr key={`${participant.userId ?? participant.displayName}`} className="border-b last:border-b-0">
                          <td className="px-4 py-3">{participant.displayName}</td>
                          <td className="px-4 py-3">{participant.attempts}</td>
                          <td className="px-4 py-3">{participant.contributionScore}</td>
                          <td className="px-4 py-3">{participant.pasteCount} / {participant.largePasteCount}</td>
                          <td className="px-4 py-3">{participant.focusLossCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
