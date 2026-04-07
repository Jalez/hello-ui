"use client";

import { FolderKanban, Loader2, Plus, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SidebarButton } from "../sidebar/SidebarButton";
import { SidebarLink } from "../sidebar/SidebarLink";
import { useSidebarCollapse } from "../sidebar/context/SidebarCollapseContext";
import { useMobileSidebar } from "../sidebar/Sidebar";
import { useGameStore } from "./stores/gameStore";
import { GamesList } from "./GamesList";
import { useGameHandlers } from "./hooks/useGameHandlers";
import type { Game } from "./types";
import { GamesSearchModal } from "./GamesSearchModal";

interface SidebarGameListProps {
  onGameClick?: () => void;
}

const MAX_AUTO_LOAD_RETRIES = 2;
const AUTO_LOAD_RETRY_DELAY_MS = 1500;

export const GameSidebar: React.FC<SidebarGameListProps> = ({ onGameClick }) => {
  const { isCollapsed: contextCollapsed } = useSidebarCollapse();
  const isMobileSidebar = useMobileSidebar();
  const isCollapsed = isMobileSidebar ? false : contextCollapsed;
  const pathname = usePathname();
  const { data: session } = useSession();
  const games = useGameStore((state) => state.games);
  const loadGames = useGameStore((state) => state.loadGames);
  const isStoreLoading = useGameStore((state) => state.isLoading);
  const hasInitializedGames = useGameStore((state) => state.isInitialized);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const autoLoadRetriesRef = useRef(0);
  const autoLoadPausedRef = useRef(false);
  const autoLoadInFlightRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAuthenticated = !!session?.user;

  const { handleCreateGame, handleSaveEdit, handleDeleteGame, isCreating, creatingGameId } = useGameHandlers({
    isAuthenticated,
    onGameClick,
  });

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current !== null) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const shouldAutoLoad =
    isAuthenticated &&
    !hasInitializedGames &&
    !isStoreLoading &&
    Boolean(session?.user?.email) &&
    (!isCollapsed || isSearchModalOpen);

  const attemptLoadGames = useCallback(async () => {
    if (!shouldAutoLoad || autoLoadPausedRef.current || autoLoadInFlightRef.current) {
      return;
    }

    autoLoadInFlightRef.current = true;

    try {
      await loadGames();
      autoLoadRetriesRef.current = 0;
      autoLoadPausedRef.current = false;
      clearRetryTimeout();
    } catch (error) {
      console.error("Error loading games:", error);

      if (autoLoadRetriesRef.current < MAX_AUTO_LOAD_RETRIES) {
        autoLoadRetriesRef.current += 1;
        const delay = AUTO_LOAD_RETRY_DELAY_MS * autoLoadRetriesRef.current;
        clearRetryTimeout();
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          autoLoadInFlightRef.current = false;
          void attemptLoadGames();
        }, delay);
        return;
      }

      autoLoadPausedRef.current = true;
      toast.error("Could not load games after multiple attempts. Auto-retries are paused.");
    } finally {
      if (retryTimeoutRef.current === null) {
        autoLoadInFlightRef.current = false;
      }
    }
  }, [clearRetryTimeout, loadGames, shouldAutoLoad]);

  useEffect(() => {
    void attemptLoadGames();
  }, [attemptLoadGames]);

  useEffect(() => {
    if (hasInitializedGames) {
      autoLoadPausedRef.current = false;
      autoLoadRetriesRef.current = 0;
      clearRetryTimeout();
    }
  }, [clearRetryTimeout, hasInitializedGames]);

  useEffect(() => {
    return () => {
      clearRetryTimeout();
    };
  }, [clearRetryTimeout]);

  const isActive = (gameId: string) => {
    return pathname === `/game/${gameId}` || pathname === `/creator/${gameId}`;
  };

  const getGameTitle = (game: Game) => {
    return game.title || "Untitled Game";
  };

  const creatorGames = games.filter((game) => Boolean(game.isOwner || game.canEdit));
  const playedGames = games.filter((game) => !(game.isOwner || game.canEdit));

  const getCreatorHref = (game: Game) => `/creator/${game.id}`;
  const getPlayedHref = (game: Game) => `/game/${game.id}`;

  const handleKeyPress = useCallback(
    async (e: React.KeyboardEvent, gameId: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await handleSaveEdit(e as unknown as React.MouseEvent, gameId, editTitle);
        setEditingId(null);
        setEditTitle("");
      } else if (e.key === "Escape") {
        setEditingId(null);
        setEditTitle("");
      }
    },
    [editTitle, handleSaveEdit]
  );

  const handleCancelEditWrapper = useCallback(
    async (gameId?: string) => {
      if (gameId && editTitle !== "") {
        await handleSaveEdit({} as React.MouseEvent, gameId, editTitle);
      }
      setEditingId(null);
      setEditTitle("");
    },
    [editTitle, handleSaveEdit]
  );

  const handleStartEdit = useCallback((e: React.MouseEvent, gameId: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingId(gameId);
    setEditTitle(currentTitle);
  }, []);

  const handleDeleteGameWrapper = useCallback(
    async (e: React.MouseEvent, gameId: string) => {
      await handleDeleteGame(e, gameId);
    },
    [handleDeleteGame]
  );

  return (
    <>
      <SidebarLink
        icon={<FolderKanban className="h-5 w-5" />}
        label="Games"
        description="Browse public games"
        href="/games"
        onClick={onGameClick}
        isActive={pathname === "/games"}
        isCollapsed={isCollapsed}
        title="Games"
      />
      
      <SidebarButton
        icon={isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        label="New Game"
        isCollapsed={isCollapsed}
        onClick={() => handleCreateGame()}
        tooltip={isAuthenticated ? "New Game" : "Sign in to create games"}
        disabled={!isAuthenticated}
      />

      <SidebarButton
        icon={<Search className="h-5 w-5" />}
        label="Search Games"
        isCollapsed={isCollapsed}
        onClick={() => setIsSearchModalOpen(true)}
        tooltip="Search Games"
      />

      <div className="w-full min-w-0 overflow-hidden space-y-2">
        {!isCollapsed && (
          <div className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap truncate">
            Creator Games
          </div>
        )}
        <GamesList
          games={creatorGames}
          isLoading={isStoreLoading && !hasInitializedGames}
          creatingGameId={creatingGameId}
          isCollapsed={isCollapsed}
          editingId={editingId}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          onGameClick={onGameClick}
          getGameTitle={getGameTitle}
          getGameHref={getCreatorHref}
          isActive={isActive}
          emptyLabel="No creator games yet"
          handleKeyPress={handleKeyPress}
          handleCancelEdit={handleCancelEditWrapper}
          handleStartEdit={handleStartEdit}
          handleDeleteGame={handleDeleteGameWrapper}
        />

        {!isCollapsed && (
          <div className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap truncate">
            Played Games
          </div>
        )}
        <GamesList
          games={playedGames}
          isLoading={isStoreLoading && !hasInitializedGames}
          creatingGameId={creatingGameId}
          isCollapsed={isCollapsed}
          editingId={editingId}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          onGameClick={onGameClick}
          getGameTitle={getGameTitle}
          getGameHref={getPlayedHref}
          isActive={isActive}
          emptyLabel="No played games yet"
          handleKeyPress={handleKeyPress}
          handleCancelEdit={handleCancelEditWrapper}
          handleStartEdit={handleStartEdit}
          handleDeleteGame={handleDeleteGameWrapper}
        />
      </div>

      <GamesSearchModal
        open={isSearchModalOpen}
        onOpenChange={setIsSearchModalOpen}
        userGames={games}
        onGameClick={onGameClick}
      />
    </>
  );
};
