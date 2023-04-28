/** @format */

import { Button, FormControlLabel, Switch, Typography } from '@mui/material';
import { useState } from 'react';
import { useAppSelector } from '../../../store/hooks/hooks';
import { InfoBoard } from '../../InfoBoard/InfoBoard';
import { InfoColor } from '../../InfoBoard/InfoColor';
import { Frame } from '../Frame';
import { Diff } from './Diff/Diff';
import { Image } from '../../General/Image/Image';
import './ModelBoard.css';
import ScreenshotWithRedux from '../../Specific/ScreenshotWithRedux/ScreenshotWithRedux';
import { ArtContainer } from '../ArtContainer';
import { InfoPicture } from '../../InfoBoard/InfoPicture';
import { InfoPictures } from '../../InfoBoard/InfoPictures';

// interface DrawboardProps {
// 	htmlCode: string;
// 	cssCode: string;
// }

export const ModelBoard = (): JSX.Element => {
	const { currentLevel } = useAppSelector((state) => state.currentLevel);
	const level = useAppSelector((state) => state.levels[currentLevel - 1]);
	const [showModel, setShowModel] = useState(true);

	return (
		<div className='board'>
			<InfoBoard>
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
					}}>
					{level.buildingBlocks?.colors?.map((color, index) => (
						<InfoColor key={index} color={color} />
					))}
				</div>
				<InfoPictures />
				<FormControlLabel
					control={
						<Switch
							// Change color to #D4AF37
							color='primary'
							defaultChecked
							// fire when switch is clicked
							onChange={() => setShowModel(!showModel)}
						/>
					}
					style={{
						userSelect: 'none',
						// color: '#D4AF37',
					}}
					label={
						<Typography variant='body1'>
							{showModel ? 'Model' : 'Diff'}
						</Typography>
					}
					labelPlacement='start'
				/>
			</InfoBoard>
			<ArtContainer>
				{!level.solutionUrl && (
					<Frame
						id='DrawBoard'
						newCss={level.solution.css}
						newHtml={level.solution.html}
						frameUrl={'http://localhost:3500'}
						name='solutionUrl'
					/>
				)}
				<div
					style={{
						position: 'absolute',
						bottom: 0,
					}}>
					<ScreenshotWithRedux imageUrl={level.solutionUrl} name='solution'>
						{showModel ? (
							<Image imageUrl={level.solutionUrl} name='solution' />
						) : (
							<Diff />
						)}
					</ScreenshotWithRedux>
				</div>
			</ArtContainer>
		</div>
	);
};
