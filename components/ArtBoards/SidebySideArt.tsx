'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type SidebySideArtProps = {
  contents: ReactNode[];
};

const SidebySideArt = ({ contents }: SidebySideArtProps): ReactNode => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (contents.length === 0) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((current) => Math.min(current, contents.length - 1));
  }, [contents.length]);

  const goPrevious = () => {
    setActiveIndex((current) => Math.max(current - 1, 0));
  };

  const goNext = () => {
    setActiveIndex((current) => Math.min(current + 1, contents.length - 1));
  };

  return (
    <>
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 sm:hidden">
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
          <div
            className="flex h-full w-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
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
              disabled={activeIndex === 0}
              className="h-auto min-w-[88px] flex-1 rounded-md px-3 py-2 text-foreground hover:bg-muted/70 disabled:opacity-35"
              aria-label="Show previous board"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              <span className="text-sm font-medium">Prev</span>
            </Button>

            <div className="shrink-0 rounded-md px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {activeIndex + 1} / {contents.length}
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={goNext}
              disabled={activeIndex === contents.length - 1}
              className="h-auto min-w-[88px] flex-1 rounded-md px-3 py-2 text-foreground hover:bg-muted/70 disabled:opacity-35"
              aria-label="Show next board"
            >
              <span className="text-sm font-medium">Next</span>
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="hidden h-full w-full flex-row flex-wrap items-center justify-center sm:flex">
        {contents.map((content, index) => (
          <div
            key={`sidebyside-${index}`}
            className={cn("shrink-0", index > 0 && "sm:ml-4")}
          >
            {content}
          </div>
        ))}
      </div>
    </>
  );
};

export default SidebySideArt;
