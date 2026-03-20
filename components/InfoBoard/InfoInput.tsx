'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useState } from "react";
import { Check } from "lucide-react";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";

interface InputProps {
  actionToDispatch: any;
  reduxState: string;
  dataType?: string;
  finishEditHandler?: () => void;
  /** After dispatch, sync these level fields to collaborators (0-based index derived from current level). */
  levelMetaSyncFields?: string[];
}

const InfoInput = ({
  reduxState,
  actionToDispatch,
  dataType,
  finishEditHandler,
  levelMetaSyncFields,
}: InputProps) => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const detail = useAppSelector(
    (state: any) => state.levels[currentLevel - 1][reduxState]
  );
  const [value, setValue] = useState(detail);

  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();
  const handleChange = (e: any) => {
    setValue(e.target.value);
  };

  const handleUpdate = () => {
    dispatch(actionToDispatch({ levelId: currentLevel, text: value }));
    if (levelMetaSyncFields?.length) {
      syncLevelFields(currentLevel - 1, levelMetaSyncFields);
    }
    finishEditHandler && finishEditHandler();
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleUpdate();
      }}
      className="w-full flex flex-row justify-center items-center m-0 p-0"
    >
      <Input
        className="text-primary w-10"
        type={dataType}
        value={value}
        onChange={handleChange}
      />
      <Button type="submit" size="icon" variant="ghost" onClick={handleUpdate}>
        <Check className="h-4 w-4" />
      </Button>
    </form>
  );
};

export default InfoInput;
