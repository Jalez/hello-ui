/** @format */

const initialState = {
	points: 0,
	maxPoints: 20,
};

// create type interface for the state
export interface ScoreState {
	points: number;
	maxPoints: number;
}
// create type interface for the action
interface Action {
	type: string;
	payload: number;
}

export const scoreReducer = (state = initialState, action: Action) => {
	switch (action.type) {
		case 'UPDATE_POINTS':
			return {
				...state,
				points: action.payload,
			};

		case 'UPDATE_MAX_POINTS':
			return {
				...state,
				maxPoints: action.payload,
			};
		default:
			return state;
	}
};
