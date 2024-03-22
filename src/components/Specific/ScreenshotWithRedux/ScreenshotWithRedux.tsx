/** @format */

import { useScreenshotUpdate } from "../../../store/hooks/hooks";
import { ScreenShotter } from "../../General/Screenshotter/Screenshotter";

type ScreenshotWithReduxProps = {
  imageUrl: string;
  name: string;
  children: JSX.Element;
};

const ScreenshotWithRedux = ({
  imageUrl,
  name,
  children,
}: ScreenshotWithReduxProps) => {
  const { updateScreenshot } = useScreenshotUpdate();
  return (
    <ScreenShotter
      screenshotName={name}
      triggerCondition={imageUrl}
      updateScreenshot={updateScreenshot}
    >
      {children}
    </ScreenShotter>
  );
};

export default ScreenshotWithRedux;
