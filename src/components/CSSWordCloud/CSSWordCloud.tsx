/** @format */

import { Box } from "@mui/material";
// import { htmlElementsArray } from "./HTMLElements";
import { WordCloud } from "./WordCloud/WordCloud";
import { cssPropertiesArray } from "./CSSProperties";

export const CSSWordCloud = () => {
  return (
    <Box
      sx={{
        position: "absolute",
        zIndex: 1,
        top: "10%",
        left: "0%",
        padding: "0px",

        margin: "0px",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <WordCloud words={cssPropertiesArray} />
    </Box>
  );
};
