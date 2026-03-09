'use client';

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl, stripBasePath } from "@/lib/apiUrl";
import { LeaderboardDialog } from "@/components/GameStatistics/LeaderboardDialog";
import { useGameStore } from "@/components/default/games";

export interface GameSummaryData {
  finishedAt?: string;
  finalScore?: { points: number; maxPoints: number };
  levels?: unknown[];
}

interface GameSummaryViewProps {
  gameId: string;
  gameTitle?: string;
  progressData: GameSummaryData;
  className?: string;
}

function stripCodeLevelsFromProgressData(progressData: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(progressData).filter(([key]) => key !== "levels")
  );
}

export function GameSummaryView({ gameId, gameTitle, progressData, className = "" }: GameSummaryViewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const normalizedPathname = stripBasePath(pathname);
  const searchParams = useSearchParams();
  const currentGame = useGameStore((state) => state.getCurrentGame());
  const addGameToStore = useGameStore((state) => state.addGameToStore);
  const finishedAt = progressData.finishedAt;
  const finalScore = progressData.finalScore;

  const params = new URLSearchParams(searchParams.toString());
  params.set("view", "play");
  const gamePageHref = `${normalizedPathname}?${params.toString()}`;

  const handleBackToGame = async () => {
    if (!currentGame) {
      router.push(gamePageHref);
      return;
    }

    const currentProgressData =
      currentGame.progressData && typeof currentGame.progressData === "object" && !Array.isArray(currentGame.progressData)
        ? currentGame.progressData
        : {};
    const nextProgressData = stripCodeLevelsFromProgressData({ ...currentProgressData });
    delete nextProgressData.finishedAt;
    delete nextProgressData.finalScore;

    addGameToStore({
      ...currentGame,
      progressData: nextProgressData,
    });

    const query = new URLSearchParams();
    query.set("accessContext", "game");
    const groupId = searchParams.get("groupId");
    const guestId = searchParams.get("guestId");
    const key = searchParams.get("key");
    if (groupId) query.set("groupId", groupId);
    if (guestId) query.set("guestId", guestId);
    if (key) query.set("key", key);

    try {
      await fetch(`${apiUrl(`/api/games/${gameId}/instance`)}?${query.toString()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressData: nextProgressData }),
      });
    } catch {
      // Local state already reflects replay mode; persistence can catch up later.
    }

    router.push(gamePageHref);
  };

  if (!finishedAt) {
    return null;
  }

  const points = typeof finalScore?.points === "number" ? finalScore.points : 0;
  const maxPoints = typeof finalScore?.maxPoints === "number" ? finalScore.maxPoints : 0;
  const percentage = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;
  const date = (() => {
    try {
      return new Date(finishedAt).toLocaleDateString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return finishedAt;
    }
  })();

  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[60vh] px-4 py-8 text-center ${className}`}
    >
      <div className="max-w-md w-full rounded-xl border bg-card p-8 shadow-sm space-y-6">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-500" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Game completed</h1>
          {gameTitle && (
            <p className="text-muted-foreground mt-1">{gameTitle}</p>
          )}
        </div>

        <div className="bg-muted rounded-lg p-6">
          <div className="text-4xl font-bold">
            {points} <span className="text-muted-foreground font-normal">/ {maxPoints}</span>
          </div>
          <div className="text-xl text-muted-foreground mt-2">{percentage}%</div>
        </div>

        <p className="text-sm text-muted-foreground">
          Completed on {date}. You can close this page or return to the course.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <LeaderboardDialog gameId={gameId} gameTitle={gameTitle} />
          <Button variant="outline" className="gap-2" onClick={handleBackToGame}>
            <ArrowLeft className="h-4 w-4" />
            Back to game
          </Button>
          <Button asChild variant="secondary" className="gap-2">
            <Link href="/games">View all games</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
