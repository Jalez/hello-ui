/** @format */
"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DraggableFloatingPanel } from "@/components/General/DraggableFloatingPanel";

export type DiffModelToggleContentProps = {
  leftLabel: string;
  rightLabel: string;
  checked: boolean;
  onCheckedChange: () => void;
  /** From parent DraggableFloatingPanel onDragStateChange — avoids toggling while dragging. */
  dragStarted: boolean;
};

/** Diff / model switch row only (no drag wrapper). Use inside a shared `DraggableFloatingPanel` with `onDragStateChange`. */
export function DiffModelToggleContent({
  leftLabel,
  rightLabel,
  checked,
  onCheckedChange,
  dragStarted,
}: DiffModelToggleContentProps) {
  const handleSwitchChange = (nextChecked: boolean) => {
    if (!dragStarted) {
      onCheckedChange();
    }
  };

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!dragStarted) {
      onCheckedChange();
    }
  };

  return (
    <div className="flex flex-row items-center gap-3">
      <Label
        className="cursor-pointer select-none text-sm font-medium text-foreground"
        onClick={handleLabelClick}
      >
        {leftLabel}
      </Label>
      <Switch checked={checked} onCheckedChange={handleSwitchChange} />
      <Label
        className="cursor-pointer select-none text-sm font-medium text-foreground"
        onClick={handleLabelClick}
      >
        {rightLabel}
      </Label>
    </div>
  );
}

interface FloatingActionButtonProps {
  leftLabel: string;
  rightLabel: string;
  checked: boolean;
  onCheckedChange: () => void;
  tooltip?: string;
  showOnHover?: boolean;
  storageKey?: string;
}

export const FloatingActionButton = ({
  leftLabel,
  rightLabel,
  checked,
  onCheckedChange,
  tooltip,
  showOnHover = true,
  storageKey,
}: FloatingActionButtonProps) => {
  void tooltip;
  const [dragStarted, setDragStarted] = useState(false);

  return (
    <DraggableFloatingPanel
      showOnHover={showOnHover}
      storageKey={storageKey}
      defaultPosition={{ x: -16, y: 16 }}
      onDragStateChange={setDragStarted}
    >
      <div className="rounded-lg border border-border/60 bg-background/85 p-3 text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-background/95">
        <DiffModelToggleContent
          dragStarted={dragStarted}
          leftLabel={leftLabel}
          rightLabel={rightLabel}
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>
    </DraggableFloatingPanel>
  );
};
