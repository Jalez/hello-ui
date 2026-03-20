/** @format */
'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEffect, useState } from "react";

interface InfoColorProps {
  color: string;
}

export const InfoColor = ({ color }: InfoColorProps): React.ReactNode | null => {
  const [popUp, setPopUp] = useState(false);

  useEffect(() => {
    if (popUp) {
      const timeout = setTimeout(() => {
        setPopUp(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [popUp]);

  const clickHandler = () => {
    // When clicked, copy the color code to the clipboard
    navigator.clipboard.writeText(color);
    setPopUp(true);
  };

  return (
    <div className="shrink-0">
      <Popover open={popUp} onOpenChange={setPopUp}>
        <PopoverTrigger asChild>
          <div
            onClick={clickHandler}
            className="flex cursor-pointer flex-row items-center justify-center"
          >
            <div
              className="color-box h-5 w-5 box-border rounded-full border-[0.1em] border-[#444] select-none"
              style={{ backgroundColor: color }}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="m-0 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
          Copied to the clipboard
        </PopoverContent>
      </Popover>
    </div>
  );
};
