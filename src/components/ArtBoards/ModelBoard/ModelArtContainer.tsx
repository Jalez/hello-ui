/** @format */

// ModelArtContainer.tsx
import { Frame } from "../Frame";

import { ArtContainer } from "../ArtContainer";
import { useAppSelector } from "../../../store/hooks/hooks";
import { scenario } from "../../../types";

type ModelArtContainerProps = {
  children: JSX.Element;
  scenario: scenario;
};

export const ModelArtContainer = ({
  children,
  scenario,
}: ModelArtContainerProps): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  if (!level) return <div>loading...</div>;
  // console.log("scenario.solutionUrl", scenario.solutionUrl);
  // decode with base64
  if (scenario.solutionUrl) {
    // take only the base64 part
    const base64 = scenario.solutionUrl.split(",")[1];

    // Convert Base64 to binary
    const binary = atob(base64);

    // Convert binary string to an array buffer
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i);
    }

    // Create a blob from the array buffer
    const blob = new Blob([buffer], { type: "image/png" });

    // Create an object URL from the blob
    const imageUrl = URL.createObjectURL(blob);
  }
  return (
    <ArtContainer
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    >
      {!scenario.solutionUrl && (
        <Frame
          id="DrawBoard"
          newCss={level.solution.css}
          newHtml={level.solution.html}
          newJs={level.solution.js + "\n" + scenario.js}
          events={level.events || []}
          scenario={scenario}
          name="solutionUrl"
        />
      )}
      <div
        style={{
          position: "absolute",
          bottom: 0,
        }}
      >
        {children}
      </div>
    </ArtContainer>
  );
};
