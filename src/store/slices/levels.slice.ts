/** @format */

import { createSlice } from '@reduxjs/toolkit';
import placeholder from '../../assets/Placeholder.svg';

const url = import.meta.env.LOCAL_TESTING_URL;

import confetti from 'canvas-confetti';
import { generateGridLevel } from '../../utils/generators/gridMaker';
import { flexboxMaker } from '../../utils/generators/flexboxMaker';

// Remove these static width and height values
const width = 400;
const height = 300;
const maxCodeLength = 100000;

// interface for initial state
interface Level {
	id: number;
	name: string;
	completed: string;
	accuracy: string;
	buildingBlocks?: {
		pictures?: Array<string>;
		colors?: Array<string>;
	};
	code: {
		html: string;
		css: string;
	};
	solution: {
		html: string;
		css: string;
	};
	image: string;
	diff: string;
	difficulty: string;
	points: number;
	maxPoints: number;
	help: {
		description: string;
		images: string[];
		usefullCSSProperties: string[];
	};
	drawingUrl: string;
	solutionUrl: string;
	drawnEvalUrl: string;
	solEvalUrl: string;
}
const primaryColor = '#D4AF37';
const secondaryColor = '#222';
const initialHtml: string = `<div></div>`;
const initialCss: string = `body {
	margin: 0px;
	background-color: ${secondaryColor};
}
div {
	width: 100px;
	height: 50px;
	background-color: ${primaryColor};
}`;
const initialCode = {
	html: initialHtml,
	css: initialCss,
};

const initialDefaults = {
	completed: 'no',
	accuracy: '0',
	code: initialCode,
	points: 0,
	maxPoints: 5,
	diff: '',
	drawingUrl: '',
	solutionUrl: '',
	drawnEvalUrl: '',
	solEvalUrl: '',
	solution: {
		html: '',
		css: '',
	},
};
// Get initial state from local storage
let initialState: Level[] = JSON.parse(
	localStorage.getItem('ui-designer-layout-levels') || '[]'
);
// get current time in milliseconds
const currentTime = new Date().getTime();
// get the time the user started the game
const lastUpdated = localStorage.getItem(
	'ui-designer-layout-levels-start-time'
);
// if the user started the game more than 12 hours ago, reset the state
// const twhours = 43200000;
// for testing purposes, set the time to 1 second
const twhours = 1000;
if (lastUpdated && currentTime - parseInt(lastUpdated) > twhours) {
	console.log('Resetting timer');
	initialState = [];
	localStorage.setItem(
		'ui-designer-layout-levels-start-time',
		currentTime.toString()
	);
}

// if there is no initial state, set it to the default state
if (initialState.length === 0) {
	console.log("There's no initial state, setting it to default");

	const createLevels = () => {
		for (let i = 1; i <= 2; i++) {
			let randomLevel = {
				image: placeholder,
				colors: ['#fff'],
				pictures: [],
			};
			let difficulty = i === 1 ? 'Task 1' : 2 === 2 ? 'Task 2' : 'Task 3';

			// // If the level is 1, get random easy level and set difficulty to easy
			// if (i === 1) {
			// 	randomLevel = levels[i][Math.floor(Math.random() * levels[i].length)];
			// 	difficulty = 1 === 1 ? 'easy' : 2 === 2 ? 'medium' : 'hard';
			// }

			let generatedLevelDetails;
			// If the level is one, lets give them flexbox
			if (i === 1) {
				generatedLevelDetails = flexboxMaker(primaryColor, secondaryColor);
			}
			// if the level is 2, lets give them grid
			else {
				generatedLevelDetails = generateGridLevel(primaryColor, secondaryColor);
			}

			const level = {
				id: i,
				name: `Level ${i}`,

				buildingBlocks: {
					pictures: randomLevel.pictures,
					colors: [primaryColor, secondaryColor],
				},
				...initialDefaults,
				code: {
					html: generatedLevelDetails.HTML,
					css: generatedLevelDetails.TCSS,
				},
				image: '',
				difficulty,
				help: {
					description: 'NO help available',
					images: [],
					usefullCSSProperties: [],
				},
				solution: {
					html: generatedLevelDetails.HTML,
					css: generatedLevelDetails.SCSS + generatedLevelDetails.TCSS,
				},
			};
			initialState.push(level);
		}
	};

	createLevels();
} else {
	// if there is an initial state, set the code to the initial code
	initialState.forEach((level) => {
		level.points = 0;
		level.accuracy = '0';
	});
}

