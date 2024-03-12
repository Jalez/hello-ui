/** @format */

import { useAppSelector } from '../../store/hooks/hooks';

// create prop interface
interface LevelDataProps {
	reduxState: string;
}

export const LevelData = ({ reduxState }: LevelDataProps) => {
	// get redux state

	const { currentLevel } = useAppSelector((state: any) => state.currentLevel);
	const detail = useAppSelector(
		(state: any) => state.levels[currentLevel - 1][reduxState]
	);

	return <>{detail}</>;
};
