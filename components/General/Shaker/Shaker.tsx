'use client';

import { useState, useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ShakerProps = {
  children: ReactNode;
  value: string | number;
};

const Shaker = ({ children, value }: ShakerProps) => {
  const [prevValue, setPrevValue] = useState<string | number>(value);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (value !== prevValue) {
      setShouldAnimate(true);
      timeoutId = setTimeout(() => {
        setPrevValue(value);
        setShouldAnimate(false);
      }, 1000);
    } else {
      setShouldAnimate(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [value, prevValue]);

  return (
    <span
      className={cn(
        "relative inline-block",
        shouldAnimate && "animate-shake"
      )}
    >
      {children}
    </span>
  );
};

export default Shaker;
