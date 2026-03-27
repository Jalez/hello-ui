/** @format */
'use client';

import { useAppSelector } from "@/store/hooks/hooks";
import { KeyBindings } from "@/components/Editors/KeyBindings";
import ScenarioAdder from "./ScenarioAdder";
import SidebySideArt from "./SidebySideArt";
import { ScenarioDrawing } from "./Drawboard/ScenarioDrawing";
import { ScenarioModel } from "./ModelBoard/ScenarioModel";
import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { scenario } from "@/types";

const EMPTY_SCENARIOS: scenario[] = [];

export const ArtBoards = (): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
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

  const goToScenario = (nextIndex: number) => {
    const nextScenario = scenarios[nextIndex];
    if (!nextScenario) {
      return;
    }

    setSelectedScenarioId(nextScenario.scenarioId);
  };

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
                  <SelectItemText>Scenario {index + 1}</SelectItemText>
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

      <div className="flex-1 min-h-0 w-full">
        {selectedScenario ? (
          <section className="flex h-full min-h-0 w-full items-center justify-center p-3">
            <SidebySideArt
              key={selectedScenario.scenarioId}
              contents={[
                <ScenarioModel key={`${selectedScenario.scenarioId}-model`} scenario={selectedScenario} />,
                <ScenarioDrawing key={`${selectedScenario.scenarioId}-draw`} scenario={selectedScenario} />,
              ]}
            />
          </section>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No scenarios found
          </div>
        )}

        {showHotkeys ? (
          <div className="mt-3 flex justify-center">
            <KeyBindings />
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-0 right-0 z-[100]">
        <ScenarioAdder />
      </div>
    </div>
  );
};
