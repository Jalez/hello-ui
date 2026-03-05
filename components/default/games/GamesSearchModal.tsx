"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import type { Game } from "./types";
import { loadPublicGames } from "./service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface GamesSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userGames: Game[];
  onGameClick?: () => void;
}

function gameLabel(game: Game): string {
  return game.title || "Untitled Game";
}

function matchesQuery(game: Game, query: string): boolean {
  const normalized = query.toLowerCase();
  return (
    gameLabel(game).toLowerCase().includes(normalized) ||
    (game.mapName || "").toLowerCase().includes(normalized)
  );
}

export function GamesSearchModal({ open, onOpenChange, userGames, onGameClick }: GamesSearchModalProps) {
  const [query, setQuery] = useState("");
  const [publicGames, setPublicGames] = useState<Game[]>([]);
  const [loadingPublicGames, setLoadingPublicGames] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    let isMounted = true;

    const fetchPublicGames = async () => {
      try {
        setLoadingPublicGames(true);
        const games = await loadPublicGames();
        if (isMounted) {
          setPublicGames(games);
        }
      } catch (error) {
        if (isMounted) {
          setPublicGames([]);
        }
      } finally {
        if (isMounted) {
          setLoadingPublicGames(false);
        }
      }
    };

    fetchPublicGames();
    return () => {
      isMounted = false;
    };
  }, [open]);

  const creatorGames = useMemo(
    () => userGames.filter((game) => Boolean(game.isOwner)),
    [userGames],
  );

  const playedGames = useMemo(
    () => userGames.filter((game) => !game.isOwner),
    [userGames],
  );

  const userGameIds = useMemo(() => new Set(userGames.map((game) => game.id)), [userGames]);

  const publicUnplayedGames = useMemo(
    () => publicGames.filter((game) => !userGameIds.has(game.id)),
    [publicGames, userGameIds],
  );

  const visibleCreatorGames = useMemo(
    () => creatorGames.filter((game) => matchesQuery(game, query)),
    [creatorGames, query],
  );

  const visiblePlayedGames = useMemo(
    () => playedGames.filter((game) => matchesQuery(game, query)),
    [playedGames, query],
  );

  const visiblePublicUnplayedGames = useMemo(
    () => publicUnplayedGames.filter((game) => matchesQuery(game, query)),
    [publicUnplayedGames, query],
  );

  const openGame = (route: string) => {
    onOpenChange(false);
    router.push(route);
    onGameClick?.();
  };

  const renderList = (games: Game[], mode: "creator" | "game", emptyText: string) => {
    if (games.length === 0) {
      return <p className="px-1 py-2 text-xs text-muted-foreground">{emptyText}</p>;
    }

    return (
      <div className="space-y-1">
        {games.map((game) => (
          <Button
            key={game.id}
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start px-2 py-2"
            onClick={() => openGame(`/${mode}/${game.id}`)}
          >
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-medium">{gameLabel(game)}</p>
              <p className="truncate text-[11px] text-muted-foreground">Map: {game.mapName || "unknown"}</p>
            </div>
          </Button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Search Games</DialogTitle>
          <DialogDescription>
            Browse creator games, games you have played, and public games you have not played yet.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder="Search by game title or map..."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border p-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Creator Games
            </h3>
            {renderList(visibleCreatorGames, "creator", "No creator games found")}
          </div>

          <div className="rounded-md border p-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Played Games
            </h3>
            {renderList(visiblePlayedGames, "game", "No played games found")}
          </div>

          <div className="rounded-md border p-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Public (Unplayed)
            </h3>
            {loadingPublicGames ? (
              <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading public games...
              </div>
            ) : (
              renderList(visiblePublicUnplayedGames, "game", "No public unplayed games found")
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
