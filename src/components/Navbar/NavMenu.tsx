/** @format */

import * as React from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Fade from '@mui/material/Fade';

// create interface for props
interface NavButtonProps {
	clickHandler: any;
	children: any;
	menuItems: Array<String>;
}

export default function NavMenu({
	clickHandler,
	children,
	menuItems,
}: NavButtonProps) {
	const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
	const open = Boolean(anchorEl);
	const handleClick = (event: React.MouseEvent<HTMLElement>) => {
		setAnchorEl(event.currentTarget);
	};
	const handleClose = () => {
		setAnchorEl(null);
	};

	const handleMenuItemClick = (event: React.MouseEvent<HTMLElement>) => {
		clickHandler(event.currentTarget.textContent);
		setAnchorEl(null);
	};

	return (
		<div
			style={{
				fontFamily: 'Kontakt',
				flex: 1,
				color: 'black',
				display: 'flex',
				width: '100%',
				justifyContent: 'center',
				alignItems: 'center',
			}}>
			<Button
				style={{
					fontFamily: 'Kontakt',
					flex: 1,
					color: '#D4AF37',
					backdropFilter: 'blur(1px)',
					fontSize: 30,
					// make it stronger
					fontWeight: 'bold',
				}}
				id='fade-button'
				aria-controls={open ? 'fade-menu' : undefined}
				aria-haspopup='true'
				aria-expanded={open ? 'true' : undefined}
				onClick={handleClick}>
				{children}
			</Button>
			<Menu
				style={{
					width: '100%',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
				}}
				MenuListProps={{
					'aria-labelledby': 'fade-button',
				}}
				// make menu appear below center of button
				anchorOrigin={{
					vertical: 'bottom',
					horizontal: 'center',
				}}
				// Make the menu as wide as the button
				transformOrigin={{
					horizontal: 'center',
					vertical: 'top',
				}}
				anchorEl={anchorEl}
				open={open}
				onClose={handleClose}>
				{menuItems.map((item, index) => {
					return (
						<MenuItem
							key={index}
							style={{
								fontFamily: 'Kontakt',
								fontSize: 30,
								color: 'black',
								display: 'flex',
								width: '100%',
							}}
							onClick={handleMenuItemClick}>
							{item}
						</MenuItem>
					);
				})}
			</Menu>
		</div>
	);
}
