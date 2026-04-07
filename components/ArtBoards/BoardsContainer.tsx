/** @format */

import React from "react";

interface BoardsContainerProps {
  children: React.ReactNode;
}

export const BoardsContainer = ({ children }: BoardsContainerProps) => {
  return (
    <div className="boards-container flex h-full w-full flex-col items-center justify-center gap-5">
      {children}
    </div>
  );
};
