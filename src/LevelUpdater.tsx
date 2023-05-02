/** @format */

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './store/hooks/hooks';
import {
	sendScoreToParentFrame,
	updatePointsThunk,
} from './store/actions/score.actions';
import { evaluateLevel } from './store/slices/levels.slice';

export const LevelUpdater = () => {
	//  Invisible component that updates the level in the store
	const dispatch = useAppDispatch();
	// get the points from the current level
	const { currentLevel } = useAppSelector((state) => state.currentLevel);
	// get the level from the levels array
	const level = useAppSelector((state) => state.levels[currentLevel - 1]);
	// get the points from the current level

	const points = level ? level.points : 0;

	// evaluate the level whenever the data urls of the level images change
	useEffect(() => {
		if (level) {
			// check that solEvalUrl and drawnEvalUrl are not undefined
			if (level.drawingUrl && level.solutionUrl) {
				const { drawingUrl, solutionUrl } = level;

				const drawnImage = new Image();
				drawnImage;
				const solutionImage = new Image();

				drawnImage.src = drawingUrl;
				drawnImage.onload = imageLoaded;

				solutionImage.src = solutionUrl;
				solutionImage.onload = imageLoaded;

				// Wait for the image to load
				let imagesLoaded = 0;
				function imageLoaded() {
					imagesLoaded++;
					if (imagesLoaded == 2) {
						dispatch(
							evaluateLevel({ currentLevel, solutionImage, drawnImage })
						);
					}
				}
			}
		}
	}, [level?.solEvalUrl, level?.drawnEvalUrl]);
	useEffect(() => {
		console.log('updating points');
		dispatch(updatePointsThunk(points));
		dispatch(sendScoreToParentFrame());
	}, [points]);

	return null;
};
