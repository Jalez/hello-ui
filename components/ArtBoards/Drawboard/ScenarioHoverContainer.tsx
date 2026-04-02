'use client';

import { useState, useEffect, useRef, ReactNode } from "react";

type ScenarioHoverContainerProps = {
  children: ReactNode;
  onShowChange?: (show: boolean) => void;
  enabled?: boolean;
};

export const ScenarioHoverContainer = ({
  children,
  onShowChange,
  enabled = true,
}: ScenarioHoverContainerProps) => {
  const [showContent, setShowContent] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) {
      setShowContent(false);
      onShowChange?.(false);
    }
  }, [enabled, onShowChange]);

  useEffect(() => {
    if (!enabled) return;

    const parent = wrapperRef.current?.parentElement;
    if (!parent) return;

    const handleMouseEnter = () => {
      setShowContent(true);
      onShowChange?.(true);
    };
    
    const handleMouseLeave = (e: MouseEvent) => {
      // Don't hide if mouse is leaving to the content itself
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget?.closest('[data-scenario-hover-content]')) {
        return;
      }
      // Don't hide if mouse is still within the parent container
      if (relatedTarget && parent.contains(relatedTarget)) {
        return;
      }
      setShowContent(false);
      onShowChange?.(false);
    };

    parent.addEventListener('mouseenter', handleMouseEnter);
    parent.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      parent.removeEventListener('mouseenter', handleMouseEnter);
      parent.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [enabled, onShowChange]);

  if (!enabled) return null;

  return (
    <div ref={wrapperRef} data-scenario-hover-wrapper className="absolute inset-0 pointer-events-none z-50" id="scenario-hover-container">
      {showContent && (
        <div data-scenario-hover-content className="pointer-events-auto relative h-full w-full min-h-[1px]">
          {children}
        </div>
      )}
    </div>
  );
};
