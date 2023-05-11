/** @format */

import { Typography } from '@mui/material';

interface BoardTitleProps {
	children: React.ReactNode;
}

const BoardStyles = {
	// Put the text sideways
	writingMode: 'vertical-rl' as const,
	textOrientation: 'upright' as const,
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
};

export const BoardTitle = ({ children }: BoardTitleProps) => {
	return (
		<div style={BoardStyles}>
			<Typography color='primary' variant='h3'>
				{children}
			</Typography>
		</div>
	);
};
