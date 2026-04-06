'use client';

import { cloneElement, isValidElement, ReactNode, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type SidebySideArtProps = {
  contents: ReactNode[];
};

type LayoutMode = "row" | "column" | "single";

const BOARD_BORDER_CHROME = 10;
const BOARD_VERTICAL_CHROME = 20;
const LAYOUT_GAP = 16;
const LAYOUT_PADDING_X = 16;
const LAYOUT_PADDING_Y = 16;
const SINGLE_LAYOUT_CONTROLS_HEIGHT = 56;

function getScenarioDimensions(content: ReactNode): { width: number; height: number } | null {
  if (!isValidElement<{ scenario?: { dimensions?: { width?: number; height?: number } } }>(content)) {
    return null;
  }

  const width = content.props.scenario?.dimensions?.width;
  const height = content.props.scenario?.dimensions?.height;
  if (typeof width !== "number" || typeof height !== "number") {
    return null;
  }

  return {
    width: width + BOARD_BORDER_CHROME,
    height: height + BOARD_VERTICAL_CHROME,
  };
}

const withScalingPreference = (
  content: ReactNode,
  opts: {
    allowScaling: boolean;
    registerForNavbarCapture: boolean;
    suppressHeavyLayoutEffects: boolean;
  },
) => {
  if (
    !isValidElement<{
      allowScaling?: boolean;
      registerForNavbarCapture?: boolean;
      suppressHeavyLayoutEffects?: boolean;
    }>(content)
  ) {
    return content;
  }

  return cloneElement(content, {
    allowScaling: opts.allowScaling,
    registerForNavbarCapture: opts.registerForNavbarCapture,
    suppressHeavyLayoutEffects: opts.suppressHeavyLayoutEffects,
  });
};

const SidebySideArt = ({ contents }: SidebySideArtProps): ReactNode => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("row");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const maxIndex = Math.max(contents.length - 1, 0);
  const visibleIndex = Math.min(activeIndex, maxIndex);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const dimensions = contents.map(getScenarioDimensions);
    const canMeasureAllBoards = dimensions.every((value) => value !== null);

    const updateLayoutMode = () => {
      if (!canMeasureAllBoards) {
        setLayoutMode("row");
        return;
      }

      const sizes = dimensions as { width: number; height: number }[];
      const availableWidth = Math.max(0, container.clientWidth - LAYOUT_PADDING_X);
      const availableHeight = Math.max(0, container.clientHeight - LAYOUT_PADDING_Y);

      const totalRowWidth =
        sizes.reduce((sum, size) => sum + size.width, 0) + LAYOUT_GAP * Math.max(0, sizes.length - 1);
      const maxRowHeight = sizes.reduce((max, size) => Math.max(max, size.height), 0);

      const totalColumnHeight =
        sizes.reduce((sum, size) => sum + size.height, 0) + LAYOUT_GAP * Math.max(0, sizes.length - 1);
      const maxColumnWidth = sizes.reduce((max, size) => Math.max(max, size.width), 0);

      const rowFits = totalRowWidth <= availableWidth && maxRowHeight <= availableHeight;
      const columnFits =
        maxColumnWidth <= availableWidth
        && totalColumnHeight <= Math.max(0, availableHeight - SINGLE_LAYOUT_CONTROLS_HEIGHT);

      setLayoutMode(rowFits ? "row" : columnFits ? "column" : "single");
    };

    updateLayoutMode();

    let frameId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateLayoutMode();
      });
    });

    observer.observe(container);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      observer.disconnect();
    };
  }, [contents]);

  const goPrevious = () => {
    setActiveIndex((current) => Math.max(current - 1, 0));
  };

  const goNext = () => {
    setActiveIndex((current) => Math.min(current + 1, contents.length - 1));
  };

  const renderRowOrColumn = (direction: "row" | "column") => (
    <div
      className={`flex h-full w-full min-h-0 items-stretch justify-center gap-4 px-2 py-2 ${
        direction === "row" ? "flex-row" : "flex-col"
      }`}
    >
      {contents.map((content, index) => (
        <div
          key={`sidebyside-${direction}-${index}`}
          className={
            direction === "row"
              ? "flex min-w-0 flex-1 items-start justify-center"
              : "flex min-h-0 w-full flex-1 items-start justify-center"
          }
        >
          {withScalingPreference(content, {
            allowScaling: false,
            registerForNavbarCapture: true,
            suppressHeavyLayoutEffects: false,
          })}
        </div>
      ))}
    </div>
  );

  const renderSingle = () => (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-start gap-3">
      {contents.length > 1 ? (
        <div className="flex w-full max-w-sm flex-none items-center justify-between gap-2 px-3">
          <Button
            type="button"
            variant="ghost"
            onClick={goPrevious}
            disabled={visibleIndex === 0}
            className="h-auto min-w-[88px] flex-1 rounded-md px-3 py-2 text-foreground hover:bg-muted/70 disabled:opacity-35"
            aria-label="Show previous board"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            <span className="text-sm font-medium">Prev</span>
          </Button>

          <div className="shrink-0 rounded-md px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {visibleIndex + 1} / {contents.length}
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={goNext}
            disabled={visibleIndex === maxIndex}
            className="h-auto min-w-[88px] flex-1 rounded-md px-3 py-2 text-foreground hover:bg-muted/70 disabled:opacity-35"
            aria-label="Show next board"
          >
            <span className="text-sm font-medium">Next</span>
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 w-full items-center justify-center overflow-hidden">
        <div
          className="flex h-full min-h-0 w-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${visibleIndex * 100}%)` }}
        >
          {contents.map((content, index) => (
            <div
              key={`mobile-sidebyside-${index}`}
              className="flex h-full min-h-0 min-w-full items-center justify-center"
            >
              {withScalingPreference(content, {
                allowScaling: true,
                registerForNavbarCapture: index === visibleIndex,
                // Keep both artboards fully alive in single-board carousel mode so
                // step replay, comparison, and accuracy updates continue even when
                // only one board is currently visible on screen.
                suppressHeavyLayoutEffects: false,
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full min-h-0 flex-col items-center justify-center gap-3"
    >
      {layoutMode === "single"
        ? renderSingle()
        : layoutMode === "column"
          ? renderRowOrColumn("column")
          : renderRowOrColumn("row")}
    </div>
  );
};

export default SidebySideArt;
