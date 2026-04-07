'use client';

import { useEffect, useRef, useState } from "react";

const BOARD_BORDER_CHROME = 10;
const BOARD_VERTICAL_MARGIN_CHROME = 10;

interface BoardContainerProps {
  width: number;
  height?: number;
  allowScaling?: boolean;
  children?: React.ReactNode;
}

export const BoardContainer = ({
  width,
  height,
  allowScaling = false,
  children,
}: BoardContainerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!allowScaling) {
      return;
    }

    const container = containerRef.current;

    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateContainerSize = () => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;
      setContainerSize((currentValue) => (
        currentValue.width === nextWidth && currentValue.height === nextHeight
          ? currentValue
          : { width: nextWidth, height: nextHeight }
      ));
    };

    updateContainerSize();

    let frameId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateContainerSize();
      });
    });

    observer.observe(container);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      observer.disconnect();
    };
  }, [allowScaling, height, width]);

  const naturalWidth = width + BOARD_BORDER_CHROME;
  const naturalHeight = (height ?? 0) + BOARD_BORDER_CHROME + BOARD_VERTICAL_MARGIN_CHROME;
  const widthScale = allowScaling && containerSize.width > 0 && naturalWidth > 0
    ? containerSize.width / naturalWidth
    : 1;
  const heightScale = allowScaling && containerSize.height > 0 && naturalHeight > 0
    ? containerSize.height / naturalHeight
    : 1;
  const scale = allowScaling ? Math.min(1, widthScale, heightScale) : 1;
  const scaledWidth = naturalWidth * scale;
  const scaledHeight = naturalHeight > 0 ? naturalHeight * scale : height;

  if (!allowScaling) {
    return (
      <div
        ref={containerRef}
        className="flex h-full w-full min-h-0 justify-center items-center"
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full min-h-0 justify-center items-center"
    >
      <div
        className="relative"
        style={{
          width: `${scaledWidth}px`,
          height: scaledHeight ? `${scaledHeight}px` : undefined,
        }}
      >
        <div
          className="absolute left-1/2 top-0"
          style={{
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
