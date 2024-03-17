/** @format */

import { cssPropertiesArray } from "./CSSProperties";
import { htmlElementsArray } from "./HTMLElements";
import { WordCloud } from "./WordCloud/WordCloud";

export const CSSWordCloud = () => {
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 1,
        top: "30%",
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
      <WordCloud words={htmlElementsArray} />
    </div>
  );
};
