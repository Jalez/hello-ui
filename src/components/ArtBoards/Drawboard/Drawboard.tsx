/** @format */

import zIndex from '@mui/material/styles/zIndex';
import { useAppSelector } from '../../../store/hooks/hooks';
import { Image } from '../../General/Image/Image';

import { InfoBoard } from '../../InfoBoard/InfoBoard';
import { InfoText } from '../../InfoBoard/InfoText';
import { LevelData } from '../../InfoBoard/LevelData';
import ScreenshotWithRedux from '../../Specific/ScreenshotWithRedux/ScreenshotWithRedux';
import { ArtContainer } from '../ArtContainer';
import { Frame } from '../Frame';
import './Drawboard.css';
import { SlideShower } from './ImageContainer/SlideShower';

export const Drawboard = () => {
	const { currentLevel } = useAppSelector((state) => state.currentLevel);
	const level = useAppSelector((state) => state.levels[currentLevel - 1]);

	return (
		<div className='board'>
			<InfoBoard>
				<InfoText text={'Points'}>
					<LevelData reduxState='points' />
					/
					<LevelData reduxState='maxPoints' />
				</InfoText>
				<InfoText text={''}>
					<LevelData reduxState='difficulty' />
				</InfoText>
				<InfoText text={'Accuracy: '}>
					<LevelData reduxState='accuracy' />
				</InfoText>
			</InfoBoard>
			<ArtContainer>
				{/* <SlideShower
					staticComponent={<Image imageUrl={level.image} name='solution' />}
					slidingComponent={ */}
				<div
					style={{
						height: '300px',
						width: '400px',
						overflow: 'hidden',
					}}>
					<Frame
						id='DrawBoard'
						newCss={level.code.css}
						newHtml={level.code.html}
						frameUrl={'http://localhost:3500'}
						name='drawingUrl'
					/>
					<div
						style={{
							position: 'absolute',
							// hide the screenshot
							// visibility: 'hidden',
							bottom: 0,
							// zIndex: 0,
						}}>
						<ScreenshotWithRedux imageUrl={level.drawingUrl} name='drawing'>
							<Image imageUrl={level.drawingUrl} name='drawing' />
						</ScreenshotWithRedux>
					</div>
				</div>
				{/* } */}
				{/* /> */}
			</ArtContainer>
		</div>
	);
};
