import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Buffer } from "buffer";
import { styled } from "@mui/system";
import { drawBoardWidth, drawBoardheight } from "../../../../constants";
import { useAppSelector } from "../../../../store/hooks/hooks";

const StyledDiffContainer = styled("div")(({ theme }) => ({
  width: `${drawBoardWidth}px`,
  height: `${drawBoardheight}px`,
  backgroundColor: theme.palette.primary.main,
  zIndex: 100,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
}));

const StyledParagraph = styled("p")({
  textAlign: "center",
});

export const Diff = () => {
  const { currentLevel } = useAppSelector((state: any) => state.currentLevel);
  const level = useAppSelector((state: any) => state.levels[currentLevel - 1]);

  useEffect(() => {
    if (level.diff.length === 0) return;
    const diff = document.getElementById("diff");
    if (diff) {
      diff.innerHTML = "";

      // Create a canvas element and use the diff data to draw the image
      const width = drawBoardWidth;
      const height = drawBoardheight;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      const imgData = ctx?.createImageData(width, height);
      const deserializedDiff = Buffer.from(level.diff, "base64");

      imgData?.data.set(deserializedDiff);
      ctx?.putImageData(imgData!, 0, 0);
      diff.appendChild(canvas);
    }
  }, [level.diff]);

  return (
    <StyledDiffContainer id="diff">
      <StyledParagraph>
        No diff image created for this level yet. Click evaluate to generate.
      </StyledParagraph>
    </StyledDiffContainer>
  );
};
