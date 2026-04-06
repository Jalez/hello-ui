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
      "relative z-20 flex shrink-0 items-center justify-center bg-border/60 transition-colors",
      "hover:bg-border/80 data-[separator=hover]:bg-border/80 data-[separator=active]:bg-border",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border/70 focus-visible:ring-offset-0",
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
          "pointer-events-none z-30 flex items-center justify-center rounded-full border border-border/60 bg-background/90 shadow-sm backdrop-blur-sm",
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
              "pointer-events-auto absolute rounded-full border border-transparent bg-transparent text-muted-foreground shadow-none",
              "z-40",
              "hover:border-border/60 hover:bg-muted/40 hover:text-foreground",
              "focus-visible:ring-1 focus-visible:ring-border/70 focus-visible:ring-offset-0",
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
