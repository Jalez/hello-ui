import React from "react";
import { styled } from "@mui/system";

interface BoardProps {
  children: React.ReactNode;
}

const StyledBoard = styled("div")(({ theme }) => ({
  marginTop: "5px",
  marginBottom: "5px",
  padding: "0px",
  flexShrink: 0,
  height: "fit-content",
  width: "fit-content",
  boxSizing: "border-box",
  overflow: "hidden",
  border: "5px solid #111",
  zIndex: 2,
  backgroundColor: theme.palette.secondary.main, // Use the theme's secondary color
}));

export const Board = ({ children }: BoardProps) => {
  return <StyledBoard className="board">{children}</StyledBoard>;
};
