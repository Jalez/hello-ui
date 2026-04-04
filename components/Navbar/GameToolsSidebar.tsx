"use client";

import type { RefObject } from "react";
import {
  BarChart3,
  Code2,
  Flag,
  Gamepad2,
  Map,
  RotateCcw,
  Settings,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { MapEditorRef } from "@/components/CreatorControls/MapEditor";
import { apiUrl } from "@/lib/apiUrl";
import { AplusSubmitButton } from "./AplusSubmitButton";
import { WorkbenchSidebarToolRow } from "./WorkbenchSidebarToolRow";
import type { SubNavbarItem } from "./SubNavbar";

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
  shouldEmphasizeFinishGame: boolean;
  /** Run events / auto-run events (game route editor workbench). */
  interactionRunItems?: SubNavbarItem[];
  /** Shown in game route editor sidebar; opens creator for this game. */
  onSwitchToCreator?: () => void;
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
  shouldEmphasizeFinishGame,
  interactionRunItems,
  onSwitchToCreator,
}: GameToolsSidebarProps) {
  const router = useRouter();

  const hasTopSection =
    Boolean(isGameRoute && currentGameId && isGroupGame)
    || Boolean(isCreatorRoute && currentGameId && canEditCurrentGame)
    || Boolean(showCreatorGameMenus && !isCreatorRoute && currentGameId && onSwitchToCreator);

  const showSwitchToCreatorInGameTools =
    Boolean(showCreatorGameMenus && !isCreatorRoute && currentGameId && onSwitchToCreator);

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

      {showSwitchToCreatorInGameTools ? (
        <WorkbenchSidebarToolRow
          id="game-switch-creator"
          label="Creator"
          tooltip="Switch to Creator Mode"
          icon={Code2}
          onClick={onSwitchToCreator!}
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
            centerTrigger
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

      {interactionRunItems && interactionRunItems.length > 0 ? (
        <>
          {interactionRunItems.map((item) => {
            if (!item.icon || !item.onClick) {
              return null;
            }
            const Icon = item.icon;
            return (
              <WorkbenchSidebarToolRow
                key={item.id}
                id={`game-interaction-${item.id}`}
                label={item.label}
                tooltip={item.tooltip}
                icon={Icon}
                onClick={item.onClick}
                disabled={item.disabled}
                active={item.active}
                variant={item.variant}
                iconClassName={item.iconClassName}
              />
            );
          })}
          <SidebarDivider />
        </>
      ) : null}

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
            tooltip="Statistics (reset leaderboard & instances)"
            icon={BarChart3}
            onClick={() => router.push(apiUrl(`/creator/${currentGameId}/statistics`))}
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
