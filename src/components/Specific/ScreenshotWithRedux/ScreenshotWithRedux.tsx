/** @format */

import { useScreenshotUpdate } from '../../../store/hooks/hooks';
import { Image } from '../../General/Image/Image';
import { ScreenShotter } from '../../General/Screenshotter/Screenshotter';

interface ScreenshotWithReduxProps {
	imageUrl: string;
	name: string;
	children: JSX.Element;
}

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
			updateScreenshot={updateScreenshot}>
			{children}
		</ScreenShotter>
	);
};

export default ScreenshotWithRedux;
