import React from "react";
import { styled } from "@mui/system";
import { useAppSelector } from "../../store/hooks/hooks";

const StyledSection = styled("section")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "80%",
  flex: "1 1 auto",
  justifyContent: "center",
  alignItems: "center",
  color: theme.palette.primary.main, // Assuming mainColor corresponds to primary color in the theme
  backgroundColor: theme.palette.secondary.main, // Assuming secondaryColor corresponds to secondary color in the theme
  padding: "1rem",
  borderRadius: "1rem",
  zIndex: 10,
}));

export const InfoInstructions = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  return (
    <StyledSection>
      <header>
        <h2>Level Instructions</h2>
      </header>
      <p dangerouslySetInnerHTML={{ __html: level?.instructions || "" }} />
    </StyledSection>
  );
};

export default InfoInstructions;
