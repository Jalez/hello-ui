/** @format */

import { useAppSelector } from '../../store/hooks/hooks';
import { InfoColor } from './InfoColor';

export const InfoColors = () => {
	const currentLevel = useAppSelector(
		(state) => state.currentLevel.currentLevel
	);
	const level = useAppSelector((state) => state.levels[currentLevel - 1]);

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
			}}>
			{level.buildingBlocks?.colors?.map((color, index) => (
				<InfoColor key={index} color={color} />
			))}
		</div>
	);
};
