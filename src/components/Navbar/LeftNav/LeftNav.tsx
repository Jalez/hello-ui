/** @format */

import { Button } from '@mui/material';
import { NavButton } from '../NavButton';
import { InfoText } from '../../InfoBoard/InfoText';
import './LeftNav.css';

export const LeftNav = () => {
	const accuracy = 0.5;
	const showHelp = () => {
		console.log('help clicked');
	};
	const beginEvaluation = () => {
		// send a message to the iframe
		const iframe = document.querySelector('iframe');

		if (iframe) {
			iframe.contentWindow?.postMessage('create image', '*');
		}
	};

	return (
		<div id='left-nav'>
			<NavButton clickHandler={showHelp}>Help</NavButton>
			<NavButton clickHandler={beginEvaluation}>Evaluate</NavButton>
			{/* <InfoText>Accuracy {accuracy}</InfoText> */}
		</div>
	);
};
