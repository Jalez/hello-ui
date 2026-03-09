'use client';

import Editors from "./Editors/Editors";
import { ArtBoards } from "./ArtBoards/ArtBoards";
import { LevelUpdater } from "./General/LevelUpdater";
import { GameContainer } from "./General/GameContainer";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useEffect, useState, useRef } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { updateWeek, setAllLevels } from "@/store/slices/levels.slice";
import { Footer } from "./Footer/Footer";
import { Navbar } from "./Navbar/Navbar";
import { setMode } from "@/store/slices/options.slice";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { Level } from "@/types";
import Notifications from "./General/Notifications";
import { SnackbarProvider } from "notistack";
import { setSolutions } from "@/store/slices/solutions.slice";
import { resetSolutionUrls } from "@/store/slices/solutionUrls.slice";
import { getAllLevels } from "@/lib/utils/network/levels";
import { getMapLevels } from "@/lib/utils/network/maps";
import { initializePointsFromLevelsStateThunk } from "@/store/actions/score.actions";
import { mergeSavedPoints } from "@/store/slices/points.slice";
import { ProgressionSync } from "./General/ProgressionSync";
import { ProgressPersistence } from "./General/ProgressPersistence";
import { GameplayTelemetryTracker } from "./General/GameplayTelemetryTracker";
import { useGameStore } from "./default/games";
import { useSession } from "next-auth/react";
import type { Mode } from "@/store/slices/options.slice";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { apiUrl, stripBasePath } from "@/lib/apiUrl";

export const allLevels: Level[] = [];
type SolutionsByLevelName = Record<string, { html: string; css: string; js: string }>;

function normalizeRoomStateLevels(levels: Array<Record<string, unknown>>): Level[] {
  return levels.map((rawLevel) => {
    const levelWithoutVersions = {
      ...rawLevel,
    } as Record<string, unknown> & { versions?: unknown };
    delete levelWithoutVersions.versions;
    return levelWithoutVersions as unknown as Level;
  });
}

