import React from "react";
import { styled } from "@mui/system";
import { useAppSelector } from "../../store/hooks/hooks";
import { mainColor, secondaryColor } from "../../constants";

const StyledSection = styled("section")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  padding: "1rem",
  backgroundColor: theme.palette.secondary?.main || secondaryColor, // Use theme color or fallback to constant
  color: theme.palette.primary?.main || mainColor, // Use theme color or fallback to constant
  borderRadius: "1rem",
  boxShadow: "0 0 10px 0px rgba(0, 0, 0, 0.5)",
  width: "100%",
  flex: "1 1 auto",
  height: "100%",
  overflow: "auto",
  margin: "1rem",
  zIndex: 10,
}));

export const InfoQuestionAndAnswer = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  return (
    <StyledSection>
      <header>
        <h2>{level?.question_and_answer?.question || "No question"}</h2>
      </header>
      <p>{level?.question_and_answer?.answer || "No answer"}</p>
    </StyledSection>
  );
};
