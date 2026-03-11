'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { addNotificationData } from "@/store/slices/notifications.slice";
import { Button } from "@/components/ui/button";
import { RotateCcw, PanelLeft, Map, Flag, Settings, Trash2, Loader2, Gamepad2, BarChart3 } from "lucide-react";
import LevelControls from "@/components/General/LevelControls/LevelControls";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { resetLevel } from "@/store/slices/levels.slice";
import { useCallback, useEffect, useRef, useState } from "react";
import CreatorControls from "@/components/CreatorControls/CreatorControls";
import MapEditor, { MapEditorRef } from "@/components/CreatorControls/MapEditor";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { usePathname } from "next/navigation";
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
import PoppingTitle from "@/components/General/PoppingTitle";

export const Navbar = () => {
  const dispatch = useAppDispatch();
  const { openOverlay, isMobile, isOverlayOpen, isVisible } = useSidebarCollapse();
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
  const shouldShowMobileSidebarToggle =
    isGameRoute &&
    isVisible &&
    isMobile &&
    !isOverlayOpen &&
    !shouldHideSidebarForPlayers;

  const level = levels[currentLevel - 1];
  const mapEditorRef = useRef<MapEditorRef>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetScope, setResetScope] = useState<"level" | "game">("level");
  const [isResettingInstances, setIsResettingInstances] = useState(false);
  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);

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
        dispatch(
          addNotificationData({
            type: "error",
            message: "Shared reset is unavailable until the room connection is ready.",
          }),
        );
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

      dispatch(
        addNotificationData({
          type: "success",
          message:
            data.deletedCount > 0
              ? `Reset ${data.deletedCount} saved game instance${data.deletedCount === 1 ? "" : "s"}.`
              : "No saved game instances to reset.",
        }),
      );
    } catch (error) {
      dispatch(
        addNotificationData({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to reset game instances",
        }),
      );
    } finally {
      setIsResettingInstances(false);
    }
  }, [currentGame?.id, dispatch]);

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

      dispatch(
        addNotificationData({
          type: "success",
          message:
            data.deletedAttempts > 0
              ? `Reset leaderboard for ${data.deletedAttempts} attempt${data.deletedAttempts === 1 ? "" : "s"}.`
              : "No leaderboard data to reset.",
        }),
      );
    } catch (error) {
      dispatch(
        addNotificationData({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to reset leaderboard",
        }),
      );
    } finally {
      setIsResettingInstances(false);
    }
  }, [currentGame?.id, dispatch]);

  const handleAnchorElReset = useCallback(() => {
    setIsResetDialogOpen(false);
  }, []);

  const renderGameMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8">
          Game
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 border-0 shadow-lg">
        <DropdownMenuLabel>Game Tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
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
            <DropdownMenuItem onSelect={() => setIsFinishDialogOpen(true)}>
              <Flag className="h-4 w-4 mr-2" />
              Finish Game
            </DropdownMenuItem>
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

  if (!level) return null;

  return (
    <div
      className="flex flex-row justify-around items-center w-full h-fit gap-2"
    >
      {/* Sidebar Toggle Button - Only visible on small screens */}
      {shouldShowMobileSidebarToggle && (
        <div className="lg:hidden">
          <PoppingTitle topTitle="Open sidebar">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={openOverlay}
              title="Open sidebar"
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
          </PoppingTitle>
        </div>
      )}

      {/* Compact nav: text-first menus (no icon-only mode). Hide Game and Level menus on game route. */}
      <div className="flex 2xl:hidden items-center gap-1">
        {isCreator && !isGameRoute && (
          <>
            <CreatorControls displayMode="menu" />
            {renderGameMenu()}
          </>
        )}

        {showCreatorGameMenus && currentGame?.id ? (
          <>
            <CreatorMenu
              gameId={currentGame.id}
              collaborationMode={currentGame.collaborationMode}
            />
            {renderGameMenu()}
          </>
        ) : !isCreatorRoute ? (
          <ModeToggleButton displayMode="icon-label" />
        ) : null}

        {isGameRoute && !showCreatorGameMenus && (
          <PoppingTitle topTitle="Reset Level">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Reset Level"
              onClick={() => togglePopper("level")}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </PoppingTitle>
        )}

        <InfoGamePoints />
        {!showCreatorGameMenus && <AplusSubmitButton displayMode="icon" />}
      </div>

      {/* Left section - Creator controls or Art tab switch. Hide creator tools on game route. */}
      <div className="hidden 2xl:flex flex-row gap-2 justify-center items-center flex-[1_0_25%]">
        {isCreator && !isGameRoute ? (
          <CreatorControls displayMode="icon-label" />
        ) : null}
      </div>

      {/* Center section - Mode toggle, Reset, and Level controls */}
      <div className="flex flex-row gap-2 lg:gap-3 justify-center items-center flex-1 2xl:flex-[1_0_50%]">
        {/* Mode switch */}
        <div className="hidden 2xl:flex gap-1 items-center">
          {showCreatorGameMenus && currentGame?.id ? (
            <>
              <CreatorMenu
                gameId={currentGame.id}
                collaborationMode={currentGame.collaborationMode}
              />
              {renderGameMenu()}
            </>
          ) : (
            <ModeToggleButton displayMode="icon-label" />
          )}
        </div>

        {/* Reset button */}
        {isGameRoute && !showCreatorGameMenus && (
          <div className="hidden 2xl:block">
            <Button
              size="sm"
              variant="ghost"
              className="gap-2"
              title="Reset Level"
              onClick={() => togglePopper("level")}
            >
              <RotateCcw className="h-5 w-5" />
              <span>Reset</span>
            </Button>
          </div>
        )}

        {/* Level controls - Always visible */}
        <LevelControls
          currentlevel={currentLevel}
          levelHandler={levelChanger}
          maxLevels={Object.keys(levels).length}
          levelName={level.name}
        />
      </div>

      {/* Right section - Game points + A+ submit */}
      <div className="hidden 2xl:flex flex-[1_0_25%] justify-center items-center gap-2">
        <InfoGamePoints />
        {!showCreatorGameMenus && <AplusSubmitButton displayMode="icon-label" />}
      </div>

      {/* Game Levels dialog controlled from navbar menu */}
      <MapEditor ref={mapEditorRef} renderButton={false} />
      <AplusSubmitButton
        open={isFinishDialogOpen}
        onOpenChange={setIsFinishDialogOpen}
        renderTrigger={() => null}
      />

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