function App() {
  const levels = useAppSelector((state) => state.levels);
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);
  const [isLoading, setIsLoading] = useState(true);
  const currentGame = useGameStore((state) => state.getCurrentGame());
  const { data: session } = useSession();
  const collaboration = useOptionalCollaboration();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const params = useParams<{ gameId?: string }>();
  const mode = searchParams.get('mode');
  const routeGameIdParam = params?.gameId;
  const routeGameId = Array.isArray(routeGameIdParam) ? routeGameIdParam[0] : routeGameIdParam;
  const hasFetchedRef = useRef(false);
  const lastGameIdRef = useRef<string | null>(null);
  const lastModeRef = useRef<string | null>(null);
  const lastRoomIdRef = useRef<string | null>(null);
  const lastRoomStateTsRef = useRef<number | null>(null);
  const setIsLoadingAsync = (value: boolean) => {
    queueMicrotask(() => setIsLoading(value));
  };

  useEffect(() => {
    hasFetchedRef.current = false;
    lastGameIdRef.current = null;
    lastModeRef.current = null;
    lastRoomIdRef.current = null;
    lastRoomStateTsRef.current = null;
    if (currentGame?.id) {
      console.log("[App] Game context changed, forcing reload", {
        gameId: currentGame.id,
        mapName: currentGame.mapName,
      });
    }
  }, [currentGame?.id, currentGame?.mapName]);

  useEffect(() => {
    // Get current URL params
    const urlParams = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
    const isGameRoute = normalizedPathname.startsWith('/game/');
    const isCreatorRoute = normalizedPathname.startsWith('/creator/');
    const isGameContextRoute = isGameRoute || isCreatorRoute;
    const defaultMode: Mode = "game";
    const rawRequestedMode = (urlParams.get("mode") || defaultMode) as Mode;
    const requestedMode: Mode = rawRequestedMode === "test" ? "game" : rawRequestedMode;

    const sessionUserId = session?.userId || session?.user?.email || "";
    const gameOwnerId = currentGame?.userId || "";
    const fallbackOwnerCheck = !!gameOwnerId && sessionUserId === gameOwnerId;
    const canEditCurrentGame = currentGame?.canEdit ?? fallbackOwnerCheck;

    const currentMode: Mode = isCreatorRoute
      ? (canEditCurrentGame ? "creator" : "game")
      : "game";

    if (isCreatorRoute && currentMode === "game" && currentGame?.id) {
      router.replace(apiUrl(`/game/${currentGame.id}?mode=game`));
      return;
    }

    if ((isGameRoute || isCreatorRoute) && (!routeGameId || !currentGame?.id || currentGame.id !== routeGameId)) {
      setIsLoadingAsync(true);
      return;
    }

    if (isGameContextRoute && !currentGame?.mapName) {
      setIsLoadingAsync(true);
      return;
    }

    if (isGameContextRoute && requestedMode !== currentMode && !isCreatorRoute) {
      const normalizedParams = new URLSearchParams(urlParams.toString());
      normalizedParams.set("mode", currentMode);
      router.replace(apiUrl(`${normalizedPathname}?${normalizedParams.toString()}`));
    }

    const currentGameId = currentGame?.id || null;
    const roomStateTs = collaboration?.initialRoomState?.ts ?? null;
    const shouldUseWsCodeSource =
      currentMode === "game" &&
      Boolean(collaboration?.roomId);

    if (shouldUseWsCodeSource && (!collaboration?.codeSyncReady || !collaboration?.initialRoomState)) {
      setIsLoadingAsync(true);
      return;
    }

    // Check if game or mode changed
    const gameChanged = lastGameIdRef.current !== currentGameId;
    const modeChanged = lastModeRef.current !== currentMode;
    const roomChanged = lastRoomIdRef.current !== (collaboration?.roomId || null);
    const roomStateChanged = lastRoomStateTsRef.current !== roomStateTs;

    // If nothing affecting the data source changed and we already fetched, skip
    if (hasFetchedRef.current && !gameChanged && !modeChanged && !roomChanged && !roomStateChanged) {
      return;
    }

    hasFetchedRef.current = true;
    lastGameIdRef.current = currentGameId;
    lastModeRef.current = currentMode;
    lastRoomIdRef.current = collaboration?.roomId || null;
    lastRoomStateTsRef.current = roomStateTs;

    const isCreator = currentMode === "creator";

    const applyLevels = async (levelsSnapshot: Level[], mapName: string) => {
      let solutions: SolutionsByLevelName = {};
      try {
        let fetchedLevels: Level[] = levelsSnapshot;
        let nextLevels: Level[] = levelsSnapshot;

        solutions = nextLevels.reduce((acc, level) => {
          acc[level.name] = {
            html: level.solution.html,
            css: level.solution.css,
            js: level.solution.js,
          };
          return acc;
        }, {} as SolutionsByLevelName);

        if (isCreator) {
          nextLevels = nextLevels.map((level) => {
            level.solution = {
              html: solutions[level.name]?.html || "",
              css: solutions[level.name]?.css || "",
              js: solutions[level.name]?.js || "",
            };
            return level as Level;
          });
        }

        // Only non-collaborative paths fall back to a local starter level.
        if (nextLevels.length === 0 && !shouldUseWsCodeSource) {
          console.log("No levels found, creating empty starter level");
          const emptyLevel: Level = {
            name: "template",
            scenarios: [],
            buildingBlocks: { pictures: [], colors: [] },
            code: { html: "", css: "", js: "" },
            solution: { html: "", css: "", js: "" },
            accuracy: 0,
            week: mapName,
            percentageTreshold: 70,
            percentageFullPointsTreshold: 95,
            difficulty: "easy",
            instructions: [],
            question_and_answer: { question: "", answer: "" },
            help: { description: "Start coding!", images: [], usefullCSSProperties: [] },
            timeData: { startTime: 0, pointAndTime: { 0: "0:0", 1: "0:0", 2: "0:0", 3: "0:0", 4: "0:0", 5: "0:0" } },
            events: [],
            interactive: false,
            showScenarioModel: true,
            showHotkeys: false,
            showModelPicture: true,
            lockCSS: false,
            lockHTML: false,
            lockJS: false,
            completed: "",
            points: 0,
            maxPoints: 100,
            confettiSprinkled: false,
          };
          fetchedLevels = [emptyLevel];
          nextLevels = [emptyLevel];
          solutions[emptyLevel.name] = { html: "", css: "", js: "" };
          console.log("Empty level created:", emptyLevel);
        }

        // Dispatch all updates synchronously
        console.log("Dispatching levels to Redux, count:", nextLevels.length);
        dispatch(updateWeek({ levels: nextLevels, mapName, gameId: currentGame?.id, mode: currentMode, forceFresh: modeChanged }));
        dispatch(setSolutions(solutions));
        dispatch(resetSolutionUrls());
        setAllLevels(fetchedLevels);
        await dispatch(initializePointsFromLevelsStateThunk());

        // Restore saved best points per level from game instance (after points slice is initialized)
        const game = useGameStore.getState().getCurrentGame();
        const pointsByLevel = game?.progressData && typeof game.progressData === "object" && "pointsByLevel" in game.progressData
          ? (game.progressData as { pointsByLevel?: Record<string, { points?: number; maxPoints?: number; accuracy?: number; bestTime?: string; scenarios?: { scenarioId: string; accuracy: number }[] }> }).pointsByLevel
          : undefined;
        if (pointsByLevel && Object.keys(pointsByLevel).length > 0) {
          dispatch(mergeSavedPoints(pointsByLevel));
        }

        // Reset to level 1 when loading new levels
        dispatch(setCurrentLevel(1));

        console.log("All dispatches complete, setting isLoading to false");
        // Set loading false immediately after dispatches (they're synchronous)
        setIsLoadingAsync(false);
      } catch (error) {
        console.error("Error applying levels:", error);
        setIsLoadingAsync(false);
      }
    };

    setIsLoadingAsync(true);
    if (shouldUseWsCodeSource) {
      const roomStateLevels = normalizeRoomStateLevels(
        (collaboration?.initialRoomState?.levels || []) as Array<Record<string, unknown>>
      );
      applyLevels(roomStateLevels, currentGame!.mapName);
    } else {
      // Game-context routes must always use the loaded game's map; never "all" to avoid loading every level.
      const mapToFetch = isGameContextRoute
        ? currentGame!.mapName
        : urlParams.get("map") || "all";

      const fetchLevels = async (mapName: string) => {
        try {
          let fetchedLevels: Level[] = [];
          if (!currentGame?.id && mapName === "all") {
            fetchedLevels = await getAllLevels();
          } else {
            fetchedLevels = await getMapLevels(mapName);
          }
          await applyLevels(fetchedLevels, mapName);
        } catch (error) {
          console.error("Error fetching levels:", error);
          setIsLoadingAsync(false);
        }
      };
      fetchLevels(mapToFetch);
    }

    // Set mode (which also updates creator for backward compatibility)
    dispatch(setMode(currentMode));
  }, [
    dispatch,
    currentGame,
    currentGame?.id,
    currentGame?.mapName,
    currentGame?.userId,
    mode,
    routeGameId,
    normalizedPathname,
    router,
    session?.userId,
    session?.user?.email,
    collaboration?.roomId,
    collaboration?.codeSyncReady,
    collaboration?.initialRoomState,
  ]);

  const isWaitingForSharedCode =
    options.mode === "game" &&
    Boolean(collaboration?.roomId) &&
    (
      !collaboration.codeSyncReady ||
      !collaboration.initialRoomState
    );

  // Request enough height from parent LTI iframe to prevent scrollbars
  useEffect(() => {
    console.log("isLoading", isLoading);
    if (isLoading) return;

    const targetHeight = 900;
    try {
      window.parent.postMessage({ subject: "lti.frameResize", height: targetHeight }, "*");
      window.parent.postMessage({ type: "a-plus-resize-iframe", height: targetHeight }, "*");
    } catch (e) {
      console.warn("Could not post frameResize message to parent", e);
    }
  }, [isLoading]);

  return (
    <SnackbarProvider>
      <ProgressionSync />
      <ProgressPersistence />
      <GameplayTelemetryTracker />
      <article id="App" className="h-full flex flex-col justify-between">
        <LevelUpdater />
        <div className="flex-1">
          <Notifications />

          <GameContainer>
            {isLoading || isWaitingForSharedCode ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground">
                    {isWaitingForSharedCode ? "Syncing shared code..." : "Loading levels..."}
                  </p>
                </div>
              </div>
            ) : levels.length > 0 ? (
              <>
                <Navbar />
                <div
                  className="flex flex-row flex-wrap justify-center items-stretch w-full flex-1 overflow-hidden"
                >
                  <div className="flex-1 flex items-center justify-center">
                    <ArtBoards />
                  </div>
                  <Editors />
                </div>
                <Footer />
              </>
            ) : null}
          </GameContainer>
        </div>
      </article>
    </SnackbarProvider>
  );
}

export default App;
