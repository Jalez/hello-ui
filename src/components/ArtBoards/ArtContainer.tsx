/** @format */

import { Box } from "@mui/material";
import { drawBoardWidth, drawBoardheight } from "../../constants";

interface ArtContainerProps {
  children: React.ReactNode;
}

export const ArtContainer = ({ children }: ArtContainerProps) => {
  return (
    <Box
      className="img-container"
      sx={{
        position: "relative",
        height: drawBoardheight + "px",
        width: drawBoardWidth + "px",
        zIndex: 2,
      }}
    >
      {children}
    </Box>
  );
};
