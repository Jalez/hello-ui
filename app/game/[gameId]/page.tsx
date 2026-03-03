'use client';

import { use, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import App from "@/components/App";
import { useGameStore } from "@/components/default/games";
import { CollaborationProvider } from "@/lib/collaboration";

interface GamePageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default function GamePage({ params }: GamePageProps) {
  const { gameId } = use(params);
  const { data: session } = useSession();
  const { loadGameById, setCurrentGameId, getGameById } = useGameStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeGame = async () => {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        const existingGame = getGameById(gameId);
        
        if (!existingGame) {
          const game = await loadGameById(gameId);
          
          if (!game) {
            setError("Game not found");
            setIsLoading(false);
            return;
          }
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
  }, [gameId, session, loadGameById, setCurrentGameId, getGameById]);

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

  // Wrap in CollaborationProvider so components using useCollaboration() don't throw.
  // No group context on /game/[gameId], so collaboration stays disabled (no WebSocket).
  const user = session?.user
    ? {
        id: session.userId || session.user.email || "",
        email: session.user.email || "",
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
      }
    : null;

  return (
    <CollaborationProvider groupId={null} user={user}>
      <App />
    </CollaborationProvider>
  );
}
