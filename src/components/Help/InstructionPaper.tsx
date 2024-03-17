import React from "react";
import { Paper, styled } from "@mui/material";

interface InstructionPaperProps {
  children: React.ReactNode;
}

const StyledPaper = styled(Paper)(({ theme }) => ({
  width: "100%",
  aspectRatio: "2 / 1",
  overflow: "auto",
  backgroundColor: theme.palette.secondary.main,
  border: `5px solid ${theme.palette.primary.main}`,
  boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.1)", // Example shadow
  padding: theme.spacing(4), // MUI spacing equivalent for 'p: 4'
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
}));

const InstructionPaper = ({ children }: InstructionPaperProps) => {
  return (
    <StyledPaper role="region" aria-label="Instruction">
      {children}
    </StyledPaper>
  );
};

export default InstructionPaper;
