/** @format */

import * as React from 'react';
import { useEffect } from 'react';
import './InstructionModal.css';

interface InstructionModalProps {
	open: boolean;
	children: any;
}

const modalStyle = {
	position: 'absolute' as const,
	display: 'flex',
	// flexDirection: 'column',
	justifyContent: 'center',
	alignItems: 'center',
	width: '100%',
	height: '100vh',
	zIndex: 100,
};

const InstructionModal = ({ open, children }: InstructionModalProps) => {
	const [maskClass, setMaskClass] = React.useState('hide-mask');
	const [id, setId] = React.useState('element-to-mask');
	const [closed, setClosed] = React.useState(false);

	useEffect(() => {
		setId('element-to-mask');
		if (open) {
			setMaskClass('show-mask');
			setClosed(false);
		} else {
			setMaskClass('hide-mask');
			setTimeout(() => {
				setClosed(true);
			}, 400);
		}
	}, [open]);

	useEffect(() => {
		if (id === 'element-to-mask' && open) {
			setTimeout(() => {
				setId('');
			}, 400);
		}
	}, [id]);

	if (closed) return null;
	return (
		<div style={modalStyle}>
			<section id={id} className={`element ${maskClass}`}>
				{children}
			</section>
		</div>
	);
};

export default InstructionModal;
