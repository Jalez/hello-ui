/** @format */

import { Typography } from "@mui/material";

interface BoardTitleProps {
  children: React.ReactNode;
  side?: "left" | "right";
}

const BoardStyles = (side: string) => ({
  // Put the text sideways
  writingMode: "vertical-rl" as const,
  textOrientation: "upright" as const,
  // Make it look like a title
  fontSize: "2rem",
  // center it
  display: "flex",
  justifyContent: "center",
  zIndex: 2,
  backgroundColor: "#222",
  height: "fit-content",
  margin: "0px",
  borderBottom: "5px solid #111",
  borderTop: "5px solid #111",
  borderLeft: "5px solid #111",
  borderRight: "5px solid #111",
  position: "relative" as const,
  right: side === "left" ? "-5px" : "5px",
  flexShrink: 0,
});

export const BoardTitle = ({ children, side = "left" }: BoardTitleProps) => {
  return (
    <div style={BoardStyles(side)}>
      <Typography color="primary" variant="h3">
        {children}
      </Typography>
    </div>
  );
};