const levelsSlice = createSlice({
	name: 'levels',
	initialState: initialState as Level[],

	reducers: {
		updateLevel(state, action) {
			const { id, accuracy, diff } = action.payload;
			const level = state.find((level) => level.id === id);
			if (!level) return;
			level.accuracy = accuracy;
			// Get the percentage of pixels that are different
			let percentage = 100 - (accuracy / (width * height)) * 100;

			// if percentage is over 90, use confetti
			if (percentage > 90) {
				if (percentage > 98) confetti({ particleCount: 100 });
				// Calculate the points based on the last 10 percent
				const lastTenPercent = percentage - 90;
				const lastTenPercentPercentage = lastTenPercent / 10;
				level.points = Math.ceil(lastTenPercentPercentage * level.maxPoints);
				// set level completed to yes
				level.completed = 'yes';
			}
			// If percentage is less than 90, set points to 0
			else {
				level.points = 0;
			}

			// Round the percentage to 2 decimal places
			level.accuracy = percentage.toFixed(2);
			level.diff = diff;
			// update the level in local storage
			localStorage.setItem('ui-designer-layout-levels', JSON.stringify(state));
		},
		updateCode(state, action) {
			const { id, code } = action.payload;
			const level = state.find((level) => level.id === id);
			// check that code doesnt contain level solution in it
			//check if html or css length is over 100000, do nothing
			if (
				(code.html && code.html.length > maxCodeLength) ||
				(code.css && code.css.length > maxCodeLength)
			) {
				console.log('Code is too long!');
				return;
			}

			if (code.css.includes(level?.image) || code.html.includes(level?.image)) {
				console.log("Using the solutions own image url isn't allowed!");
				return;
			}

			// cant include "script" in code
			if (code.html.includes('script')) {
				console.log("Using scripts isn't allowed!");
				return;
			}

			if (!level) return;
			level.code = code;
			// update the code for the level in local storage
			localStorage.setItem('ui-designer-layout-levels', JSON.stringify(state));
		},
		updateSolution(state, action) {
			const { id, solution } = action.payload;
			const level = state.find((level) => level.id === id);
			if (!level) return;
			// level.solution = solution;
			// update the code for the level in local storage
			localStorage.setItem('ui-designer-layout-levels', JSON.stringify(state));
		},
		updateUrl(state, action) {
			if (!action.payload) return;

			const { id, dataURL, urlName } = action.payload;
			if (urlName === 'drawingUrl') state[id - 1].drawingUrl = dataURL;
			else if (urlName === 'solutionUrl') {
				state[id - 1].solutionUrl = dataURL;
				// set image
				state[id - 1].image = dataURL;
			}
			// update the code for the level in local storage
			localStorage.setItem('ui-designer-layout-levels', JSON.stringify(state));
		},
		updateEvaluationUrl(state, action) {
			const { id, dataUrl, name } = action.payload;
			if (name === 'drawing') state[id - 1].drawnEvalUrl = dataUrl;
			if (name === 'solution') state[id - 1].solEvalUrl = dataUrl;

			// update the code for the level in local storage
			localStorage.setItem('ui-designer-layout-levels', JSON.stringify(state));
		},
	},
});

export const { updateLevel, updateCode, updateUrl, updateEvaluationUrl } =
	levelsSlice.actions;

export default levelsSlice.reducer;
