'use client';

import { Button } from "@/components/ui/button";
import PoppingTitle from "../General/PoppingTitle";
import { Plus, Loader2 } from "lucide-react";
import { useNewLevel } from "./hooks/useNewLevel";

const NewLevel = () => {
  const { handleNewLevelCreation, isCreating } = useNewLevel();

  return (
    <div className="flex flex-col justify-center items-center">
      <PoppingTitle topTitle="Create Level">
        <Button onClick={handleNewLevelCreation} variant="ghost" size="icon" disabled={isCreating}>
          {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        </Button>
      </PoppingTitle>
    </div>
  );
};

export default NewLevel;
