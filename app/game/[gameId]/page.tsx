'use client';

import { use, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import App from "@/components/App";
import { useGameStore } from "@/components/default/games";
import { CollaborationProvider } from "@/lib/collaboration";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GroupSelector } from "@/components/groups";

interface GamePageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default function GamePage({ params }: GamePageProps) {
  const { gameId } = use(params);
  const { data: session } = useSession();
  const { loadGameById, setCurrentGameId, addGameToStore } = useGameStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresGroup, setRequiresGroup] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    const initializeGame = async () => {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        setRequiresGroup(false);

        const normalizedParams = new URLSearchParams(searchParams.toString());
        if (normalizedParams.get("mode") !== "game") {
          normalizedParams.set("mode", "game");
          router.replace(`${pathname}?${normalizedParams.toString()}`);
        }

        const game = await loadGameById(gameId);
        if (!game) {
          setError("Game not found");
          setIsLoading(false);
          return;
        }

        if (game.collaborationMode === "group") {
          const groupId = searchParams.get("groupId");
          if (!groupId) {
            setRequiresGroup(true);
            setIsLoading(false);
            return;
          }

          const instanceRes = await fetch(`/api/games/${gameId}/instance?groupId=${encodeURIComponent(groupId)}`);
          if (!instanceRes.ok) {
            const payload = await instanceRes.json().catch(() => ({}));
            setError(payload.error || "Failed to load group game instance");
            setIsLoading(false);
            return;
          }
          const instancePayload = await instanceRes.json();
          addGameToStore({ ...game, progressData: instancePayload.instance?.progressData ?? {} });
          setRoomId(`group:${groupId}:game:${gameId}`);
        } else {
          const instanceRes = await fetch(`/api/games/${gameId}/instance`);
          if (instanceRes.ok) {
            const instancePayload = await instanceRes.json();
            addGameToStore({ ...game, progressData: instancePayload.instance?.progressData ?? {} });
          } else {
            addGameToStore(game);
          }
          // Individual mode also uses WS for persistence
          const userId = session.userId || session.user.email || "";
          setRoomId(`individual:${userId}:game:${gameId}`);
        }

        setCurrentGameId(gameId);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading game:", err);
        setError("Failed to load game");
        setIsLoading(false);
      }
    };

    initializeGame();
  }, [gameId, session, loadGameById, setCurrentGameId, searchParams, router, pathname, addGameToStore]);

  const handleGroupSelect = (groupId: string) => {
    const normalizedParams = new URLSearchParams(searchParams.toString());
    normalizedParams.set("mode", "game");
    normalizedParams.set("groupId", groupId);
    router.push(`${pathname}?${normalizedParams.toString()}`);
    setRequiresGroup(false);
    setIsLoading(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading game…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">{error}</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Please check if the game exists and you have access to it.
          </p>
        </div>
      </div>
    );
  }

  if (requiresGroup) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <div className="w-full max-w-xl rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Select Group</h2>
          <p className="text-sm text-muted-foreground">
            This game is in Group Work Mode. Choose your group to open the shared instance.
          </p>
          <GroupSelector
            selectedGroupId={searchParams.get("groupId")}
            onGroupSelect={handleGroupSelect}
          />
        </div>
      </div>
    );
  }

  // Wrap in CollaborationProvider so components using useCollaboration() don't throw.
  const user = session?.user
    ? {
        id: session.userId || session.user.email || "",
        email: session.user.email || "",
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
      }
    : null;

  return (
    <CollaborationProvider roomId={roomId} user={user}>
      <App />
    </CollaborationProvider>
  );
}
