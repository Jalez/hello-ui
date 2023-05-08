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
import { Typography } from '@mui/material';

export const Drawboard = () => {
	const { currentLevel } = useAppSelector((state) => state.currentLevel);
	const level = useAppSelector((state) => state.levels[currentLevel - 1]);

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'row',
				justifyContent: 'center',
				alignItems: 'center',
				flex: '1 0 auto',
				flexShrink: 0,
				width: 500,
			}}>
			<div
				style={{
					// Put the text sideways
					writingMode: 'vertical-rl',
					textOrientation: 'upright',
					// Make it look like a title
					fontSize: '2rem',
					// center it
					display: 'flex',
					justifyContent: 'center',
					zIndex: 2,
					backgroundColor: '#222',
					height: 'fit-content',
					margin: '0px',
					borderBottom: '5px solid #111',
					borderTop: '5px solid #111',
					borderLeft: '5px solid #111',
					flexShrink: 0,
				}}>
				<Typography color='primary' variant='h3'>
					Your version
				</Typography>
			</div>
			<div className='board'>
				<InfoBoard>
					<InfoText text={'Points'}>
						<LevelData reduxState='points' />
						/
						<LevelData reduxState='maxPoints' />
					</InfoText>
					{/* <InfoText text={''}>
						<LevelData reduxState='difficulty' />
					</InfoText> */}
					<InfoText text={'Accuracy: '}>
						<LevelData reduxState='accuracy' />
					</InfoText>
				</InfoBoard>
				<ArtContainer>
					<SlideShower
						staticComponent={<Image imageUrl={level.image} name='solution' />}
						slidingComponent={
							<div
								style={{
									height: '300px',
									width: '400px',
									overflow: 'auto',
								}}>
								<Frame
									id='DrawBoard'
									newCss={level.code.css}
									newHtml={level.code.html}
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
									<ScreenshotWithRedux
										imageUrl={level.drawingUrl}
										name='drawing'>
										<Image imageUrl={level.drawingUrl} name='drawing' />
									</ScreenshotWithRedux>
								</div>
							</div>
						}
					/>
				</ArtContainer>
			</div>
		</div>
	);
};
