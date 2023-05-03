/** @format */

import { useSelector } from 'react-redux';

// create prop interface
interface NavTextProps {
	children: any;
	text: string;
}

export const InfoText = ({ children, text }: NavTextProps) => {
	return (
		<>
			<p
				style={{
					textAlign: 'center',
					// dont allow selection
					userSelect: 'none',
					zIndex: 2,
					// show the back blurred
					// backdropFilter: 'blur(10px)',
					backgroundColor: '#222',
					padding: '0.25em',
					borderBottomLeftRadius: '0.3em',
					borderBottomRightRadius: '0.3em',
					margin: 0,
					borderBottom: '3px solid rgb(17, 17, 17)',
					borderLeft: '3px solid rgb(17, 17, 17)',
					borderRight: '3px solid rgb(17, 17, 17)',
				}}>
				{text} {children}
			</p>
		</>
	);
};
