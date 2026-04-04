'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Button } from "@/components/ui/button";
import { RotateCcw, PanelLeft, Map, Flag, Settings, Gamepad2, BarChart3, Users, MousePointer, Eye, Square, Play, Wrench, ListMinus, ListX, ListPlus, ListOrdered } from "lucide-react";
import { AutoRunCircle } from "@/components/icons/AutoRunCircle";
import { LevelSelect } from "@/components/General/LevelControls/LevelControls";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { clearEventSequenceForScenario, removeEventSequenceStep, resetLevel } from "@/store/slices/levels.slice";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CreatorAutosaveProvider } from "@/components/CreatorControls/CreatorAutosaveContext";
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
  DropdownMenuCheckboxItem,
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
import { cn } from "@/lib/utils/cn";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { CreatorWorkbenchSubSidebar, type CreatorWorkbenchSection } from "./CreatorWorkbenchSubSidebar";
import { GameToolsSidebar } from "./GameToolsSidebar";
import type { SubNavbarItem } from "./SubNavbar";
import {
  EMPTY_SEQUENCE_RUNTIME_STATE,
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  getEventSequenceRuntimeKey,
  getEventSequenceScenarioUiKey,
  getSequenceRuntimeState,
  resetSequenceRuntimeState,
  setCreatorPreviewInteractiveForScenario,
  setEventSequencePanelOpen,
  setSelectedScenarioIdForLevel,
  setSelectedEventSequenceStepId,
  subscribeSequenceRuntime,
  updateSequenceRuntimeState,
  useEventSequenceUiState,
  requestAutoReplay,
  cancelAutoReplay,
  setAutoReplayOnMount,
} from "@/lib/drawboard/eventSequenceState";

type CreatorWorkbenchSubnavTabId = "creator" | "events" | "game";

const CREATOR_WORKBENCH_SUBNAV_TABS: Array<{
  id: CreatorWorkbenchSubnavTabId;
  label: string;
  tooltip: string;
  icon: typeof Settings;
}> = [
  {
    id: "creator",
    label: "Levels",
    tooltip: "Level save, generation, and map tools",
    icon: Settings,
  },
  {
    id: "events",
    label: "Events",
    tooltip: "Record an event sequence for the selected scenario.",
    icon: MousePointer,
  },
  {
    id: "game",
    label: "Game",
    tooltip: "Game navigation and settings",
    icon: Gamepad2,
  },
];

