/** @format */

import { useAppSelector } from "../../../store/hooks/hooks";
import { scenario } from "../../../types";
import { Image } from "../../General/Image/Image";
import ScreenshotWithRedux from "../../Specific/ScreenshotWithRedux/ScreenshotWithRedux";

type ModelProps = {
  scenario: scenario;
};

export const Model = ({ scenario }: ModelProps): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  return (
    <ScreenshotWithRedux
      scenarioId={scenario.scenarioId}
      imageUrl={scenario.solutionUrl}
      //   imageUrl={"lol"}
      name="solution"
    >
      <Image
        name="solution"
        imageUrl={scenario.solutionUrl}
        height={scenario.dimensions.height}
        width={scenario.dimensions.width}
      />
    </ScreenshotWithRedux>
  );
};
