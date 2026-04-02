"use client";

import * as React from "react";
import { ChevronLeft, ChevronUp, Code2 } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof Group>) => (
  <Group
    className={cn(
      "flex h-full w-full data-[orientation=vertical]:flex-col",
      className,
    )}
    {...props}
  />
);

const ResizablePanel = Panel;

const ResizableHandle = ({
  className,
  withHandle = false,
  groupOrientation = "horizontal",
  isPanelCollapsed = false,
  onTogglePanel,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
  groupOrientation?: "horizontal" | "vertical";
  isPanelCollapsed?: boolean;
  onTogglePanel?: () => void;
}) => (
  <Separator
    className={cn(
      "relative flex shrink-0 items-center justify-center bg-border/70 transition-colors hover:bg-border/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      groupOrientation === "horizontal"
        ? "h-full w-px cursor-col-resize"
        : "h-px w-full cursor-row-resize",
      className,
    )}
    {...props}
  >
    {withHandle ? (
      <div
        className={cn(
          "pointer-events-none z-10 flex items-center justify-center rounded-full border border-border/70 bg-border/70 shadow-sm",
          groupOrientation === "horizontal" ? "h-10 w-5" : "h-5 w-10",
        )}
      >
        <div
          className={cn(
            "rounded-full bg-border/70",
            groupOrientation === "horizontal" ? "h-6 w-px" : "h-px w-6",
          )}
        />
        {onTogglePanel ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "pointer-events-auto absolute rounded-full border border-transparent bg-transparent text-muted-foreground shadow-none hover:border-border/60 hover:bg-muted/40 hover:text-foreground",
              "h-6 w-6",
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePanel();
            }}
            aria-label={isPanelCollapsed ? "Open editor" : "Close editor"}
            title={isPanelCollapsed ? "Open editor" : "Close editor"}
          >
            {isPanelCollapsed ? (
              <Code2 className="h-4 w-4" />
            ) : groupOrientation === "horizontal" ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        ) : null}
      </div>
    ) : null}
  </Separator>
);

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
