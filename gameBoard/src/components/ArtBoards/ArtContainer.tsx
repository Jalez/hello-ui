/** @format */

import { Box } from "@mui/material";

interface ArtContainerProps {
  children: React.ReactNode;
  height?: number;
  width?: number;
}

export const ArtContainer = ({
  children,
  height,
  width,
}: ArtContainerProps) => {
  return (
    <Box
      className="img-container"
      sx={{
        position: "relative",
        height: height + "px",
        width: width + "px",
        zIndex: 2,
      }}
    >
      {children}
    </Box>
  );
};
