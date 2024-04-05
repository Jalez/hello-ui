import { useEffect } from "react";
import { Buffer } from "buffer";
import { styled } from "@mui/system";
import { useAppSelector } from "../../../../store/hooks/hooks";
import { scenario } from "../../../../types";

const StyledDiffContainer = styled("div")<{ width: number; height: number }>(
  ({ theme, width, height }) => ({
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: theme.palette.primary.main,
    zIndex: 100,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  })
);

const StyledParagraph = styled("p")({
  textAlign: "center",
});

type DiffProps = {
  scenario: scenario;
};

export const Diff = ({ scenario }: DiffProps): JSX.Element => {
  const { currentLevel } = useAppSelector((state: any) => state.currentLevel);
  const level = useAppSelector((state: any) => state.levels[currentLevel - 1]);

  useEffect(() => {
    if (scenario.differenceUrl.length === 0) return;
    const diff = document.getElementById("diff");
    if (diff) {
      diff.innerHTML = "";

      // Create a canvas element and use the diff data to draw the image
      const width = scenario.dimensions.width;
      const height = scenario.dimensions.height;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      const imgData = ctx?.createImageData(width, height);
      const deserializedDiff = Buffer.from(scenario.differenceUrl, "base64");

      imgData?.data.set(deserializedDiff);
      ctx?.putImageData(imgData!, 0, 0);
      diff.appendChild(canvas);
    }
  }, [level.diff]);

  return (
    <StyledDiffContainer
      id="diff"
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    >
      <StyledParagraph>
        No diff image created for this level yet. Click evaluate to generate.
      </StyledParagraph>
    </StyledDiffContainer>
  );
};
