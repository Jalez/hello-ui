/** @format */

import { Button } from '@mui/material';

// create interface for props
interface NavButtonProps {
	clickHandler: any;
	children: any;
	disabled?: boolean;
}

export const NavButton = ({
	clickHandler,
	children,
	disabled,
}: NavButtonProps) => {
	return (
		<Button
			onClick={clickHandler}
			style={{
				fontFamily: 'Kontakt',
				flex: 1,
				color: disabled ? 'grey' : '#D4AF37',
				border: '2px solid #111',
				fontSize: 30,
				minWidth: 'fit-content',

				// make it stronger
				fontWeight: 'bold',
			}}
			disabled={disabled}>
			{children}
		</Button>
	);
};
