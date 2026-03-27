'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ARTBOARD_STACK_BREAKPOINT = 640;
const ARTBOARD_SIDE_BY_SIDE_REENTRY_BREAKPOINT = 760;

type SidebySideArtProps = {
  contents: ReactNode[];
};

const SidebySideArt = ({ contents }: SidebySideArtProps): ReactNode => {
  const [activeIndex, setActiveIndex] = useState(0);
  const getIsCompactLayoutForWidth = useCallback((width: number, previousIsCompact?: boolean) => {
    if (typeof previousIsCompact === "boolean") {
      if (previousIsCompact) {
        return width < ARTBOARD_SIDE_BY_SIDE_REENTRY_BREAKPOINT;
      }

      return width < ARTBOARD_STACK_BREAKPOINT;
    }

    return width < ARTBOARD_SIDE_BY_SIDE_REENTRY_BREAKPOINT;
  }, []);
  const [isCompactLayout, setIsCompactLayout] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return getIsCompactLayoutForWidth(window.innerWidth);
  });

  useEffect(() => {
    const handleResize = () => {
      setIsCompactLayout((previousIsCompact) => {
        const nextIsCompact = getIsCompactLayoutForWidth(window.innerWidth, previousIsCompact);
        return previousIsCompact === nextIsCompact ? previousIsCompact : nextIsCompact;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [getIsCompactLayoutForWidth]);

  const maxIndex = Math.max(contents.length - 1, 0);
  const visibleIndex = Math.min(activeIndex, maxIndex);

  const goPrevious = () => {
    setActiveIndex((current) => Math.max(current - 1, 0));
  };

  const goNext = () => {
    setActiveIndex((current) => Math.min(current + 1, contents.length - 1));
  };

  return (
    <>
      <div className={isCompactLayout ? "flex h-full w-full flex-col items-center justify-center gap-3" : "hidden"}>
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
                {content}
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

      <div className={isCompactLayout ? "hidden" : "flex h-full w-full flex-row flex-wrap items-center justify-center gap-4"}>
        {contents.map((content, index) => (
          <div
            key={`sidebyside-${index}`}
            className="shrink-0"
          >
            {content}
          </div>
        ))}
      </div>
    </>
  );
};

export default SidebySideArt;
