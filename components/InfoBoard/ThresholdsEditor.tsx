'use client';

import { useCallback, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { updatePointsThresholds } from "@/store/slices/levels.slice";
import { recalculateLevelPoints } from "@/store/slices/points.slice";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import InfoBox from "./InfoBox";

type PointsThreshold = { accuracy: number; pointsPercent: number };

const DEFAULT_THRESHOLDS: PointsThreshold[] = [
  { accuracy: 70, pointsPercent: 25 },
  { accuracy: 85, pointsPercent: 60 },
  { accuracy: 95, pointsPercent: 100 },
];

type EditorMode = "form" | "json";
type ThresholdValidationResult =
  | { ok: true; thresholds: PointsThreshold[] }
  | { ok: false; error: string };

function sortThresholds(thresholds: PointsThreshold[]) {
  return [...thresholds].sort((a, b) => a.accuracy - b.accuracy);
}

function validateThresholds(value: unknown): ThresholdValidationResult {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Threshold JSON must be an array." };
  }

  const thresholds = value.map((entry) => ({
    accuracy: Number((entry as PointsThreshold)?.accuracy),
    pointsPercent: Number((entry as PointsThreshold)?.pointsPercent),
  }));

  if (thresholds.length === 0) {
    return { ok: false, error: "At least one threshold is required." };
  }

  for (const threshold of thresholds) {
    if (!Number.isFinite(threshold.accuracy) || !Number.isFinite(threshold.pointsPercent)) {
      return { ok: false, error: "Every threshold must include numeric accuracy and pointsPercent values." };
    }
    if (threshold.accuracy < 0 || threshold.accuracy > 100 || threshold.pointsPercent < 0 || threshold.pointsPercent > 100) {
      return { ok: false, error: "Accuracy and pointsPercent must be between 0 and 100." };
    }
  }

  const sorted = sortThresholds(thresholds);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].accuracy <= sorted[index - 1].accuracy) {
      return { ok: false, error: "Accuracy values must be strictly increasing." };
    }
    if (sorted[index].pointsPercent < sorted[index - 1].pointsPercent) {
      return { ok: false, error: "pointsPercent must stay aligned with accuracy and never decrease as accuracy increases." };
    }
  }

  return { ok: true, thresholds: sorted };
}

function formatThresholdsJson(thresholds: PointsThreshold[]) {
  return JSON.stringify(sortThresholds(thresholds), null, 2);
}

export const ThresholdsEditor = () => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<EditorMode>("form");
  const [draftThresholds, setDraftThresholds] = useState<PointsThreshold[]>(DEFAULT_THRESHOLDS);
  const [jsonDraft, setJsonDraft] = useState(formatThresholdsJson(DEFAULT_THRESHOLDS));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const thresholds = level?.pointsThresholds ?? DEFAULT_THRESHOLDS;
  const sorted = useMemo(
    () => sortThresholds(thresholds),
    [thresholds],
  );
  const sortedDraft = useMemo(
    () => sortThresholds(draftThresholds),
    [draftThresholds],
  );
  const isDirty = JSON.stringify(sortedDraft) !== JSON.stringify(sorted);
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setMode("form");
      setDraftThresholds(sorted);
      setJsonDraft(formatThresholdsJson(sorted));
      setJsonError(null);
    }
  }, [sorted]);
  const parseJsonDraft = useCallback((): ThresholdValidationResult => {
    try {
      const parsed = JSON.parse(jsonDraft);
      return validateThresholds(parsed);
    } catch {
      return { ok: false as const, error: "Threshold JSON is not valid JSON." };
    }
  }, [jsonDraft]);
  const handleModeChange = useCallback((nextMode: EditorMode) => {
    if (nextMode === mode) {
      return;
    }

    if (nextMode === "json") {
      setJsonDraft(formatThresholdsJson(sortedDraft));
      setJsonError(null);
      setMode("json");
      return;
    }

    const result = parseJsonDraft();
    if (result.ok === false) {
      setJsonError(result.error);
      return;
    }

    setDraftThresholds(result.thresholds);
    setJsonDraft(formatThresholdsJson(result.thresholds));
    setJsonError(null);
    setMode("form");
  }, [mode, parseJsonDraft, sortedDraft]);

  if (!level) return null;

  const normalizeValue = (value: string) => Math.min(100, Math.max(0, Number(value)));

  const updateDraft = (updated: PointsThreshold[]) => {
    setDraftThresholds(updated);
    setJsonDraft(formatThresholdsJson(updated));
    setJsonError(null);
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
    setMode("form");
    setDraftThresholds(sorted);
    setJsonDraft(formatThresholdsJson(sorted));
    setJsonError(null);
    setOpen(false);
  };

  const handleSubmit = () => {
    const nextThresholds =
      mode === "json"
        ? (() => {
            const result = parseJsonDraft();
            if (result.ok === false) {
              setJsonError(result.error);
              return null;
            }
            setJsonError(null);
            return result.thresholds;
          })()
        : sortedDraft;

    if (!nextThresholds) {
      return;
    }

    if (JSON.stringify(nextThresholds) === JSON.stringify(sorted)) {
      setOpen(false);
      return;
    }

    dispatch(updatePointsThresholds({ levelId: currentLevel, thresholds: nextThresholds }));
    dispatch(
      recalculateLevelPoints({
        level: {
          ...level,
          pointsThresholds: nextThresholds,
          percentageTreshold: nextThresholds[0]?.accuracy ?? level.percentageTreshold,
          percentageFullPointsTreshold:
            nextThresholds[nextThresholds.length - 1]?.accuracy ?? level.percentageFullPointsTreshold,
        },
      }),
    );
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "form" ? "default" : "outline"}
              className="flex-1"
              onClick={() => handleModeChange("form")}
            >
              Form
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "json" ? "default" : "outline"}
              className="flex-1"
              onClick={() => handleModeChange("json")}
            >
              JSON
            </Button>
          </div>
          {mode === "json" ? (
            <div className="space-y-2">
              <Textarea
                value={jsonDraft}
                onChange={(event) => {
                  setJsonDraft(event.target.value);
                  if (jsonError) {
                    setJsonError(null);
                  }
                }}
                className="min-h-56 font-mono text-xs"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                Array of objects: <code>{formatThresholdsJson([{ accuracy: 70, pointsPercent: 25 }])}</code>
              </p>
              {jsonError && (
                <p className="text-xs text-destructive">{jsonError}</p>
              )}
            </div>
          ) : (
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
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleAdd}
              >
                <Plus className="h-4 w-4 mr-1" /> Add threshold
              </Button>
            </div>
          )}
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
              disabled={mode === "form" ? !isDirty : false}
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
