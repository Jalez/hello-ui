"use client";

import { Edit3, FolderKanban, Loader2, MoreVertical, Trash2 } from "lucide-react";
import Link from "next/link";
import type React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Game } from "./types";

interface GameAccordionItemProps {
  game: Game;
  gameTitle: string;
  href: string;
  active: boolean;
  isEditing: boolean;
  isLoading?: boolean;
  isCollapsed: boolean;
  onGameClick?: () => void;
  editTitle: string;
  setEditTitle: (title: string) => void;
  handleKeyPress: (e: React.KeyboardEvent, gameId: string) => void;
  handleCancelEdit: (gameId?: string) => void;
  handleStartEdit: (e: React.MouseEvent, gameId: string, currentTitle: string) => void;
  handleDeleteGame: (e: React.MouseEvent, gameId: string) => Promise<void>;
}

export const GameAccordionItem: React.FC<GameAccordionItemProps> = ({
  game,
  gameTitle,
  href,
  active,
  isEditing,
  isLoading = false,
  isCollapsed,
  onGameClick,
  editTitle,
  setEditTitle,
  handleKeyPress,
  handleCancelEdit,
  handleStartEdit,
  handleDeleteGame,
}) => {
  const rowStateClass = active
    ? "bg-gray-200 text-gray-900 dark:bg-muted dark:text-white"
    : "text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-muted";

  return (
    <div className={`group w-full min-w-0 overflow-hidden ${rowStateClass}`}>
      <div className="flex h-12 w-full min-w-0 items-center">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, game.id)}
              onBlur={() => handleCancelEdit(game.id)}
              className="h-12 w-full text-sm bg-white dark:bg-gray-700 border border-gray-500 px-3 focus:outline-none focus:ring-1 focus:ring-gray-500"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={href}
                  onClick={(e) => {
                    e.stopPropagation();
                    onGameClick?.();
                  }}
                  className="flex h-12 w-full min-w-0 items-center px-4 text-left text-sm font-medium"
                  title={gameTitle}
                >
                  <div className="flex items-center justify-center w-8 shrink-0">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderKanban className="h-4 w-4" />}
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0 pl-3">
                      <span className="block truncate whitespace-nowrap">{gameTitle}</span>
                    </div>
                  )}
                </Link>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" className="ml-2">
                  <p>{gameTitle}</p>
                </TooltipContent>
              )}
            </Tooltip>
          )}
        </div>

        {!isCollapsed && !isEditing && !isLoading && (
          <div className="flex h-12 w-10 flex-shrink-0 items-center justify-center pr-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="pointer-events-none rounded p-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus:pointer-events-auto focus:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 hover:bg-gray-300 dark:hover:bg-gray-600"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => handleStartEdit(e, game.id, gameTitle)}
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => handleDeleteGame(e, game.id)}
                  className="text-red-600 dark:text-red-400"
                  disabled={!game.isOwner}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {game.isOwner ? "Delete" : "Delete (owner only)"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
};
