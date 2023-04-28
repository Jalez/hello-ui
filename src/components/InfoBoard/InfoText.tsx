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
				}}>
				{text} {children}
			</p>
		</>
	);
};
