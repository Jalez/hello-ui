/** @format */

import { Paper } from "@mui/material";
import { mainColor } from "../../constants";

interface InstructionPaperProps {
  children: any;
}

const paperStyle = {
  // width: '100%',
  width: "100%",
  aspectRatio: "2/1",
  // make height half of width, where width can be anything
  overflow: "auto",
  bgcolor: "#222",
  // bgcolor: '',
  border: `5px solid ${mainColor}`,
  // border: 'none',
  boxShadow: 24 as const,
  p: 4,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const InstructionPaper = ({ children }: InstructionPaperProps) => {
  return (
    <Paper sx={paperStyle} role="region" aria-label="Instruction">
      {children}
    </Paper>
  );
};

export default InstructionPaper;
