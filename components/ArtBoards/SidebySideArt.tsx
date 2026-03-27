'use client';

import { cloneElement, isValidElement, ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type SidebySideArtProps = {
  contents: ReactNode[];
};

type LayoutMode = "row" | "column" | "single";

const hasOverflow = (element: HTMLDivElement | null): boolean => {
  if (!element) {
    return false;
  }

  return (
    element.scrollWidth > element.clientWidth
    || element.scrollHeight > element.clientHeight
  );
};

const withScalingPreference = (content: ReactNode, allowScaling: boolean) => {
  if (!isValidElement<{ allowScaling?: boolean }>(content)) {
    return content;
  }

  return cloneElement(content, {
    allowScaling,
  });
};

const SidebySideArt = ({ contents }: SidebySideArtProps): ReactNode => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("row");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowProbeRef = useRef<HTMLDivElement | null>(null);
  const columnProbeRef = useRef<HTMLDivElement | null>(null);

  const maxIndex = Math.max(contents.length - 1, 0);
  const visibleIndex = Math.min(activeIndex, maxIndex);

  const goPrevious = () => {
    setActiveIndex((current) => Math.max(current - 1, 0));
  };

  const goNext = () => {
    setActiveIndex((current) => Math.min(current + 1, contents.length - 1));
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateLayoutMode = () => {
      const rowOverflows = hasOverflow(rowProbeRef.current);
      const columnOverflows = hasOverflow(columnProbeRef.current);

      const nextLayoutMode: LayoutMode = !rowOverflows
        ? "row"
        : !columnOverflows
          ? "column"
          : "single";

      setLayoutMode((currentValue) => (
        currentValue === nextLayoutMode ? currentValue : nextLayoutMode
      ));
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
    if (rowProbeRef.current) {
      observer.observe(rowProbeRef.current);
    }
    if (columnProbeRef.current) {
      observer.observe(columnProbeRef.current);
    }

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      observer.disconnect();
    };
  }, [contents.length]);

  const dualItems = (direction: "row" | "column", probe = false) => (
    <div
      className={`flex h-full w-full min-h-0 items-stretch justify-center gap-4 px-2 py-2 ${
        direction === "row" ? "flex-row" : "flex-col"
      }`}
    >
      {contents.map((content, index) => (
        <div
          key={`${probe ? "probe" : "visible"}-${direction}-${index}`}
          className={
            direction === "row"
              ? "flex min-w-0 flex-1 items-start justify-center"
              : "flex min-h-0 w-full flex-1 items-start justify-center"
          }
        >
          {withScalingPreference(content, false)}
        </div>
      ))}
    </div>
  );

  return (
    <div ref={containerRef} className="relative flex h-full w-full min-h-0 flex-col items-center justify-center gap-3">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[-1] overflow-hidden opacity-0"
      >
        <div ref={rowProbeRef} className="h-full w-full overflow-hidden">
          {dualItems("row", true)}
        </div>
        <div ref={columnProbeRef} className="h-full w-full overflow-hidden">
          {dualItems("column", true)}
        </div>
      </div>

      <div className={layoutMode === "single" ? "flex h-full w-full flex-col items-center justify-center gap-3" : "hidden"}>
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
          <div
            className="flex h-full w-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${visibleIndex * 100}%)` }}
          >
            {contents.map((content, index) => (
              <div
                key={`mobile-sidebyside-${index}`}
                className="flex h-full min-w-full items-center justify-center"
              >
                {withScalingPreference(content, true)}
              </div>
            ))}
          </div>
        </div>

        {contents.length > 1 ? (
          <div className="flex w-full max-w-sm items-center justify-between gap-2 px-3">
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
      </div>

      <div className={layoutMode === "row" ? "flex h-full w-full min-h-0" : "hidden"}>
        {dualItems("row")}
      </div>

      <div className={layoutMode === "column" ? "flex h-full w-full min-h-0" : "hidden"}>
        {dualItems("column")}
      </div>
    </div>
  );
};

export default SidebySideArt;
