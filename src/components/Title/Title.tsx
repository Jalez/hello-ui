/** @format */

import { Typography } from '@mui/material';
import './Title.css';

export const Title = () => {
	return (
		<div id='title-container'>
			<Typography
				id='main-title'
				style={
					{
						// fontSize: 100,
					}
				}
				color='primary'
				variant='h1'>
				UI Designer
			</Typography>
			<Typography id='sub-title' variant='h2'>
				Layouts
			</Typography>
		</div>
	);
};
