/** @format */

import { NavButton } from '../NavButton';
import { InfoText } from '../../InfoBoard/InfoText';
import './RightNav.css';

export const RightNav = () => {
	const passedLevel = 'No';

	const levelChanger = () => {
		console.log('level changer clicked');
		return 0;
	};

	return (
		<div id='right-nav'>
			{/* <InfoText>
				Level passed:
				{passedLevel}
			</InfoText> */}
			<NavButton clickHandler={levelChanger}>Levels</NavButton>
		</div>
	);
};
