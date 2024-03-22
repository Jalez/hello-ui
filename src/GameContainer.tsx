/** @format */

import { Paper } from "@mui/material";

interface GameContainerProps {
  children: React.ReactNode;
}

const paperStyle = {
  width: "100%",
  position: "relative" as const,
  height: "fit-content",
  boxSizing: "border-box" as const,

  overflow: "none",
  border: "none",
  display: "flex",
  flexDirection: "row" as const,
  justifyContent: "space-between",
  alignItems: "space-between" as const,
  flexWrap: "wrap" as const,
  backgroundColor: "transparent",
};

export const GameContainer = ({ children }: GameContainerProps) => {
  return (
    // <Grow in={true}>
    <Paper elevation={1} sx={paperStyle}>
      {children}
    </Paper>
    // </Grow>
  );
};