export const Navbar = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openOverlay, isMobile, isOverlayOpen, isVisible } = useSidebarCollapse();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const isCreatorRoute = normalizedPathname.startsWith("/creator/");
  const levels = useAppSelector((state) => state.levels);
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const currentGame = useGameStore((state) => {
    if (!state.currentGameId) {
      return null;
    }

    return state.games.find((candidate) => candidate.id === state.currentGameId) ?? null;
  });
  const collaboration = useOptionalCollaboration();
  const { recordReset } = useGameplayTelemetry();
  const canEditCurrentGame = Boolean(currentGame?.canEdit ?? currentGame?.isOwner);
  const isGameRoute = normalizedPathname.startsWith("/game/");
  const isGroupGame = currentGame?.collaborationMode === "group";
  const shouldHideSidebarForPlayers = isGameRoute && Boolean(currentGame?.hideSidebar) && !canEditCurrentGame;
  const showCreatorGameMenus =
    isGameRoute &&
    Boolean(currentGame?.id) &&
    canEditCurrentGame;
  const isCreatorWorkbenchContext = isCreatorRoute && canEditCurrentGame;
  /** Editor workbench sidebar (creator route full rail, or game route Game tools rail). */
  const hostEditorWorkbench = isCreatorWorkbenchContext || showCreatorGameMenus;
  const shouldShowMobileSidebarToggle =
    isGameRoute &&
    isVisible &&
    isMobile &&
    !isOverlayOpen &&
    !shouldHideSidebarForPlayers;
  // Only when the inline sidebar is not shown (mobile drawer UX). Desktop uses the sidebar rail / expand control.
  const shouldShowCreatorSidebarToggle =
    (showCreatorGameMenus || isCreatorWorkbenchContext) &&
    isVisible &&
    isMobile &&
    !isOverlayOpen;

  const level = levels[currentLevel - 1];
  const points = useAppSelector((state) => state.points);
  const { syncLevelFields } = useLevelMetaSync();
  const shouldEmphasizeFinishGame = points.allMaxPoints > 0 && points.allPoints >= points.allMaxPoints;
  const mapEditorRef = useRef<MapEditorRef>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetScope, setResetScope] = useState<"level" | "game">("level");
  const [hasDismissedCompactGameShake, setHasDismissedCompactGameShake] = useState(false);
  const [creatorWorkbenchPanels, setCreatorWorkbenchPanels] = useState<
    Record<CreatorWorkbenchSubnavTabId, boolean>
  >({
    creator: true,
    events: true,
    game: true,
  });
  const storedSelectedSequenceScenarioId = useEventSequenceUiState(
    useCallback((state) => state.selectedScenarioIdsByLevel[currentLevel] ?? null, [currentLevel]),
  );
  const selectedSequenceScenarioId = storedSelectedSequenceScenarioId ?? level?.scenarios?.[0]?.scenarioId ?? null;
  const selectedSequenceScenarioInteractive = useEventSequenceUiState(
    useCallback((state) => {
      if (!selectedSequenceScenarioId) {
        return false;
      }
      return state.creatorPreviewInteractiveByScenario[
        getEventSequenceScenarioUiKey(currentLevel, selectedSequenceScenarioId)
      ] ?? false;
    }, [currentLevel, selectedSequenceScenarioId]),
  );
  const selectedSequenceRuntimeKey = useMemo(
    () => (
      selectedSequenceScenarioId
        ? getEventSequenceRuntimeKey(currentLevel, selectedSequenceScenarioId, true)
        : null
    ),
    [currentLevel, selectedSequenceScenarioId],
  );
  const selectedSequenceRuntime = useSyncExternalStore(
    useCallback(
      (listener) => (selectedSequenceRuntimeKey ? subscribeSequenceRuntime(selectedSequenceRuntimeKey, listener) : () => {}),
      [selectedSequenceRuntimeKey],
    ),
    useCallback(
      () => (selectedSequenceRuntimeKey ? getSequenceRuntimeState(selectedSequenceRuntimeKey) : EMPTY_SEQUENCE_RUNTIME_STATE),
      [selectedSequenceRuntimeKey],
    ),
    useCallback(
      () => (selectedSequenceRuntimeKey ? getSequenceRuntimeState(selectedSequenceRuntimeKey) : EMPTY_SEQUENCE_RUNTIME_STATE),
      [selectedSequenceRuntimeKey],
    ),
  );
  const selectedSequenceSteps = selectedSequenceScenarioId
    ? level?.eventSequence?.byScenarioId?.[selectedSequenceScenarioId] ?? []
    : [];
  const selectedSequenceStepId = useEventSequenceUiState(
    useCallback((state) => {
      if (!selectedSequenceScenarioId) {
        return null;
      }
      return state.selectedStepIdByScenario[getEventSequenceScenarioUiKey(currentLevel, selectedSequenceScenarioId)] ?? null;
    }, [currentLevel, selectedSequenceScenarioId]),
  );
  const selectedSequenceStep = selectedSequenceStepId && selectedSequenceStepId !== INITIAL_EVENT_SEQUENCE_STEP_ID
    ? selectedSequenceSteps.find((step) => step.id === selectedSequenceStepId) ?? null
    : null;
  const selectedSequenceStepIsLast = Boolean(
    selectedSequenceStep
    && selectedSequenceSteps.length > 0
    && selectedSequenceSteps[selectedSequenceSteps.length - 1]?.id === selectedSequenceStep.id,
  );
  const autoReplayOnMount = useEventSequenceUiState(
    useCallback((state) => {
      if (!selectedSequenceScenarioId) {
        return false;
      }
      return state.autoReplayOnMountByScenario[getEventSequenceScenarioUiKey(currentLevel, selectedSequenceScenarioId)] ?? false;
    }, [currentLevel, selectedSequenceScenarioId]),
  );

  useEffect(() => {
    if (!shouldEmphasizeFinishGame) {
      setHasDismissedCompactGameShake(false);
    }
  }, [shouldEmphasizeFinishGame]);

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
    if (!currentGame?.id || !isGroupGame) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "lobby");
    params.delete("groupId");
    const query = params.toString();
    router.push(apiUrl(`/game/${currentGame.id}${query ? `?${query}` : ""}`));
  }, [currentGame?.id, isGroupGame, router, searchParams]);

  const handleAnchorElReset = useCallback(() => {
    setIsResetDialogOpen(false);
  }, []);

  const handleStartSingleStepRecording = useCallback(() => {
    if (!selectedSequenceRuntimeKey || !selectedSequenceScenarioId) {
      return;
    }
    setSelectedScenarioIdForLevel(currentLevel, selectedSequenceScenarioId);
    setEventSequencePanelOpen(currentLevel, selectedSequenceScenarioId, true);
    updateSequenceRuntimeState(selectedSequenceRuntimeKey, (current) => ({
      ...current,
      recordingMode: "single",
    }));
  }, [currentLevel, selectedSequenceRuntimeKey, selectedSequenceScenarioId]);

  const handleStartContinuousRecording = useCallback(() => {
    if (!selectedSequenceRuntimeKey || !selectedSequenceScenarioId) {
      return;
    }
    setSelectedScenarioIdForLevel(currentLevel, selectedSequenceScenarioId);
    setEventSequencePanelOpen(currentLevel, selectedSequenceScenarioId, true);
    updateSequenceRuntimeState(selectedSequenceRuntimeKey, (current) => ({
      ...current,
      recordingMode: "continuous",
    }));
  }, [currentLevel, selectedSequenceRuntimeKey, selectedSequenceScenarioId]);

  const handleStopSequenceRecording = useCallback(() => {
    if (!selectedSequenceRuntimeKey) {
      return;
    }
    updateSequenceRuntimeState(selectedSequenceRuntimeKey, (current) => ({
      ...current,
      recordingMode: "idle",
    }));
  }, [selectedSequenceRuntimeKey]);

  const handleClearSelectedSequence = useCallback(() => {
    if (!selectedSequenceScenarioId) {
      return;
    }
    dispatch(clearEventSequenceForScenario({ levelId: currentLevel, scenarioId: selectedSequenceScenarioId }));
    syncLevelFields(currentLevel - 1, ["eventSequence"]);
    if (selectedSequenceRuntimeKey) {
      resetSequenceRuntimeState(selectedSequenceRuntimeKey);
    }
    setSelectedEventSequenceStepId(currentLevel, selectedSequenceScenarioId, INITIAL_EVENT_SEQUENCE_STEP_ID);
  }, [currentLevel, dispatch, selectedSequenceRuntimeKey, selectedSequenceScenarioId, syncLevelFields]);



  const handleRemoveSelectedStep = useCallback(() => {
    if (!selectedSequenceScenarioId || !selectedSequenceStep || !selectedSequenceStepIsLast) {
      return;
    }
    dispatch(removeEventSequenceStep({
      levelId: currentLevel,
      scenarioId: selectedSequenceScenarioId,
      stepId: selectedSequenceStep.id,
    }));
    syncLevelFields(currentLevel - 1, ["eventSequence"]);
    setSelectedEventSequenceStepId(currentLevel, selectedSequenceScenarioId, INITIAL_EVENT_SEQUENCE_STEP_ID);
  }, [currentLevel, dispatch, selectedSequenceScenarioId, selectedSequenceStep, selectedSequenceStepIsLast, syncLevelFields]);

  const handleSetSelectedScenarioInteractive = useCallback((checked: boolean) => {
    if (!selectedSequenceScenarioId) {
      return;
    }
    setSelectedScenarioIdForLevel(currentLevel, selectedSequenceScenarioId);
    setCreatorPreviewInteractiveForScenario(currentLevel, selectedSequenceScenarioId, checked);
    if (checked) {
      setEventSequencePanelOpen(currentLevel, selectedSequenceScenarioId, true);
    }
    if (!checked && selectedSequenceRuntimeKey) {
      updateSequenceRuntimeState(selectedSequenceRuntimeKey, (current) => ({
        ...current,
        recordingMode: "idle",
      }));
    }
  }, [currentLevel, selectedSequenceRuntimeKey, selectedSequenceScenarioId]);

  const renderGameMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <CompactMenuButton icon={Gamepad2} label="Game" text="Game" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 border-0 shadow-lg">
        <DropdownMenuLabel>Game Tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isGameRoute && currentGame?.id && isGroupGame && (
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
              shouldShake={shouldEmphasizeFinishGame}
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={compactMenuButtonClass}
                    onClick={() => setHasDismissedCompactGameShake(true)}
                  >
                    <Shaker
                      value={points.allPoints >= points.allMaxPoints && points.allMaxPoints > 0 ? 1 : 0}
                      className={cn(
                        "inline-flex items-center justify-center gap-1 max-[519px]:flex-col",
                        shouldEmphasizeFinishGame && !hasDismissedCompactGameShake && "animate-shake-burst",
                      )}
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
                  {isGroupGame && (
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
                  )}
                  <div className="mt-3 rounded-md bg-background/80 px-3 py-2">
                    <AplusSubmitButton
                      displayMode="icon-label"
                      shouldShake={shouldEmphasizeFinishGame}
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
      {isGroupGame && (
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
      )}
      <div className="flex flex-none">
        <AplusSubmitButton displayMode="icon-label" shouldShake={shouldEmphasizeFinishGame} />
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
              onClick={openOverlay}
              title="Open sidebar"
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
              onClick={openOverlay}
              title="Open sidebar"
            />
          </div>
        </div>
      ) : null}
      <div className="flex flex-none">
        <div className="rounded-md px-2 py-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <CompactMenuButton
                icon={Wrench}
                label="Tools"
                text="Tools"
                title="Choose which sidebar tool panels to show"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 border-0 shadow-lg">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Sidebar panels
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CREATOR_WORKBENCH_SUBNAV_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <DropdownMenuCheckboxItem
                    key={tab.id}
                    checked={creatorWorkbenchPanels[tab.id]}
                    onCheckedChange={(checked) => {
                      setCreatorWorkbenchPanels((prev) => ({
                        ...prev,
                        [tab.id]: checked === true,
                      }));
                    }}
                    onSelect={(event) => event.preventDefault()}
                    title={tab.tooltip}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0" />
                    {tab.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
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

  const isSequenceRecording = selectedSequenceRuntime.recordingMode !== "idle";
  const interactionSubnavItems = useMemo((): SubNavbarItem[] => [
    ...(selectedSequenceScenarioId ? [{
      id: "interaction-mode",
      label: selectedSequenceScenarioInteractive ? "Live" : "Static",
      icon: selectedSequenceScenarioInteractive ? MousePointer : Eye,
      onClick: () => handleSetSelectedScenarioInteractive(!selectedSequenceScenarioInteractive),
      active: selectedSequenceScenarioInteractive,
      variant: "secondary" as const,
      tooltip: selectedSequenceScenarioInteractive
        ? "Switch to static (read-only preview)."
        : "Switch to live mode to drive the scenario and record event sequences.",
    }] : []),
    ...(selectedSequenceScenarioId && !isSequenceRecording ? [{
      id: "add-event",
      label: "Add event",
      icon: ListPlus,
      onClick: handleStartSingleStepRecording,
      disabled: !selectedSequenceScenarioInteractive,
      tooltip: !selectedSequenceScenarioInteractive
        ? "Turn on live mode to add an event."
        : "Record the next interaction as a single event.",
    }, {
      id: "record-sequence",
      label: selectedSequenceSteps.length > 0 ? "Set events" : "Create event sequence",
      icon: ListOrdered,
      onClick: handleStartContinuousRecording,
      disabled: !selectedSequenceScenarioInteractive,
      tooltip: !selectedSequenceScenarioInteractive
        ? "Turn on live mode to record an event sequence."
        : selectedSequenceSteps.length > 0
          ? "Record a new event sequence in one pass; saving replaces the current events."
          : "Record the full interaction sequence in one pass.",
    }] : []),
    ...(isSequenceRecording ? [{
      id: "stop-recording",
      label: "Stop & save",
      icon: Square,
      onClick: handleStopSequenceRecording,
    }] : []),
  
    ...(selectedSequenceSteps.length > 0 ? [{
      id: "clear-events",
      label: "Clear events",
      icon: ListX,
      onClick: handleClearSelectedSequence,
      variant: "ghost" as const,
    }] : []),
    ...(selectedSequenceStep ? [{
      id: "remove-event",
      label: "Remove event",
      icon: ListMinus,
      onClick: handleRemoveSelectedStep,
      disabled: !selectedSequenceStepIsLast,
      tooltip: selectedSequenceStepIsLast
        ? undefined
        : "Only the last recorded event can be removed.",
      variant: "ghost" as const,
    }] : []),
    ...(selectedSequenceSteps.length > 0 && !isSequenceRecording ? [{
      id: "auto-replay",
      label: selectedSequenceRuntime.autoReplay?.running ? "Stop run" : "Run events",
      icon: selectedSequenceRuntime.autoReplay?.running ? Square : Play,
      onClick: () => {
        if (!selectedSequenceRuntimeKey) return;
        if (selectedSequenceRuntime.autoReplay?.running) {
          cancelAutoReplay(selectedSequenceRuntimeKey);
        } else {
          requestAutoReplay(selectedSequenceRuntimeKey, selectedSequenceSteps.length + 1);
        }
      },
      active: Boolean(selectedSequenceRuntime.autoReplay?.running),
    }] : []),
    ...(selectedSequenceSteps.length > 0 && !isSequenceRecording ? [{
      id: "auto-replay-on-mount",
      label: "Auto-run events",
      icon: AutoRunCircle,
      iconClassName: "!h-5 !w-5 !min-h-[1.25rem] !min-w-[1.25rem]",
      onClick: () => {
        if (!selectedSequenceScenarioId) return;
        setAutoReplayOnMount(currentLevel, selectedSequenceScenarioId, !autoReplayOnMount);
      },
      active: autoReplayOnMount,
      variant: "outline" as const,
      tooltip: "Automatically run and compare all events when the page loads.",
    }] : []),
  ], [
    autoReplayOnMount,
    currentLevel,
    handleClearSelectedSequence,
    handleRemoveSelectedStep,
    handleSetSelectedScenarioInteractive,
    handleStartContinuousRecording,
    handleStartSingleStepRecording,
    handleStopSequenceRecording,
    isSequenceRecording,
    selectedSequenceRuntime,
    selectedSequenceRuntimeKey,
    selectedSequenceScenarioId,
    selectedSequenceScenarioInteractive,
    selectedSequenceStep,
    selectedSequenceStepIsLast,
    selectedSequenceSteps.length,
  ]);

  const handleSwitchToCreator = useCallback(() => {
    if (!currentGame?.id) {
      return;
    }
    router.push(apiUrl(`/creator/${currentGame.id}`));
  }, [currentGame?.id, router]);

  const gameRouteInteractionRunItems = useMemo(
    () =>
      interactionSubnavItems.filter(
        (item) => item.id === "auto-replay" || item.id === "auto-replay-on-mount",
      ),
    [interactionSubnavItems],
  );

  const gameRouteWorkbenchSections = useMemo((): CreatorWorkbenchSection[] => [
    {
      id: "game",
      visible: true,
      title: "Game",
      children: (
        <GameToolsSidebar
          mapEditorRef={mapEditorRef}
          isGameRoute={isGameRoute}
          isCreatorRoute={isCreatorRoute}
          currentGameId={currentGame?.id}
          canEditCurrentGame={canEditCurrentGame}
          showCreatorGameMenus={showCreatorGameMenus}
          isGroupGame={isGroupGame}
          openGameLobby={openGameLobby}
          togglePopper={togglePopper}
          shouldEmphasizeFinishGame={shouldEmphasizeFinishGame}
          interactionRunItems={gameRouteInteractionRunItems}
          onSwitchToCreator={handleSwitchToCreator}
        />
      ),
    },
  ], [
    canEditCurrentGame,
    currentGame?.id,
    gameRouteInteractionRunItems,
    handleSwitchToCreator,
    isGameRoute,
    isCreatorRoute,
    isGroupGame,
    openGameLobby,
    showCreatorGameMenus,
    shouldEmphasizeFinishGame,
    togglePopper,
  ]);

  const creatorWorkbenchSections = useMemo((): CreatorWorkbenchSection[] => [
    {
      id: "events",
      visible: creatorWorkbenchPanels.events,
      title: "Events",
      items: interactionSubnavItems,
    },
    {
      id: "creator",
      visible: creatorWorkbenchPanels.creator,
      title: "Levels",
      children: <CreatorControls displayMode="sidebar" />,
    },
    {
      id: "game",
      visible: creatorWorkbenchPanels.game,
      title: "Game",
      children: (
        <GameToolsSidebar
          mapEditorRef={mapEditorRef}
          isGameRoute={isGameRoute}
          isCreatorRoute={isCreatorRoute}
          currentGameId={currentGame?.id}
          canEditCurrentGame={canEditCurrentGame}
          showCreatorGameMenus={showCreatorGameMenus}
          isGroupGame={isGroupGame}
          openGameLobby={openGameLobby}
          togglePopper={togglePopper}
          shouldEmphasizeFinishGame={shouldEmphasizeFinishGame}
        />
      ),
    },
  ], [
    canEditCurrentGame,
    creatorWorkbenchPanels.creator,
    creatorWorkbenchPanels.game,
    creatorWorkbenchPanels.events,
    currentGame?.id,
    interactionSubnavItems,
    isCreatorRoute,
    isGameRoute,
    isGroupGame,
    openGameLobby,
    showCreatorGameMenus,
    shouldEmphasizeFinishGame,
    togglePopper,
  ]);

  const [creatorWorkbenchSidebarHost, setCreatorWorkbenchSidebarHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!hostEditorWorkbench) {
      setCreatorWorkbenchSidebarHost(null);
      return;
    }
    setCreatorWorkbenchSidebarHost(document.getElementById("creator-workbench-sidebar-root"));
  }, [hostEditorWorkbench]);

  if (!level) return null;

  return (
    <>
      <div
        className="flex w-full flex-wrap items-center justify-around gap-2 border-b bg-background/80 px-3 py-2 2xl:flex-nowrap 2xl:justify-between"
      >
        {(isGameRoute || isCreatorWorkbenchContext) && (
          <div className={`${isMobile ? "flex" : "hidden"} w-full min-w-0 items-center gap-1`}>
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
        <div className={`${isMobile ? "hidden" : "flex"} flex-1 min-w-0 items-center gap-1`}>
          {showCreatorGameMenus && currentGame?.id ? (
            renderCompactCreatorMenus()
          ) : isCreatorWorkbenchContext ? (
            renderCompactCreatorWorkbenchMenus()
          ) : !isCreatorRoute && !isGameRoute ? (
            <ModeToggleButton displayMode="icon-label" />
          ) : null}

          {isGameRoute && !showCreatorGameMenus ? (
            <>
              <div className={`${isMobile ? "hidden" : "flex"} flex-1 min-w-0 items-center gap-2`}>
                {renderInlinePlayerMenus()}
              </div>
              <div className={`${isMobile ? "flex" : "hidden"} flex-1 min-w-0 items-center gap-1`}>
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
      {hostEditorWorkbench && creatorWorkbenchSidebarHost
        ? createPortal(
            isCreatorWorkbenchContext ? (
              <CreatorAutosaveProvider>
                <CreatorWorkbenchSubSidebar sections={creatorWorkbenchSections} />
              </CreatorAutosaveProvider>
            ) : (
              <CreatorWorkbenchSubSidebar sections={gameRouteWorkbenchSections} />
            ),
            creatorWorkbenchSidebarHost,
          )
        : null}
    </>
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
