/** @format */

import { Popover } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

interface InfoColorProps {
	color: string;
}

export const InfoColor = ({ color }: InfoColorProps): JSX.Element | null => {
	const [popUp, setPopUp] = useState(false);
	const colorRef = useRef<HTMLParagraphElement>(null);
	// Get the color code from the state

	// get the current level from the store state

	useEffect(() => {
		if (popUp) {
			setTimeout(() => {
				setPopUp(false);
			}, 500);
		}
	}, [popUp]);

	const clickHandler = (
		event: React.MouseEvent<HTMLParagraphElement, MouseEvent>
	) => {
		// When the p is clicked, copy the color code to the clipboard
		navigator.clipboard.writeText(color);
		// alert the user that the color code has been copied
		// alert('Copied to clipboard');
		setPopUp(true);
	};

	return (
		<div
			style={{
				width: '100%',
			}}>
			<Popover
				anchorOrigin={{
					vertical: 'top',
					horizontal: 'center',
				}}
				transformOrigin={{
					vertical: 'bottom',
					horizontal: 'center',
				}}
				anchorEl={colorRef.current}
				open={popUp}>
				<p
					style={{
						margin: '10px',
					}}>
					Copied to the clipboard
				</p>
			</Popover>
			<div
				ref={colorRef}
				onClick={clickHandler}
				style={{
					// make p display box
					display: 'flex',

					alignItems: 'center',
				}}>
				<div
					className='color-box'
					style={{
						backgroundColor: color,
						height: '20px',
						width: '20px',
						borderRadius: '50%',
						border: '2px solid black',
						// Dont allow the user to select the color box
						userSelect: 'none',
					}}></div>
				<span
					style={{
						userSelect: 'none',
					}}>
					{color}
				</span>
			</div>
		</div>
	);
};
