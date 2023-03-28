/** @format */

import { createSlice } from '@reduxjs/toolkit';

// Get from assets
import Easy1 from '../../assets/Easy1.png';
import Easy2 from '../../assets/Easy2.png';
import Medium2 from '../../assets/Medium2.png';
import Hard3 from '../../assets/Hard3.png';
import placeholder from '../../assets/Placeholder.svg';
import button from '../../assets/button.png';
import card from '../../assets/card.png';
import cardWithImage from '../../assets/cardWithImage.png';
import couple from '../../assets/PictureGallery/couple.jpg';
import desert from '../../assets/PictureGallery/desert.jpg';
import dog from '../../assets/PictureGallery/dog.jpg';
import oldartist from '../../assets/PictureGallery/oldartist.jpg';
import me from '../../assets/PictureGallery/me.jpg';
import PictureGallery from '../../assets/PictureGallery.png';

const url = import.meta.env.LOCAL_TESTING_URL;

import confetti from 'canvas-confetti';

// Remove these static width and height values
const width = 400;
const height = 300;

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
	// solution: {
	// 	html: string;
	// 	css: string;
	// };
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

const initialHtml: string = `<div></div>`;
const initialCss: string = `
body {
	margin: 0px;
	background-color: #222;
}
div {
	width: 100px;
	height: 100px;
	background-color: yellow;
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
};
// Get initial state from local storage
let initialState: Level[] = JSON.parse(
	localStorage.getItem('css-artist-1-levels') || '[]'
);
// if there is no initial state, set it to the default state
if (initialState.length === 0) {
	console.log("There's no initial state, setting it to default state");
	initialState = [
		{
			id: 1,
			name: 'Level 1',

			buildingBlocks: {
				pictures: [],
				colors: ['#1e88e5', '#f5f5f5'],
			},
			...initialDefaults,

			image: button,
			difficulty: 'button',
			help: {
				description: 'This is the first level',
				images: [],
				usefullCSSProperties: [],
			},
		},
		{
			id: 2,
			name: 'Level 2',

			buildingBlocks: {
				pictures: [],
				colors: ['#1e88e5', '#f5f5f5'],
			},
			...initialDefaults,

			image: card,
			difficulty: 'card',
			help: {
				description: 'This is the first level',
				images: [],
				usefullCSSProperties: [],
			},
		},
		{
			id: 3,
			name: 'Level 3',

			buildingBlocks: {
				pictures: [placeholder],
				colors: ['#1e88e5', '#f5f5f5'],
			},
			...initialDefaults,
			image: cardWithImage,
			difficulty: 'card with image',
			help: {
				description: 'This is the first level',
				images: [],
				usefullCSSProperties: [],
			},
		},
		{
			id: 4,
			name: 'Level 4',
			...initialDefaults,
			image: PictureGallery,
			buildingBlocks: {
				pictures: [couple, desert, dog, oldartist, me],
				colors: ['#62374E', '#FDC57B'],
			},

			difficulty: 'Picture Gallery',
			help: {
				description: 'This is the first level',
				images: [],
				usefullCSSProperties: [],
			},
		},
	];
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
				if (percentage == 100) confetti({ particleCount: 100 });
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
			localStorage.setItem('css-artist-1-levels', JSON.stringify(state));
		},
		updateCode(state, action) {
			const { id, code } = action.payload;
			const level = state.find((level) => level.id === id);
			if (!level) return;
			level.code = code;
			// update the code for the level in local storage
			localStorage.setItem('css-artist-1-levels', JSON.stringify(state));
		},
		updateSolution(state, action) {
			const { id, solution } = action.payload;
			const level = state.find((level) => level.id === id);
			if (!level) return;
			// level.solution = solution;
			// update the code for the level in local storage
			localStorage.setItem('css-artist-1-levels', JSON.stringify(state));
		},
		updateUrl(state, action) {
			if (!action.payload) return;

			const { id, dataURL, name } = action.payload;
			if (name === 'drawing') state[id - 1].drawingUrl = dataURL;
			else if (name === 'solution') state[id - 1].solutionUrl = dataURL;
			// update the code for the level in local storage
			localStorage.setItem('css-artist-1-levels', JSON.stringify(state));
		},
		updateEvaluationUrl(state, action) {
			const { id, dataUrl, name } = action.payload;
			if (name === 'drawing') state[id - 1].drawnEvalUrl = dataUrl;
			if (name === 'solution') state[id - 1].solEvalUrl = dataUrl;

			// update the code for the level in local storage
			localStorage.setItem('css-artist-1-levels', JSON.stringify(state));
		},
	},
});

export const { updateLevel, updateCode, updateUrl, updateEvaluationUrl } =
	levelsSlice.actions;

export default levelsSlice.reducer;
