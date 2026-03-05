'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createGame } from "@/components/default/games/service/basic/create";
import { Loader2, LogIn, Play, Plus } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateGame = async () => {
    try {
      setIsCreating(true);
      const game = await createGame({ title: "New Game" });
      router.push(`/creator/${game.id}`);
    } catch (error) {
      console.error("Failed to create game:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const isLoading = status === "loading";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          Welcome to UI Designer
        </h1>
        <p className="text-xl text-muted-foreground">
          Master CSS and web design through interactive challenges and projects.
        </p>

        <div className="flex flex-wrap gap-4 justify-center mt-8">
          {isLoading ? (
            <Button size="lg" disabled className="text-lg px-8 py-6">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Checking access...
            </Button>
          ) : session ? (
            <>
              <Link href="/games">
                <Button size="lg" className="text-lg px-8 py-6 gap-2">
                  <Play className="h-5 w-5 fill-current" />
                  Start Playing
                </Button>
              </Link>
              <Button
                size="lg"
                variant="secondary"
                className="text-lg px-8 py-6 gap-2"
                onClick={handleCreateGame}
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
                Create a game
              </Button>
            </>
          ) : (
            <Link href="/auth/signin">
              <Button size="lg" className="text-lg px-8 py-6 gap-2">
                <LogIn className="h-5 w-5" />
                Log in to start playing
              </Button>
            </Link>
          )}

          <Link href="/help">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6">
              Learn More
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
