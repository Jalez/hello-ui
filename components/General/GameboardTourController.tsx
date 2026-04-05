"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Joyride, EVENTS, STATUS, type Step } from "react-joyride";
import { GameboardTourTooltip } from "@/components/General/GameboardTourTooltip";
import { useAppSelector } from "@/store/hooks/hooks";
import { apiUrl, stripBasePath } from "@/lib/apiUrl";
import {
  getTourSpotVersion,
  type TourSpotKey,
  TOUR_SPOT_VERSIONS,
} from "@/lib/tour/tourSpotVersions";

/**
 * Navbar spots (player + creator), workbench rail, then gameboard.
 * Only targets present in the DOM are included (viewport and role).
 */
const SPOT_ORDER: TourSpotKey[] = [
  "navbar.game_route_score",
  "navbar.game_route_mobile_game_menu",
  "navbar.game_route_levels",
  "navbar.game_route_lobby",
  "navbar.game_route_finish",
  "navbar.creator_game_menu",
  "navbar.creator_workbench_tools",
  "navbar.creator_levels",
  "creator.workbench_sidebar",
  "gameboard.events_strip",
  "gameboard.scenario_run_controls",
  "footer.help",
  "footer.level_menu",
  "footer.time_menu",
  "footer.info",
  "footer.collaboration",
];

const STEP_CONTENT: Record<
  TourSpotKey,
  { title: string; description: string; content: string }
> = {
  "navbar.game_route_score": {
    title: "Total score",
    description: "Your progress across every level in this game.",
    content:
      "The two numbers are points earned so far and the maximum you can reach. Hover for a short reminder.",
  },
  "navbar.game_route_mobile_game_menu": {
    title: "Game menu (small screens)",
    description: "Score, lobby, and finish in one place on narrow layouts.",
    content:
      "Open this menu to see your total score, return to the group lobby when playing with others, and finish the game when you’re done.",
  },
  "navbar.game_route_levels": {
    title: "Levels",
    description: "Switch levels and see your best accuracy on each.",
    content:
      "Pick any level from the list. The percentage is your best match to the design on that level.",
  },
  "navbar.game_route_lobby": {
    title: "Group lobby",
    description: "For multiplayer games with teams.",
    content:
      "Return here to change groups, wait for teammates, or rejoin after leaving the play view.",
  },
  "navbar.game_route_finish": {
    title: "Finish game",
    description: "End your run and save or submit your score.",
    content:
      "Opens the finish screen: review your result, save progress, and submit if your course or LMS requires it.",
  },
  "navbar.creator_game_menu": {
    title: "Game menu",
    description: "While editing this game from play mode.",
    content:
      "Open for creator preview, lobby, resets, finish, the level map, and statistics. Use “Go to creator” for the full workbench.",
  },
  "navbar.creator_workbench_tools": {
    title: "Tools",
    description: "Choose which workbench panels are visible.",
    content:
      "Toggle Events, Levels, and Game tool strips on the right rail so you only keep what you need open.",
  },
  "navbar.creator_levels": {
    title: "Levels (creator)",
    description: "Jump between levels while you author.",
    content:
      "Switch the active level from the bar. Open the map from the Game menu to rename or reorder levels.",
  },
  "creator.workbench_sidebar": {
    title: "Workbench sidebar",
    description: "Compact tools next to the canvas.",
    content:
      "Each section matches a panel: event-sequence controls, level authoring, and game tools (lobby, resets, finish, map).",
  },
  "gameboard.events_strip": {
    title: "Events",
    description: "Inspect and compare each recorded interaction against your design.",
    content:
      "Use the strip to step through events in order. Select a circle to see how closely the recorded state matches your CSS at that moment.",
  },
  "gameboard.scenario_run_controls": {
    title: "Run scenario events",
    description: "Play back or automate the scenario’s event timeline.",
    content:
      "Replay the full sequence from the start, or turn on auto-run so events advance when you open the page.",
  },
  "footer.help": {
    title: "Help",
    description: "Documentation and tips for this mode.",
    content:
      "Open the help panel for shortcuts, how scoring works, and where to get unstuck.",
  },
  "footer.level_menu": {
    title: "Level details",
    description: "Compact footer: current level stats and actions.",
    content:
      "See points, difficulty, accuracy, color targets, and thresholds. Creators can edit thresholds; everyone can reset this level from here.",
  },
  "footer.time_menu": {
    title: "Time",
    description: "How long you’ve been on this level and your best time.",
    content:
      "Track elapsed time on the current attempt and compare to your best run (players only).",
  },
  "footer.info": {
    title: "Level info strip",
    description: "Wide layout: stats across the footer center.",
    content:
      "On large screens the footer shows points, timer, and timing details in one row instead of separate Level and Time menus.",
  },
  "footer.collaboration": {
    title: "Group & instances",
    description: "Who you’re playing with or monitoring.",
    content:
      "Creators can jump between active group or student instances. Players in a group can copy the join key or see the group name.",
  },
};

