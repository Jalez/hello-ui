import React, { useMemo } from "react";
import { styled } from "@mui/system";
import { useAppSelector } from "../../store/hooks/hooks";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
} from "@mui/material";
import { ExpandMoreOutlined } from "@mui/icons-material";
import Info from "./Info";

const StyledSection = styled("section")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  flex: "1 1 auto",
  justifyContent: "center",
  alignItems: "center",
  color: theme.palette.primary.main, // Assuming mainColor corresponds to primary color in the theme
  backgroundColor: theme.palette.secondary.main, // Assuming secondaryColor corresponds to secondary color in the theme
  padding: "1rem",
  borderRadius: "1rem",
  zIndex: 10,
  bgcolor: "secondary.main",
}));

export const InfoInstructions = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const instructionsHtmlObj = useMemo(
    () => ({ __html: level?.instructions || "" }),
    [level?.instructions]
  );
  // <StyledSection>
  // </StyledSection>
  return (
    <Accordion
      sx={{
        bgcolor: "secondary.main",
        color: "primary.main",
        border: "none",
        // remove shadow
        boxShadow: "none",
        width: "100%",
      }}
    >
      <Box
        sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}
      >
        <Info />
        <AccordionSummary
          expandIcon={<ExpandMoreOutlined sx={{ color: "primary.main" }} />}
        >
          <header>
            <h2>Level Instructions</h2>
          </header>
        </AccordionSummary>
      </Box>
      <AccordionDetails
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "secondary.main",
          color: "primary.main",
        }}
      >
        <p dangerouslySetInnerHTML={instructionsHtmlObj} />
      </AccordionDetails>
    </Accordion>
  );
};

export default InfoInstructions;
