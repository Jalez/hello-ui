/** @format */
'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { KeyBindings } from "@/components/Editors/KeyBindings";
import ScenarioAdder from "./ScenarioAdder";
import ScenarioRemover from "./ScenarioRemover";
import SidebySideArt from "./SidebySideArt";
import { ScenarioDrawing } from "./Drawboard/ScenarioDrawing";
import { ScenarioModel } from "./ModelBoard/ScenarioModel";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ImageIcon, MousePointer } from "lucide-react";
import { scenario } from "@/types";
import { toggleImageInteractivity } from "@/store/slices/levels.slice";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import PoppingTitle from "@/components/General/PoppingTitle";

const EMPTY_SCENARIOS: scenario[] = [];

export const ArtBoards = (): React.ReactNode => {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string | undefined>);
  const isCreator = useAppSelector((state) => state.options.creator);
  const isCreatorRoute = pathname?.startsWith("/creator/") ?? false;
  const isCreatorContext = isCreator || isCreatorRoute;
  const { syncLevelFields } = useLevelMetaSync();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [creatorPreviewByScenarioId, setCreatorPreviewByScenarioId] = useState<Record<string, boolean | undefined>>({});
  const showHotkeys = level?.showHotkeys ?? false;
  const scenarios = level?.scenarios ?? EMPTY_SCENARIOS;

  const selectedScenario = useMemo(() => {
    if (scenarios.length === 0) {
      return null;
    }

    return scenarios.find((scenario) => scenario.scenarioId === selectedScenarioId)
      ?? scenarios[0];
  }, [scenarios, selectedScenarioId]);

  const selectedScenarioIndex = selectedScenario
    ? scenarios.findIndex((scenario) => scenario.scenarioId === selectedScenario.scenarioId)
    : -1;

  const selectedScenarioDrawingUrl = selectedScenario ? drawingUrls[selectedScenario.scenarioId] : undefined;
  const selectedScenarioPreviewChoice = selectedScenario
    ? creatorPreviewByScenarioId[selectedScenario.scenarioId]
    : undefined;
  const creatorPreviewInteractive = selectedScenario
    ? (selectedScenarioPreviewChoice ?? !selectedScenarioDrawingUrl)
    : false;

  const goToScenario = (nextIndex: number) => {
    const nextScenario = scenarios[nextIndex];
    if (!nextScenario) {
      return;
    }

    setSelectedScenarioId(nextScenario.scenarioId);
  };

  const handleSwitchInteractiveStatic = () => {
    if (isCreatorContext) {
      if (!selectedScenario) return;
      setCreatorPreviewByScenarioId((currentValue) => ({
        ...currentValue,
        [selectedScenario.scenarioId]: !creatorPreviewInteractive,
      }));
      return;
    }

    dispatch(toggleImageInteractivity(currentLevel));
    syncLevelFields(currentLevel - 1, ["interactive"]);
  };

  const interactive = level?.interactive ?? false;
  const showSwitch = Boolean(selectedScenario);
  const switchIsInteractive = isCreatorContext ? creatorPreviewInteractive : interactive;

  // Early return if level doesn't exist - parent handles loading state
  if (!level) {
    return null;
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      {scenarios.length > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-2 px-3 pb-3 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={selectedScenarioIndex <= 0}
            onClick={() => goToScenario(selectedScenarioIndex - 1)}
            aria-label="Show previous scenario"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select
            value={selectedScenario?.scenarioId ?? ""}
            onValueChange={setSelectedScenarioId}
          >
            <SelectTrigger className="h-9 w-full max-w-[260px]">
              <SelectValue placeholder="Select scenario" />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map((scenario, index) => (
                <SelectItem key={scenario.scenarioId} value={scenario.scenarioId}>
                  Scenario {index + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={selectedScenarioIndex < 0 || selectedScenarioIndex >= scenarios.length - 1}
            onClick={() => goToScenario(selectedScenarioIndex + 1)}
            aria-label="Show next scenario"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 w-full flex-col">
        {selectedScenario ? (
          <section className="flex min-h-0 flex-1 w-full items-center justify-center">
            <SidebySideArt
              key={selectedScenario.scenarioId}
              contents={[
                <ScenarioModel
                  key={`${selectedScenario.scenarioId}-model`}
                  scenario={selectedScenario}
                  creatorMode={isCreatorContext}
                  creatorPreviewInteractive={creatorPreviewInteractive}
                  registerForNavbarCapture
                />,
                <ScenarioDrawing
                  key={`${selectedScenario.scenarioId}-draw`}
                  scenario={selectedScenario}
                  creatorMode={isCreatorContext}
                  creatorPreviewInteractive={creatorPreviewInteractive}
                  registerForNavbarCapture
                />,
              ]}
            />
          </section>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
            No scenarios found
          </div>
        )}

        {showHotkeys ? (
          <div className="mt-3 flex justify-center">
            <KeyBindings />
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-0 right-0 z-[100] flex flex-row items-center gap-1 p-2">
        {showSwitch ? (
          <PoppingTitle topTitle={switchIsInteractive ? "Switch to Static" : "Switch to Interactive"}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handleSwitchInteractiveStatic}
              aria-label={switchIsInteractive ? "Switch to static" : "Switch to interactive"}
            >
              {switchIsInteractive ? <ImageIcon className="h-5 w-5" /> : <MousePointer className="h-5 w-5" />}
            </Button>
          </PoppingTitle>
        ) : null}
        <ScenarioRemover
          scenarioId={selectedScenario?.scenarioId ?? null}
          canRemove={scenarios.length > 1}
        />
        <ScenarioAdder />
      </div>
    </div>
  );
};