function spotNeedsTour(spot: TourSpotKey, acks: Record<string, number>): boolean {
  const current = TOUR_SPOT_VERSIONS[spot];
  const seen = acks[spot];
  return seen === undefined || seen < current;
}

function buildStepsForSpots(spots: TourSpotKey[]): Step[] {
  return spots.map((spot) => {
    const copy = STEP_CONTENT[spot];
    return {
      target: `[data-tour-spot="${spot}"]`,
      title: copy.title,
      content: copy.content,
      // Footer sits at the bottom of the viewport; open the tooltip above the target.
      placement: (spot.startsWith("footer.") ? "top" : "bottom") as "top" | "bottom",
      skipBeacon: true,
      data: { spot, description: copy.description },
    };
  });
}

export function GameboardTourController() {
  const { status } = useSession();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname ?? "");
  const levels = useAppSelector((state) => state.levels);
  const [acks, setAcks] = useState<Record<string, number> | null>(null);
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const tourSpotsRef = useRef<TourSpotKey[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isGameOrCreator =
    normalizedPathname.startsWith("/game/") || normalizedPathname.startsWith("/creator/");

  useEffect(() => {
    if (status !== "authenticated") {
      setAcks(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/user/tour-spots"), { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { acks?: Record<string, number> };
        if (!cancelled) {
          setAcks(data.acks ?? {});
        }
      } catch {
        if (!cancelled) setAcks({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const tryStartTour = useCallback(() => {
    if (!acks || status !== "authenticated" || !isGameOrCreator || levels.length === 0) {
      return;
    }
    const needed = SPOT_ORDER.filter((s) => spotNeedsTour(s, acks));
    if (needed.length === 0) {
      return;
    }
    const present: TourSpotKey[] = [];
    for (const spot of needed) {
      if (document.querySelector(`[data-tour-spot="${spot}"]`)) {
        present.push(spot);
      }
    }
    if (present.length === 0) {
      return;
    }
    tourSpotsRef.current = present;
    setSteps(buildStepsForSpots(present));
    setRun(true);
  }, [acks, status, isGameOrCreator, levels.length]);

  useEffect(() => {
    if (!acks || !isGameOrCreator || levels.length === 0 || status !== "authenticated") {
      return;
    }
    const needed = SPOT_ORDER.some((s) => spotNeedsTour(s, acks));
    if (!needed) {
      return;
    }
    let attempts = 0;
    const maxAttempts = 40;
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    pollRef.current = setInterval(() => {
      attempts += 1;
      const hasAny = SPOT_ORDER.some((s) => {
        if (!spotNeedsTour(s, acks)) return false;
        return Boolean(document.querySelector(`[data-tour-spot="${s}"]`));
      });
      if (hasAny) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        tryStartTour();
      } else if (attempts >= maxAttempts) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }, 250);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [acks, isGameOrCreator, levels.length, status, tryStartTour]);

  const handleEvent = useCallback((data: { type: string; status: string }) => {
    if (data.type !== EVENTS.TOUR_END) {
      return;
    }
    if (data.status !== STATUS.FINISHED && data.status !== STATUS.SKIPPED) {
      return;
    }
    const spots = tourSpotsRef.current;
    if (spots.length === 0) {
      return;
    }
    const payload: Record<string, number> = {};
    for (const spot of spots) {
      payload[spot] = getTourSpotVersion(spot);
    }
    setRun(false);
    setSteps([]);
    tourSpotsRef.current = [];
    void fetch(apiUrl("/api/user/tour-spots"), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acks: payload }),
    }).then(() => {
      setAcks((prev) => ({ ...prev, ...payload }));
    });
  }, []);

  if (status !== "authenticated" || !isGameOrCreator || levels.length === 0 || steps.length === 0) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      tooltipComponent={GameboardTourTooltip}
      options={{
        zIndex: 10050,
        showProgress: true,
        // Match tooltip card fill (default Joyride arrow is #fff)
        arrowColor: "hsl(var(--card))",
      }}
    />
  );
}
