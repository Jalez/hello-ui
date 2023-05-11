/** @format */

import { Paper } from '@mui/material';
import Grow from '@mui/material/Grow';

interface GameContainerProps {
	children: React.ReactNode;
}

const paperStyle = {
	width: '100%',
	padding: 10,
	overflow: 'none',
	backgroundColor: '#222',
	border: 'none',
	display: 'flex',
	flexDirection: 'row' as const,
	justifyContent: 'space-between',
	flexWrap: 'wrap' as const,
};

export const GameContainer = ({ children }: GameContainerProps) => {
	return (
		<Grow in={true}>
			<Paper elevation={10} style={paperStyle}>
				{children}
			</Paper>
		</Grow>
	);
};
