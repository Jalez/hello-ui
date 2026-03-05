"use client";

import { Loader2 } from "lucide-react";
import type React from "react";
import { GameAccordionItem } from "./GameAccordionItem";
import type { Game } from "./types";

interface GamesListProps {
  games: Game[];
  isLoading: boolean;
  creatingGameId: string | null;
  isCollapsed: boolean;
  editingId: string | null;
  editTitle: string;
  setEditTitle: (title: string) => void;
  onGameClick?: () => void;
  getGameTitle: (game: Game) => string;
  getGameHref: (game: Game) => string;
  isActive: (gameId: string) => boolean;
  emptyLabel?: string;
  handleKeyPress: (e: React.KeyboardEvent, gameId: string) => void;
  handleCancelEdit: (gameId?: string) => void;
  handleStartEdit: (e: React.MouseEvent, gameId: string, currentTitle: string) => void;
  handleDeleteGame: (e: React.MouseEvent, gameId: string) => Promise<void>;
}

export const GamesList: React.FC<GamesListProps> = ({
  games,
  isLoading,
  creatingGameId,
  isCollapsed,
  editingId,
  editTitle,
  setEditTitle,
  onGameClick,
  getGameTitle,
  getGameHref,
  isActive,
  emptyLabel = "No games yet",
  handleKeyPress,
  handleCancelEdit,
  handleStartEdit,
  handleDeleteGame,
}) => {
  if (isLoading) {
    if (isCollapsed) {
      return null;
    }
    return (
      <div className="flex h-12 w-full min-w-0 items-center px-4">
        <div className="flex w-8 shrink-0 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 pl-3">
          <span className="block truncate whitespace-nowrap text-sm text-muted-foreground">Loading games...</span>
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    if (isCollapsed) {
      return null;
    }
    return (
      <div className="flex h-12 w-full min-w-0 items-center px-4">
        <div className="w-8 shrink-0" />
        <div className="flex-1 min-w-0 pl-3">
          <span className="block truncate whitespace-nowrap text-sm text-muted-foreground">{emptyLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col overflow-hidden">
      <div className="w-full min-w-0 max-h-[400px] overflow-y-auto overflow-x-hidden">
      {games.map((game) => {
        const gameTitle = getGameTitle(game);
        const active = isActive(game.id);
        const isEditing = editingId === game.id;
        const gameIsLoading = game.id === creatingGameId;

        return (
          <GameAccordionItem
            key={game.id}
            game={game}
            gameTitle={gameTitle}
            href={getGameHref(game)}
            active={active}
            isEditing={isEditing}
            isLoading={gameIsLoading}
            isCollapsed={isCollapsed}
            onGameClick={onGameClick}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            handleKeyPress={handleKeyPress}
            handleCancelEdit={handleCancelEdit}
            handleStartEdit={handleStartEdit}
            handleDeleteGame={handleDeleteGame}
          />
        );
      })}
      </div>
    </div>
  );
};
