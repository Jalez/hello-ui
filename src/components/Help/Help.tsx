/** @format */

import * as React from "react";

import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { updateRoom } from "../../store/slices/room.slice";
import { Fab, Zoom } from "@mui/material";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";

export default function Help() {
  const dispatch = useAppDispatch();
  const room = useAppSelector((state) => state.room);
  const handleOpen = () => {
    dispatch(updateRoom("Instruction"));
  };

  return (
    <Zoom in={room.currentRoom !== "Instruction"}>
      <Fab
        color="secondary"
        aria-label="instructions"
        onClick={handleOpen}
        sx={{
          boxShadow: "none",
          border: "none",
          backgroundColor: "transparent",
        }}
      >
        <QuestionMarkIcon />
      </Fab>
    </Zoom>
  );
}
