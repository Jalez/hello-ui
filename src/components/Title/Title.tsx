import React from "react";
import { Typography, styled } from "@mui/material";

const StyledTitleContainer = styled("div")(({ theme }) => ({
  margin: "0px",
  padding: "1em",
  textAlign: "center",
  userSelect: "none",
  zIndex: 1,
  backgroundRepeat: "no-repeat",
  color: theme.palette.secondary.main, // Using theme's secondary color
  backgroundPosition: "center",
}));

export const Title = () => {
  return (
    <StyledTitleContainer>
      <Typography
        id="main-title"
        color="primary"
        variant="h1"
        // You can add more styles here if needed
      >
        UI Designer
      </Typography>
      <Typography id="sub-title" variant="h2">
        Layouts
      </Typography>
    </StyledTitleContainer>
  );
};
