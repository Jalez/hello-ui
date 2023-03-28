/** @format */

import { Button, Menu, MenuItem, MenuProps } from '@mui/material';
import { useAppSelector } from '../../store/hooks/hooks';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useState, useEffect, useRef } from 'react';
import { styled, alpha } from '@mui/material/styles';
import { InfoPicture } from './InfoPicture';

const StyledMenu = styled((props: MenuProps) => (
	<Menu
		elevation={0}
		// anchorOrigin={{
		// 	vertical: 'bottom',
		// 	horizontal: 'right',
		// }}
		// transformOrigin={{
		// 	vertical: 'top',
		// 	horizontal: 'right',
		// }}
		// transformOrigin={{
		// 	vertical: 'top',
		// 	horizontal: 'left',
		// }}
		{...props}
	/>
))(({ theme }) => ({
	'& .MuiPaper-root': {
		boxShadow:
			'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
		'& .MuiMenu-list': {
			padding: '0px 0',
		},
	},
}));

export const InfoPictures = () => {
	const { currentLevel } = useAppSelector((state) => state.currentLevel);
	const [keepOpen, setKeepOpen] = useState<null | boolean>(false);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const levelDetails = useAppSelector(
		(state) => state.levels[currentLevel - 1]
	);

	useEffect(() => {
		const timeOut = setTimeout(() => {
			if (!keepOpen) {
				setKeepOpen(null);
			}
		}, 1000);
		return () => {
			clearTimeout(timeOut);
		};
	}, [keepOpen]);

	const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
	const [open, setOpen] = useState(false);
	const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
		console.log('handleOpen: keepOpen = ', keepOpen, '');
		if (keepOpen == null) setKeepOpen(false);
		setOpen(true);
	};
	const handleClose = () => {
		setKeepOpen(false);
		setOpen(false);
	};
	const openKeeper = () => {
		setKeepOpen(true);
	};
	const pictures = levelDetails?.buildingBlocks?.pictures;
	if (!pictures || pictures.length == 0) return null;
	const handleScroll = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {};
	return (
		<div
			id='info-pictures'
			// when user no longer hovers over the button, close the menu
			onMouseLeave={handleClose}
			style={{
				// position: 'relative',
				// width: '100%',
				height: '100%',
			}}>
			<Button
				id='demo-customized-button'
				aria-controls={open ? 'demo-customized-menu' : undefined}
				style={{
					display: 'flex',
					flexDirection: 'row',
					width: '',
					font: 'inherit',
					color: 'inherit',
					margin: 0,
				}}
				ref={buttonRef}
				// onMouseEnter={handleClick}
				// onMouseLeave={handleClose}
				onMouseEnter={handleOpen}
				// onMouseOver={handleOpen}
				// onMouseLeave={handleClose}
				aria-haspopup='true'
				aria-expanded={open ? 'true' : undefined}
				// variant='contained'
				disableElevation
				endIcon={<KeyboardArrowDownIcon />}>
				Pictures
			</Button>
			<StyledMenu
				style={{
					// display: 'flex',
					// flexDirection: 'row',
					// width: '400px',
					// height: '300px',
					// position: 'absolute',
					margin: 0,
					padding: 0,
					// backgroundColor: 'red',
				}}
				sx={{
					pointerEvents: 'none',
				}}
				anchorEl={buttonRef.current}
				open={open}>
				<div
					onMouseOver={openKeeper}
					style={{
						margin: 0,
						padding: 0,
						backgroundColor: '#222',
						maxHeight: 500,
						width: '100%',
						// maxWidth: 500,
						// width: 'fit-content',
						display: 'flex',
						flexDirection: 'column',
						pointerEvents: 'visible',
						overflow: 'auto',

						// flexWrap: 'wrap',

						justifyContent: 'center',
					}}
					onScroll={handleScroll}
					onMouseLeave={handleClose}>
					<div
						style={{
							backgroundColor: '#333',
							height: 40,
							display: 'flex',
							justifyContent: 'end',
						}}>
						<Button
							style={{
								fontSize: 20,
								font: 'inherit',
								color: 'white',
							}}
							onClick={handleClose}>
							Close
						</Button>
					</div>
					<div
						style={{
							// flex: '1 1 100%',
							display: 'flex',
							flexWrap: 'wrap',
							flexDirection: 'row',
							justifyContent: 'center',
							width: '100%',
							alignItems: 'center',
						}}>
						{pictures?.map((picture, index) => (
							<InfoPicture key={index} picture={picture} />
						))}
					</div>
				</div>
			</StyledMenu>
		</div>
	);
};
