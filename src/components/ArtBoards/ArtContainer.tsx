/** @format */

import { drawBoardWidth, drawBoardheight } from "../../constants";

interface ArtContainerProps {
  children: React.ReactNode;
}

export const ArtContainer = ({ children }: ArtContainerProps) => {
  return (
    <div
      className="img-container"
      style={{
        position: "relative",
        height: drawBoardheight + "px",
        width: drawBoardWidth + "px",
        zIndex: 2,
      }}
    >
      {children}
    </div>
  );
};
