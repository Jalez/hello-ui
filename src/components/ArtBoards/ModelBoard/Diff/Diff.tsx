import { useEffect, useState } from "react";
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
  const differenceUrls = useAppSelector((state: any) => state.differenceUrls);
  const scenarioDiffUrl = differenceUrls[scenario.scenarioId];
  const level = useAppSelector((state: any) => state.levels[currentLevel - 1]);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    if (!scenarioDiffUrl) {
      setLoading(false);
      return;
    }
    if (scenarioDiffUrl.length === 0) {
      setLoading(false);
      return;
    }

    const width = scenario.dimensions.width;
    const height = scenario.dimensions.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imgData = ctx?.createImageData(width, height);
    const deserializedDiff = Buffer.from(scenarioDiffUrl, "base64");

    imgData?.data.set(deserializedDiff);
    ctx?.putImageData(imgData!, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        setImgUrl(URL.createObjectURL(blob));
      }
    });
    setLoading(false);
  }, [scenario, scenarioDiffUrl]);

  return (
    <StyledDiffContainer
      id="diff"
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    >
      {
        // @ts-ignore
        (imgUrl && <img src={imgUrl} alt="Difference" />) || (
          <StyledParagraph>
            No diff image created for this level yet. Save your solution to
            generate.
          </StyledParagraph>
        )
      }
    </StyledDiffContainer>
  );
};
