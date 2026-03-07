'use client';

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import Link from "next/link";
import { Globe, KeyRound, Loader2, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PublicGame {
  id: string;
  mapName: string;
  title: string;
  thumbnailUrl: string | null;
  shareToken: string | null;
  accessKeyRequired: boolean;
  createdAt: string;
  updatedAt: string;
  languages: {
    html: boolean;
    css: boolean;
    js: boolean;
  };
}

export default function GamesPage() {
  const [games, setGames] = useState<PublicGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch(apiUrl("/api/games/public"));
        if (!res.ok) throw new Error("Failed to fetch games");
        const data = await res.json();
        setGames(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    };
    fetchGames();
  }, []);

  const protectedGames = games.filter((game) => game.accessKeyRequired);
  const openGames = games.filter((game) => !game.accessKeyRequired);

  const renderGamesGrid = (items: PublicGame[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {items.map((game) => {
        const href = `/game/${game.id}?mode=game`;
        const languageBadges = [
          game.languages.html ? "HTML" : null,
          game.languages.css ? "CSS" : null,
          game.languages.js ? "JS" : null,
        ].filter(Boolean) as string[];

        return (
          <Link
            key={game.id}
            href={href}
            className="group rounded-xl border bg-card hover:shadow-md transition overflow-hidden"
          >
            <div className="relative h-36 bg-muted flex items-center justify-center overflow-hidden">
              {languageBadges.length > 0 && (
                <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
                  {languageBadges.map((label) => (
                    <Badge
                      key={label}
                      variant="secondary"
                      className="border border-background/70 bg-background/90 text-[10px] font-semibold tracking-[0.18em] uppercase shadow-sm"
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
              {game.thumbnailUrl ? (
                <img
                  src={game.thumbnailUrl}
                  alt={game.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <Globe className="h-10 w-10 text-muted-foreground/30" />
              )}
            </div>
            <div className="p-4">
              <p className="font-semibold truncate">{game.title || "Untitled Game"}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">{game.mapName}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Globe className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Public Games</h1>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <p className="text-center text-destructive py-10">{error}</p>
      )}

      {!isLoading && !error && games.length === 0 && (
        <p className="text-center text-muted-foreground py-10">
          No public games yet. Create a game and set it to public!
        </p>
      )}

      {!isLoading && !error && games.length > 0 && (
        <div className="space-y-10">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Unlock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Open Access</h2>
              <Badge variant="secondary">{openGames.length}</Badge>
            </div>
            {openGames.length > 0 ? (
              renderGamesGrid(openGames)
            ) : (
              <p className="text-sm text-muted-foreground">No open-access games.</p>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Access Key Required</h2>
              <Badge variant="secondary">{protectedGames.length}</Badge>
            </div>
            {protectedGames.length > 0 ? (
              renderGamesGrid(protectedGames)
            ) : (
              <p className="text-sm text-muted-foreground">No key-protected games.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
