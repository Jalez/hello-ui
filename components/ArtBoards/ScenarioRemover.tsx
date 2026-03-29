'use client';

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { removeScenario } from "@/store/slices/levels.slice";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";

type ScenarioRemoverProps = {
  scenarioId: string | null;
  /** When false, at least one scenario must remain. */
  canRemove: boolean;
};

const ScenarioRemover = ({ scenarioId, canRemove }: ScenarioRemoverProps) => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const { syncLevelFields } = useLevelMetaSync();

  if (!isCreator) return null;

  const handleRemove = () => {
    if (!scenarioId || !canRemove) return;
    dispatch(removeScenario({ levelId: currentLevel, scenarioId }));
    syncLevelFields(currentLevel - 1, ["scenarios"]);
  };

  return (
    <PoppingTitle topTitle={canRemove ? "Remove scenario" : "At least one scenario is required"}>
      <Button
        onClick={handleRemove}
        variant="ghost"
        size="icon"
        disabled={!scenarioId || !canRemove}
        className="text-destructive hover:text-destructive disabled:opacity-40"
      >
        <Trash2 className="h-5 w-5" />
      </Button>
    </PoppingTitle>
  );
};

export default ScenarioRemover;
