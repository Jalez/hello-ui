/** @format */

import { Box } from "@mui/material";

interface InstructionContentProps {
  children: React.ReactNode;
}
const InstructionContent = ({ children }: InstructionContentProps) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        flexGrow: 1,
      }}
    >
      {children}
    </Box>
  );
};

export default InstructionContent;
