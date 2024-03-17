import React from "react";
import { Typography, styled, useTheme } from "@mui/material";

interface BoardTitleProps {
  children: React.ReactNode;
  side?: "left" | "right";
}

const StyledBoardTitle = styled("div")<Pick<BoardTitleProps, "side">>(
  ({ theme, side }) => ({
    writingMode: "vertical-rl",
    textOrientation: "upright",
    fontSize: "2rem",
    display: "flex",
    justifyContent: "center",
    zIndex: 2,
    backgroundColor: theme.palette.secondary.main,
    height: "fit-content",
    margin: "0px",
    border: "5px solid #111",
    position: "relative",
    right: side === "left" ? "-5px" : "5px",
    flexShrink: 0,
  })
);

export const BoardTitle = ({ children, side = "left" }: BoardTitleProps) => {
  const theme = useTheme();

  return (
    <StyledBoardTitle theme={theme} side={side}>
      <Typography color="primary" variant="h3">
        {children}
      </Typography>
    </StyledBoardTitle>
  );
};
