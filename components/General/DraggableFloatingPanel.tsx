/** @format */
"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

const POSITION_STORAGE_PREFIX = "css-artist:draggable-float:";

function loadStoredPosition(
  key: string | undefined,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function persistPosition(key: string | undefined, pos: { x: number; y: number }) {
  if (!key || typeof window === "undefined") return;
  try {
    localStorage.setItem(POSITION_STORAGE_PREFIX + key, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

export type DraggableFloatingPanelProps = {
  children: ReactNode;
  showOnHover?: boolean;
  /** Persists position in localStorage so it survives hover unmount (same as diff/model bar). */
  storageKey?: string;
  defaultPosition?: { x: number; y: number };
  className?: string;
  /** True after the pointer moved past the drag threshold (used to avoid accidental clicks). */
  onDragStateChange?: (dragStarted: boolean) => void;
};

function measurePanelSize(el: HTMLElement | null): { width: number; height: number } {
  if (!el) {
    return { width: 120, height: 50 };
  }
  return { width: el.offsetWidth, height: el.offsetHeight };
}

export function DraggableFloatingPanel({
  children,
  showOnHover = true,
  storageKey,
  defaultPosition = { x: -16, y: 16 },
  className = "",
  onDragStateChange,
}: DraggableFloatingPanelProps) {
  const fallbackRef = useRef(defaultPosition);
  fallbackRef.current = defaultPosition;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(!showOnHover);
  const [dragStarted, setDragStarted] = useState(false);
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
  const [actualPosition, setActualPosition] = useState(() =>
    loadStoredPosition(storageKey, fallbackRef.current),
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const lastDragPosition = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setActualPosition(loadStoredPosition(storageKey, fallbackRef.current));
  }, [storageKey]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !panelRef.current) return;

    const container = panelRef.current.parentElement;
    if (!container) return;

    const deltaX = Math.abs(e.clientX - mouseDownPos.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.y);
    const dragThreshold = 5;

    if (deltaX > dragThreshold || deltaY > dragThreshold) {
      if (!dragStarted) {
        setDragStarted(true);
        onDragStateChange?.(true);
      }
    }

    const containerRect = container.getBoundingClientRect();
    let newX = e.clientX - containerRect.left - dragOffset.x;
    let newY = e.clientY - containerRect.top - dragOffset.y;

    const padding = 8;
    const { width: panelWidth, height: panelHeight } = measurePanelSize(panelRef.current);
    newX = Math.max(padding, Math.min(newX, containerRect.width - panelWidth - padding));
    newY = Math.max(padding, Math.min(newY, containerRect.height - panelHeight - padding));

    const newPosition = { x: newX, y: newY };
    lastDragPosition.current = newPosition;
    setActualPosition(newPosition);
  };

  const handleMouseUp = () => {
    const wasDragging = dragStarted;
    setIsDragging(false);

    setTimeout(() => {
      setDragStarted(false);
      onDragStateChange?.(false);
    }, 10);

    if (wasDragging) {
      const positionToSave = lastDragPosition.current || actualPosition;
      persistPosition(storageKey, positionToSave);
      lastDragPosition.current = null;
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  useEffect(() => {
    if (panelRef.current) {
      containerRef.current = panelRef.current.parentElement;
    }

    if (showOnHover && containerRef.current) {
      const handleMouseEnter = () => setIsVisible(true);
      const handleMouseLeave = () => {
        if (!isDragging) {
          setIsVisible(false);
        }
      };

      const container = containerRef.current;
      container.addEventListener("mouseenter", handleMouseEnter);
      container.addEventListener("mouseleave", handleMouseLeave);

      return () => {
        container.removeEventListener("mouseenter", handleMouseEnter);
        container.removeEventListener("mouseleave", handleMouseLeave);
      };
    } else {
      setIsVisible(true);
    }
  }, [showOnHover, isDragging]);

  return (
    <div
      ref={panelRef}
      className={`absolute z-50 cursor-move select-none transition-opacity duration-200 ${
        isDragging ? "cursor-grabbing" : ""
      } ${isVisible ? "opacity-100" : "opacity-0"} ${className}`}
      style={{
        left: `${actualPosition.x}px`,
        top: `${actualPosition.y}px`,
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {children}
    </div>
  );
}
