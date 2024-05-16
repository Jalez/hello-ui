import React, { useMemo } from "react";
import { styled } from "@mui/system";
import { useAppSelector } from "../../store/hooks/hooks";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
} from "@mui/material";
import { ExpandMoreOutlined } from "@mui/icons-material";
import Info from "./Info";
import InfoGuide from "./InfoGuide";
import PoppingTitle from "../General/PoppingTitle";
import InfoIcon from "@mui/icons-material/Info";

type InfoInstructionsProps = {
  children: React.ReactNode;
};

export const InfoInstructions = ({ children }: InfoInstructionsProps) => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const instructions = level.instructions;
  // <StyledSection>
  // </StyledSection>
  return (
    <Accordion
      id="instructions"
      sx={{
        bgcolor: "secondary.main",
        color: "primary.main",
        border: "none",
        boxShadow: "none",
        p: 0,
        m: 0,
        // width: "100%",
        "&.Mui-expanded": {
          margin: 0, // Overrides the default expanded margin
        },
        "& .MuiAccordionSummary-root": {
          m: 0,
          p: 0,
          "& .MuiAccordionSummary-content": {
            m: 0,
          },
          "& .Mui-expanded": {
            minHeight: "auto",
            margin: 0, // Explicitly override margin here too
          },
        },
        "& .MuiAccordionDetails-root": {
          p: 0,
          m: 0,
          // width: "100%",
        },
      }}
    >
      <Box
        id="instructions-box"
        sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}
      >
        {children}
        <AccordionSummary
          expandIcon={<ExpandMoreOutlined sx={{ color: "primary.main" }} />}
        >
          <PoppingTitle topTitle="Level Instructions">
            <InfoIcon
              //  change size of icon
              fontSize="large"
            />
          </PoppingTitle>
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
        <InfoGuide sections={instructions} />
      </AccordionDetails>
    </Accordion>
  );
};

export default InfoInstructions;
