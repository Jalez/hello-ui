/** @format */

import { scoreTypes } from '../constants/score.actions.js';
import { updatePoints } from '../slices/score.slice.js';
import { AppThunk } from '../store.js';

const updateMaxPoints = (maxPoints = 0) => {
	return {
		type: scoreTypes.updateMaxPoints,
		payload: maxPoints,
	};
};

// Create a thunk action creator that returns a function that accepts dispatch as an argument
export const updatePointsThunk =
	(accuracy: number): AppThunk =>
	async (dispatch, getState) => {
		{
			// Get current level from store
			const levels = getState().levels;
			// Loop through the levels and increment the points together as updatePoints
			const updatedPoints = levels.reduce((acc, level) => {
				// If the level is completed, add the points to the accumulator
				acc += level.points;
				return acc;
			}, 0);

			// Dispatch the thunk action
			dispatch(updatePoints(updatedPoints));
			dispatch(sendScoreToParentFrame());
		}
	};

export const sendScoreToParentFrame = (): AppThunk => (dispatch, getState) => {
	// Get score from store
	const score = getState().score;
	// Send score to parent frame
	window.parent.postMessage(score, '*');
};
