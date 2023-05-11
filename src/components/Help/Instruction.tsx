/** @format */

import * as React from 'react';
import { Button } from '@mui/material';

import { Title } from '../Title/Title';
import { useAppDispatch, useAppSelector } from '../../store/hooks/hooks';
import { updateRoom } from '../../store/slices/room.slice';
import { useEffect } from 'react';
import InstructionModal from './InstructionModal';
import InstructionTabs from './InstructionTabs';
import InstructionPaper from './InstructionPaper';
import InstructionContentContainer from './InstructionContentContainer';

export default function Instruction() {
	const [open, setOpen] = React.useState(false);

	const dispatch = useAppDispatch();
	const room = useAppSelector((state) => state.room);

	useEffect(() => {
		if (room.currentRoom === 'Instruction') {
			setOpen(true);
		}
	}, [room.currentRoom]);

	const handleClose = () => {
		setOpen(false);
		dispatch(updateRoom('game'));
	};

	return (
		<InstructionModal open={open}>
			<InstructionPaper>
				<Title />
				<InstructionContentContainer>
					<InstructionTabs />
					<div
						style={{
							display: 'flex',
							justifyContent: 'center',
							padding: 30,
						}}>
						<Button onClick={handleClose} variant='contained'>
							<strong>To the tasks</strong>
						</Button>
					</div>
				</InstructionContentContainer>
			</InstructionPaper>
		</InstructionModal>
	);
}
