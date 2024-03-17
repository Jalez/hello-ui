/** @format */

import { Paper, backdropClasses } from "@mui/material";
import Grow from "@mui/material/Grow";

interface GameContainerProps {
  children: React.ReactNode;
}

const paperStyle = {
  width: "100%",
  flex: 1,
  //   height: "100%",
  //   padding: 10,
  //   maxHeight: "100%",
  // make height be the remaining space in the viewport
  position: "relative" as const,

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
    <Grow in={true}>
      <Paper elevation={1} style={paperStyle}>
        {children}
      </Paper>
    </Grow>
  );
};
