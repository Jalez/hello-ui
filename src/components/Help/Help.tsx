/** @format */

import * as React from 'react';
import { NavButton } from '../Navbar/NavButton';
import { useAppDispatch } from '../../store/hooks/hooks';
import { updateRoom } from '../../store/slices/room.slice';

export default function Help() {
	const [open, setOpen] = React.useState(false);
	const dispatch = useAppDispatch();
	const handleOpen = () => {
		dispatch(updateRoom('Instruction'));
	};
	const handleClose = () => setOpen(false);

	return <NavButton clickHandler={handleOpen}>Instructions</NavButton>;
}
