'use client';

import { useCallback, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { updatePointsThresholds } from "@/store/slices/levels.slice";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import InfoBox from "./InfoBox";

type PointsThreshold = { accuracy: number; pointsPercent: number };

const DEFAULT_THRESHOLDS: PointsThreshold[] = [
  { accuracy: 70, pointsPercent: 25 },
  { accuracy: 85, pointsPercent: 60 },
  { accuracy: 95, pointsPercent: 100 },
];

export const ThresholdsEditor = () => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const [open, setOpen] = useState(false);
  const [draftThresholds, setDraftThresholds] = useState<PointsThreshold[]>(DEFAULT_THRESHOLDS);
  const thresholds = level?.pointsThresholds ?? DEFAULT_THRESHOLDS;
  const sorted = useMemo(
    () => [...thresholds].sort((a, b) => a.accuracy - b.accuracy),
    [thresholds],
  );
  const sortedDraft = useMemo(
    () => [...draftThresholds].sort((a, b) => a.accuracy - b.accuracy),
    [draftThresholds],
  );
  const isDirty = JSON.stringify(sortedDraft) !== JSON.stringify(sorted);
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setDraftThresholds(sorted);
    }
  }, [sorted]);

  if (!level) return null;

  const normalizeValue = (value: string) => Math.min(100, Math.max(0, Number(value)));

  const updateDraft = (updated: PointsThreshold[]) => {
    setDraftThresholds(updated);
  };

  const handleChange = (
    index: number,
    field: "accuracy" | "pointsPercent",
    value: string
  ) => {
    const next = sortedDraft.map((t, i) =>
      i === index ? { ...t, [field]: normalizeValue(value) } : t
    );
    updateDraft(next);
  };

  const handleAdd = () => {
    updateDraft([...sortedDraft, { accuracy: 100, pointsPercent: 100 }]);
  };

  const handleRemove = (index: number) => {
    updateDraft(sortedDraft.filter((_, i) => i !== index));
  };

  const handleCancel = () => {
    setDraftThresholds(sorted);
    setOpen(false);
  };

  const handleSubmit = () => {
    if (!isDirty) {
      setOpen(false);
      return;
    }

    dispatch(updatePointsThresholds({ levelId: currentLevel, thresholds: sortedDraft }));
    setOpen(false);
  };

  return (
    <InfoBox>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-70 transition-opacity text-sm font-semibold text-primary">
            Thresholds
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4 space-y-3" align="center" side="top">
          <p className="text-sm font-semibold">Points Thresholds</p>
          <p className="text-xs text-muted-foreground">
            Reach accuracy % to earn that % of max points.
          </p>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-2 gap-y-0.5 items-center text-xs text-muted-foreground px-1">
              <span>Accuracy %</span>
              <span />
              <span>Points %</span>
              <span />
            </div>
            {sortedDraft.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-2 items-center">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={t.accuracy}
                  onChange={(e) => handleChange(i, "accuracy", e.target.value)}
                  className="h-9 text-sm"
                />
                <span className="text-muted-foreground text-sm">→</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={t.pointsPercent}
                  onChange={(e) => handleChange(i, "pointsPercent", e.target.value)}
                  className="h-9 text-sm"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0"
                  onClick={() => handleRemove(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4 mr-1" /> Add threshold
          </Button>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={!isDirty}
              onClick={handleSubmit}
            >
              Save thresholds
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </InfoBox>
  );
};
