'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Button } from "@/components/ui/button";
import { RotateCcw, PanelLeft, Map, Flag, Settings, Trash2, Loader2, Gamepad2, BarChart3, Users } from "lucide-react";
import LevelControls, { LevelSelect } from "@/components/General/LevelControls/LevelControls";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { resetLevel } from "@/store/slices/levels.slice";
import { useCallback, useEffect, useRef, useState } from "react";
import CreatorControls from "@/components/CreatorControls/CreatorControls";
import MapEditor, { MapEditorRef } from "@/components/CreatorControls/MapEditor";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import InfoGamePoints from "../InfoBoard/InfoGamePoints";
import { ModeToggleButton } from "./ModeToggleButton";
import { AplusSubmitButton } from "./AplusSubmitButton";
import Link from "next/link";
import { useGameStore } from "@/components/default/games";
import { CreatorMenu } from "./CreatorMenu";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { apiUrl, stripBasePath } from "@/lib/apiUrl";
import { useGameplayTelemetry } from "@/components/General/useGameplayTelemetry";
import { logDebugClient } from "@/lib/debug-logger";
import Shaker from "@/components/General/Shaker/Shaker";
import { CompactMenuButton, compactMenuButtonClass, compactMenuLabelClass } from "@/components/General/CompactMenuButton";
import { toast } from "sonner";

