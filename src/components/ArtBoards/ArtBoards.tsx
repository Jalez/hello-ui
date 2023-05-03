/** @format */

import { Typography } from '@mui/material';
import { CSSWordCloud } from '../CSSWordCloud/CSSWordCloud';
import { InfoText } from '../InfoBoard/InfoText';
import { LevelData } from '../InfoBoard/LevelData';
import './ArtBoard.css';
import { Drawboard } from './Drawboard/Drawboard';
import { ModelBoard } from './ModelBoard/ModelBoard';

export const ArtBoards = () => {
	return (
		<div
			style={{
				position: 'relative',
				width: '100%',
				overflow: 'hidden',
			}}>
			<Typography
				variant='h2'
				color='primary'
				style={{
					// center it
					display: 'flex',
					justifyContent: 'center',
					width: '100%',
				}}>
				<InfoText text={''}>
					<LevelData reduxState='difficulty' />
				</InfoText>
			</Typography>
			<div id='artBoard'>
				<Drawboard />
				<ModelBoard />
			</div>
			<CSSWordCloud />
		</div>
	);
};
