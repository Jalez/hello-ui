"use client";

import type { RefObject } from "react";
import {
  BarChart3,
  Flag,
  Gamepad2,
  Loader2,
  Map,
  RotateCcw,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { MapEditorRef } from "@/components/CreatorControls/MapEditor";
import { apiUrl } from "@/lib/apiUrl";
import { AplusSubmitButton } from "./AplusSubmitButton";
import { WorkbenchSidebarToolRow } from "./WorkbenchSidebarToolRow";

export type GameToolsSidebarProps = {
  mapEditorRef: RefObject<MapEditorRef | null>;
  isGameRoute: boolean;
  isCreatorRoute: boolean;
  currentGameId: string | undefined;
  canEditCurrentGame: boolean;
  showCreatorGameMenus: boolean;
  isGroupGame: boolean;
  openGameLobby: () => void;
  togglePopper: (scope: "level" | "game") => void;
  handleResetGameInstances: () => void;
  handleResetLeaderboard: () => void;
  isResettingInstances: boolean;
  shouldEmphasizeFinishGame: boolean;
};

function SidebarDivider() {
  return <div className="my-1 h-px w-full shrink-0 bg-border" aria-hidden />;
}

export function GameToolsSidebar({
  mapEditorRef,
  isGameRoute,
  isCreatorRoute,
  currentGameId,
  canEditCurrentGame,
  showCreatorGameMenus,
  isGroupGame,
  openGameLobby,
  togglePopper,
  handleResetGameInstances,
  handleResetLeaderboard,
  isResettingInstances,
  shouldEmphasizeFinishGame,
}: GameToolsSidebarProps) {
  const router = useRouter();

  const hasTopSection =
    Boolean(isGameRoute && currentGameId && isGroupGame)
    || Boolean(isCreatorRoute && currentGameId && canEditCurrentGame);

  return (
    <div className="flex w-full flex-col gap-1">
      {isGameRoute && currentGameId && isGroupGame ? (
        <WorkbenchSidebarToolRow
          id="game-lobby"
          label="Lobby"
          tooltip="Back to Game Lobby"
          icon={Users}
          onClick={openGameLobby}
        />
      ) : null}

      {isCreatorRoute && currentGameId && canEditCurrentGame ? (
        <WorkbenchSidebarToolRow
          id="game-switch-mode"
          label="Play"
          tooltip="Switch to Game Mode"
          icon={Gamepad2}
          onClick={() => router.push(apiUrl(`/game/${currentGameId}?mode=game`))}
        />
      ) : null}

      {hasTopSection && showCreatorGameMenus ? <SidebarDivider /> : null}

      {showCreatorGameMenus ? (
        <>
          <WorkbenchSidebarToolRow
            id="game-reset-level"
            label="Reset Level"
            tooltip="Reset Level"
            icon={RotateCcw}
            onClick={() => togglePopper("level")}
          />
          <WorkbenchSidebarToolRow
            id="game-reset-game"
            label="Reset Game"
            tooltip="Reset Game"
            icon={RotateCcw}
            onClick={() => togglePopper("game")}
          />
          <AplusSubmitButton
            shouldShake={shouldEmphasizeFinishGame}
            renderTrigger={({ openDialog }) => (
              <WorkbenchSidebarToolRow
                id="game-finish"
                label="Finish"
                tooltip="Finish game and save result"
                icon={Flag}
                onClick={openDialog}
              />
            )}
          />
        </>
      ) : null}

      {showCreatorGameMenus ? <SidebarDivider /> : null}

      <WorkbenchSidebarToolRow
        id="game-levels-map"
        label="Levels"
        tooltip="Game Levels"
        icon={Map}
        onClick={() => mapEditorRef.current?.triggerOpen()}
      />

      {currentGameId && canEditCurrentGame ? (
        <>
          <SidebarDivider />
          <WorkbenchSidebarToolRow
            id="game-statistics"
            label="Stats"
            tooltip="Statistics"
            icon={BarChart3}
            onClick={() => router.push(apiUrl(`/creator/${currentGameId}/statistics`))}
          />
          <WorkbenchSidebarToolRow
            id="game-reset-instances"
            label="Instances"
            tooltip="Reset Game Instances"
            icon={isResettingInstances ? Loader2 : Trash2}
            iconClassName={isResettingInstances ? "animate-spin" : undefined}
            onClick={handleResetGameInstances}
            disabled={isResettingInstances}
          />
          <WorkbenchSidebarToolRow
            id="game-reset-leaderboard"
            label="Leaderboard"
            tooltip="Reset Leaderboard"
            icon={isResettingInstances ? Loader2 : Trash2}
            iconClassName={isResettingInstances ? "animate-spin" : undefined}
            onClick={handleResetLeaderboard}
            disabled={isResettingInstances}
          />
          <WorkbenchSidebarToolRow
            id="game-settings"
            label="Settings"
            tooltip="Game Settings"
            icon={Settings}
            onClick={() => router.push(apiUrl(`/creator/${currentGameId}/settings`))}
          />
        </>
      ) : null}
    </div>
  );
}