export const Navbar = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openOverlay, toggleCollapsed, isMobile, isOverlayOpen, isVisible } = useSidebarCollapse();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const isCreatorRoute = normalizedPathname.startsWith("/creator/");
  const levels = useAppSelector((state) => state.levels);
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const isCreator = useAppSelector((state) => state.options.creator);
  const currentGame = useGameStore((state) => state.getCurrentGame());
  const collaboration = useOptionalCollaboration();
  const { recordReset } = useGameplayTelemetry();
  const canEditCurrentGame = Boolean(currentGame?.canEdit ?? currentGame?.isOwner);
  const isGameRoute = normalizedPathname.startsWith("/game/");
  const shouldHideSidebarForPlayers = isGameRoute && Boolean(currentGame?.hideSidebar) && !canEditCurrentGame;
  const showCreatorGameMenus =
    isGameRoute &&
    Boolean(currentGame?.id) &&
    canEditCurrentGame;
  const isCreatorWorkbenchContext = isCreatorRoute && canEditCurrentGame;
  const shouldShowMobileSidebarToggle =
    isGameRoute &&
    isVisible &&
    isMobile &&
    !isOverlayOpen &&
    !shouldHideSidebarForPlayers;
  const shouldShowCreatorSidebarToggle =
    isCreator &&
    isVisible &&
    (!isMobile || !isOverlayOpen);

  const level = levels[currentLevel - 1];
  const points = useAppSelector((state) => state.points);
  const mapEditorRef = useRef<MapEditorRef>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetScope, setResetScope] = useState<"level" | "game">("level");
  const [isResettingInstances, setIsResettingInstances] = useState(false);

  const levelChanger = useCallback((pickedLevel: number) => {
    dispatch(setCurrentLevel(pickedLevel));
  }, [dispatch]);

  const handleLevelReset = useCallback(() => {
    recordReset("level", currentLevel - 1);
    dispatch(resetLevel(currentLevel));
  }, [currentLevel, dispatch, recordReset]);

  const handleSharedReset = useCallback((scope: "level" | "game") => {
    if (!currentGame?.id) {
      logDebugClient("shared_reset_ignored_no_game", {
        scope,
        currentLevel: currentLevel - 1,
      });
      return;
    }

    if (collaboration?.resetRoomState) {
      if (!collaboration.isConnected) {
        logDebugClient("shared_reset_blocked_disconnected", {
          scope,
          currentLevel: currentLevel - 1,
          roomId: collaboration.roomId,
          groupId: collaboration.groupId,
        });
        toast.error("Shared reset is unavailable until the room connection is ready.");
        return;
      }

      recordReset(scope, currentLevel - 1);
      logDebugClient("shared_reset_emit", {
        scope,
        currentLevel: currentLevel - 1,
        roomId: collaboration.roomId,
        groupId: collaboration.groupId,
      });
      collaboration.resetRoomState(scope, currentLevel - 1);
      return;
    }

    recordReset(scope, currentLevel - 1);
    logDebugClient("shared_reset_fallback_local", {
      scope,
      currentLevel: currentLevel - 1,
      isGameRoute,
      roomId: collaboration?.roomId ?? null,
      groupId: collaboration?.groupId ?? null,
    });
    if (scope === "level") {
      dispatch(resetLevel(currentLevel));
    }
  }, [collaboration, currentGame?.id, currentLevel, dispatch, isGameRoute, recordReset]);

  const shouldUseSharedReset = isGameRoute && Boolean(collaboration?.resetRoomState);

  const togglePopper = useCallback((scope: "level" | "game" = "level") => {
    setResetScope(scope);
    setIsResetDialogOpen(true);
  }, []);

  const openGameLobby = useCallback(() => {
    if (!currentGame?.id) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "game");
    params.delete("groupId");
    const query = params.toString();
    router.push(apiUrl(`/game/${currentGame.id}${query ? `?${query}` : ""}`));
  }, [currentGame?.id, router, searchParams]);

  const handleResetGameInstances = useCallback(async () => {
    if (!currentGame?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Reset all saved game instances for this game? This clears all individual and group gameplay progress and code snapshots.",
    );
    if (!confirmed) {
      return;
    }

    try {
      setIsResettingInstances(true);
      const response = await fetch(apiUrl(`/api/games/${currentGame.id}/instances/reset`), {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset game instances");
      }

      toast.success(
        data.deletedCount > 0
          ? `Reset ${data.deletedCount} saved game instance${data.deletedCount === 1 ? "" : "s"}.`
          : "No saved game instances to reset.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset game instances");
    } finally {
      setIsResettingInstances(false);
    }
  }, [currentGame?.id]);

  const handleResetLeaderboard = useCallback(async () => {
    if (!currentGame?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Reset all leaderboard data for this game? This deletes recorded attempt statistics but does not remove the game itself.",
    );
    if (!confirmed) {
      return;
    }

    try {
      setIsResettingInstances(true);
      const response = await fetch(apiUrl(`/api/games/${currentGame.id}/leaderboard/reset`), {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset leaderboard");
      }

      toast.success(
        data.deletedAttempts > 0
          ? `Reset leaderboard for ${data.deletedAttempts} attempt${data.deletedAttempts === 1 ? "" : "s"}.`
          : "No leaderboard data to reset.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset leaderboard");
    } finally {
      setIsResettingInstances(false);
    }
  }, [currentGame?.id]);

  const handleAnchorElReset = useCallback(() => {
    setIsResetDialogOpen(false);
  }, []);

  const renderGameMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <CompactMenuButton icon={Gamepad2} label="Game" text="Game" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 border-0 shadow-lg">
        <DropdownMenuLabel>Game Tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isGameRoute && currentGame?.id && (
          <>
            <DropdownMenuItem onSelect={openGameLobby}>
              <Users className="h-4 w-4 mr-2" />
              Back to Game Lobby
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {isCreatorRoute && currentGame?.id && canEditCurrentGame && (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/game/${currentGame.id}?mode=game`}>
                <Gamepad2 className="h-4 w-4 mr-2" />
                Switch to Game Mode
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {showCreatorGameMenus && (
          <>
            <DropdownMenuItem onSelect={() => togglePopper("level")}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Level
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => togglePopper("game")}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Game
            </DropdownMenuItem>
            <AplusSubmitButton
              displayMode="icon-label"
              renderTrigger={({ openDialog }) => (
                <DropdownMenuItem onSelect={openDialog}>
                  <Flag className="h-4 w-4 mr-2" />
                  Finish Game
                </DropdownMenuItem>
              )}
            />
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => mapEditorRef.current?.triggerOpen()}>
          <Map className="h-4 w-4 mr-2" />
          Game Levels
        </DropdownMenuItem>
        {currentGame?.id && canEditCurrentGame && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/creator/${currentGame.id}/statistics`}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Statistics
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleResetGameInstances} disabled={isResettingInstances}>
              {isResettingInstances ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Reset Game Instances
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleResetLeaderboard} disabled={isResettingInstances}>
              {isResettingInstances ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Reset Leaderboard
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/creator/${currentGame.id}/settings`}>
                <Settings className="h-4 w-4 mr-2" />
                Game Settings
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderCompactPlayerMenus = () => (
    <>
      <div className="flex flex-none">
        <div className="rounded-md px-2 py-1.5">
            <Popover>
              <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className={compactMenuButtonClass}>
                    <Shaker
                      value={points.allPoints >= points.allMaxPoints && points.allMaxPoints > 0 ? 1 : 0}
                      className="inline-flex items-center justify-center gap-1 max-[519px]:flex-col"
                    >
                    <span className={`${compactMenuLabelClass} min-[520px]:hidden`}>
                      Game
                    </span>
                    <Gamepad2 className="h-4 w-4" />
                    <span className="hidden min-[520px]:inline text-xs font-medium">Game</span>
                    </Shaker>
                  </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-72 space-y-3">
                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Gamepad2 className="h-3.5 w-3.5" />
                    <span>Game</span>
                  </div>
                  <div className="mt-3 rounded-md bg-background/80 px-3 py-2 text-center">
                    <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Total Score
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {points.allPoints || 0}/{points.allMaxPoints || 0}
                    </div>
                  </div>
                  <div className="mt-3 rounded-md bg-background/80 px-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center gap-2"
                      onClick={openGameLobby}
                    >
                      <Users className="h-4 w-4" />
                      <span>To lobby</span>
                    </Button>
                  </div>
                  <div className="mt-3 rounded-md bg-background/80 px-3 py-2">
                    <AplusSubmitButton
                      displayMode="icon-label"
                      renderTrigger={({ openDialog }) => (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-center gap-2"
                          onClick={openDialog}
                        >
                          <Flag className="h-4 w-4" />
                          <span>Finish game</span>
                        </Button>
                      )}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
        </div>
      </div>

      <div className="flex flex-1 min-w-0">
        <div className="w-full rounded-md px-2 py-1.5">
          <div className="flex-1 min-w-0">
            <LevelSelect levelHandler={levelChanger} compact compactLabel="Levels" />
          </div>
        </div>
      </div>
    </>
  );

  const renderInlinePlayerMenus = () => (
    <>
      <div className="flex flex-none">
        <InfoGamePoints />
      </div>
      <div className="flex flex-none">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-center gap-2"
          onClick={openGameLobby}
        >
          <Users className="h-4 w-4" />
          <span>To lobby</span>
        </Button>
      </div>
      <div className="flex flex-none">
        <AplusSubmitButton displayMode="icon-label" />
      </div>
      <div className="flex flex-1 min-w-0">
        <div className="w-full rounded-md px-2 py-1.5">
          <div className="flex-1 min-w-0">
            <LevelSelect levelHandler={levelChanger} compact compactLabel="Levels" />
          </div>
        </div>
      </div>
    </>
  );

  const renderCompactCreatorLevelMenu = () => (
    <div className="flex flex-1 min-w-0">
      <div className="w-full rounded-md px-2 py-1.5">
        <div className="flex-1 min-w-0">
          <LevelSelect levelHandler={levelChanger} compact compactLabel="Levels" />
        </div>
      </div>
    </div>
  );

  const renderCompactCreatorMenus = () => (
    <>
      {shouldShowCreatorSidebarToggle ? (
        <div className="flex flex-none">
          <div className="rounded-md px-2 py-1.5">
            <CompactMenuButton
              icon={PanelLeft}
              label="Sidebar"
              text="Sidebar"
              onClick={isMobile ? openOverlay : toggleCollapsed}
              title="Toggle sidebar"
            />
          </div>
        </div>
      ) : null}
      <div className="flex flex-none">
        <div className="rounded-md px-2 py-1.5">
          <CreatorMenu
            gameId={currentGame!.id}
            collaborationMode={currentGame!.collaborationMode}
          />
        </div>
      </div>
      <div className="flex flex-none">
        <div className="rounded-md px-2 py-1.5">
          {renderGameMenu()}
        </div>
      </div>
      {renderCompactCreatorLevelMenu()}
    </>
  );

  const renderCompactCreatorWorkbenchMenus = () => (
    <>
      {shouldShowCreatorSidebarToggle ? (
        <div className="flex flex-none">
          <div className="rounded-md px-2 py-1.5">
            <CompactMenuButton
              icon={PanelLeft}
              label="Sidebar"
              text="Sidebar"
              onClick={isMobile ? openOverlay : toggleCollapsed}
              title="Toggle sidebar"
            />
          </div>
        </div>
      ) : null}
      <div className="flex flex-none">
        <CreatorControls displayMode="menu" />
      </div>
      <div className="flex flex-none">
        <div className="rounded-md px-2 py-1.5">
          {renderGameMenu()}
        </div>
      </div>
      <div className="flex flex-1 min-w-0">
        <div className="w-full rounded-md px-2 py-1.5">
          <div className="flex-1 min-w-0">
            <LevelSelect levelHandler={levelChanger} compact compactLabel="Levels" />
          </div>
        </div>
      </div>
    </>
  );

  if (!level) return null;

  return (
    <div
      className="flex w-full flex-wrap items-center justify-around gap-2 border-b bg-background/80 px-3 py-2 2xl:flex-nowrap 2xl:justify-between"
    >
      {(isGameRoute || isCreatorWorkbenchContext) && (
        <div className="flex w-full min-w-0 items-center gap-1 sm:hidden">
          {!showCreatorGameMenus && shouldShowMobileSidebarToggle && (
            <div className="flex-none rounded-md px-2 py-1.5">
                <CompactMenuButton
                  icon={PanelLeft}
                  label="Sidebar"
                  text="Sidebar"
                  onClick={openOverlay}
                  title="Open sidebar"
                />
            </div>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {showCreatorGameMenus
              ? renderCompactCreatorMenus()
              : isCreatorWorkbenchContext
                ? renderCompactCreatorWorkbenchMenus()
                : renderCompactPlayerMenus()}
          </div>
        </div>
      )}

      {/* Compact nav: text-first menus (no icon-only mode). Hide Game and Level menus on game route. */}
      <div className="hidden sm:flex flex-1 min-w-0 items-center gap-1">
        {showCreatorGameMenus && currentGame?.id ? (
          renderCompactCreatorMenus()
        ) : isCreatorWorkbenchContext ? (
          renderCompactCreatorWorkbenchMenus()
        ) : !isCreatorRoute && !isGameRoute ? (
          <ModeToggleButton displayMode="icon-label" />
        ) : null}

        {isGameRoute && !showCreatorGameMenus ? (
          <>
            <div className="hidden md:flex flex-1 min-w-0 items-center gap-2">
              {renderInlinePlayerMenus()}
            </div>
            <div className="flex md:hidden flex-1 min-w-0 items-center gap-1">
              {renderCompactPlayerMenus()}
            </div>
          </>
        ) : !showCreatorGameMenus ? (
          <>
            <InfoGamePoints />
            {!showCreatorGameMenus && <AplusSubmitButton displayMode="icon-label" />}
          </>
        ) : null}
      </div>

      {/* Game Levels dialog controlled from navbar menu */}
      <MapEditor ref={mapEditorRef} renderButton={false} />
      {/* Dialog for reset confirmation */}
      <NavPopper
        open={isResetDialogOpen}
        paragraph={
          showCreatorGameMenus && resetScope === "game"
            ? "This resets the shared game instance for the current room back to the original template code. All saved progress for that room will be lost."
            : showCreatorGameMenus
              ? "This resets only the current level in the shared game instance back to that level's original template code."
            : "This is an irreversible action. All progress will be lost, but timer is not affected. Are you sure you want to reset the level?"
        }
        title={showCreatorGameMenus ? (resetScope === "game" ? "Reset Game" : "Reset Level") : "Reset Level"}
        handleConfirmation={shouldUseSharedReset ? () => handleSharedReset(resetScope) : handleLevelReset}
        resetAnchorEl={handleAnchorElReset}
      />
    </div>
  );
};

type NavPopperProps = {
  open: boolean;
  paragraph: string;
  title: string;
  handleConfirmation: () => void;
  resetAnchorEl?: () => void;
};

export const NavPopper = ({
  open,
  paragraph,
  title,
  handleConfirmation,
  resetAnchorEl,
}: NavPopperProps) => {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const timer = setTimeout(() => {
      resetAnchorEl?.();
    }, 10000);

    return () => clearTimeout(timer);
  }, [open, resetAnchorEl]);

  const confirmationAndClose = () => {
    handleConfirmation();
    resetAnchorEl?.();
  };
  const handleClose = useCallback(() => resetAnchorEl?.(), [resetAnchorEl]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetAnchorEl?.();
        }
      }}
    >
      <DialogContent className="z-[1200]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[0.7rem] w-[250px]">
            {paragraph}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button
            onClick={confirmationAndClose}
            variant="outline"
          >
            Yes
          </Button>
          <Button
            onClick={handleClose}
            variant="outline"
          >
            No
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
