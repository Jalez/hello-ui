/** @format */

import * as React from "react";
import { NavButton } from "../Navbar/NavButton";
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

  //   return <NavButton clickHandler={handleOpen}>Instructions</NavButton>;

  return (
    <Zoom
      // zoom in whenever room is not Instruction
      in={room.currentRoom !== "Instruction"}
      // zoom out whenever room is Instruction
      //   out={room.currentRoom === "Instruction"}
    >
      <Fab
        color="secondary"
        aria-label="instructions"
        onClick={handleOpen}
        style={{
          boxShadow: "none",
          border: "none",
          backgroundColor: "transparent",
        }}
      >
        <QuestionMarkIcon />
        {/* Navigate */}
      </Fab>
    </Zoom>
  );
}
