/** @format */

import { useAppSelector } from '../../../store/hooks/hooks';
import { Image } from '../../General/Image/Image';
import ScreenshotWithRedux from '../../Specific/ScreenshotWithRedux/ScreenshotWithRedux';

export const Model = (): JSX.Element => {
	const { currentLevel } = useAppSelector((state) => state.currentLevel);
	const level = useAppSelector((state) => state.levels[currentLevel - 1]);

	return (
		<ScreenshotWithRedux imageUrl={level.solutionUrl} name='solution'>
			<Image imageUrl={level.solutionUrl} name='solution' />
		</ScreenshotWithRedux>
	);
};
