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
		<div id='model-board'>
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
							defaultChecked
							// fire when switch is clicked
							onChange={() => setShowModel(!showModel)}
						/>
					}
					style={{
						userSelect: 'none',
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
				{showModel ? (
					<Image imageUrl={level.image} name='solution' />
				) : (
					<Diff />
				)}
			</ArtContainer>
		</div>
	);
};
