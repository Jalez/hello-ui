/** @format */

import { Typography } from '@mui/material';

interface InfoHeadingProps {
	children: React.ReactNode;
	variant: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

/**
 * @description InfoHeading is a component that displays a heading for the InfoBoard
 * @param {InfoHeadingProps} props - props for component,
 * @returns {JSX.Element}
 */
export const InfoHeading = ({ children, variant }: InfoHeadingProps) => {
	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'center',
				// width: '100%',
				position: 'relative',
			}}>
			<Typography
				variant={variant}
				// color='primary'
				// Add styling
				sx={{
					bgcolor: '#222',
					userSelect: 'none',
					borderBottom: '3px solid rgb(17, 17, 17)',
					borderLeft: '3px solid rgb(17, 17, 17)',
					borderRight: '3px solid rgb(17, 17, 17)',
					padding: '0.25em',
					borderBottomLeftRadius: '0.3em',
					borderBottomRightRadius: '0.3em',
					zIndex: 2,
				}}>
				{children}
			</Typography>
		</div>
	);
};
