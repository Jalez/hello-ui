/** @format */

import { useDispatch } from 'react-redux/es/hooks/useDispatch';
import { domToPng } from 'modern-screenshot';

import { setCurrentLevel } from '../../../store/slices/currentLevel.slice';
import HelpModal from '../../Help/Help';
import { NavButton } from '../NavButton';
import NavMenu from '../NavMenu';
// import pixelmatch from 'pixelmatch';
import {
	sendScoreToParentFrame,
	updatePointsThunk,
} from '../../../store/actions/score.actions';

import './ThreeNavs.css';
import { useAppDispatch, useAppSelector } from '../../../store/hooks/hooks';
import pixelmatch from 'pixelmatch';

export const ThreeNavs = () => {
	const dispatch = useAppDispatch();
	const levels = useAppSelector((state) => state.levels);
	const { currentLevel } = useAppSelector((state) => state.currentLevel);

	// get difficulties in an array from the levels
	const difficulties = levels.map((level) => level.difficulty);

	const levelChanger = (pickedLevel: any) => {
		// get the level object from the levels array
		const level = levels.find((level) => level.difficulty === pickedLevel);
		if (level) {
			// dispatch the levels id to the store as the current level
			dispatch(setCurrentLevel(level.id));
		}
	};

	return (
		<div
			id='three-navs'
			style={{
				borderBottom: '1px solid #111',
			}}>
			<HelpModal />
			{/* <NavButton clickHandler={beginEvaluation}>Evaluate</NavButton> */}
			<div
				style={{
					width: '0px',
					border: '1px solid #111',
				}}></div>
			<NavMenu clickHandler={levelChanger} menuItems={difficulties}>
				Levels
			</NavMenu>
		</div>
	);
};
