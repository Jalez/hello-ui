/** @format */

import { useDispatch } from 'react-redux/es/hooks/useDispatch';
import { domToPng } from 'modern-screenshot';

import { setCurrentLevel } from '../../../store/slices/currentLevel.slice';
import HelpModal from '../../Help/Help';
import { NavButton } from '../NavButton';
import NavMenu from '../NavMenu';
// import pixelmatch from 'pixelmatch';
import { Buffer } from 'buffer';
import {
	sendScoreToParentFrame,
	updatePointsThunk,
} from '../../../store/actions/score.actions';

import './ThreeNavs.css';
import { useAppDispatch, useAppSelector } from '../../../store/hooks/hooks';
import { updateLevel } from '../../../store/slices/levels.slice';
import pixelmatch from 'pixelmatch';

export const ThreeNavs = () => {
	const dispatch = useAppDispatch();
	const levels = useAppSelector((state) => state.levels);
	const { currentLevel } = useAppSelector((state) => state.currentLevel);

	// get difficulties in an array from the levels
	const difficulties = levels.map((level) => level.difficulty);

	const beginEvaluation = () => {
		const getPixelData = (img = new Image()) => {
			return new Promise((resolve, reject) => {
				// Create a canvas element
				const canvas = document.createElement('canvas');
				// Set the width and height of the canvas to the width and height of the image
				canvas.width = img.width;
				canvas.height = img.height;
				// Get the 2D context of the canvas
				const ctx = canvas.getContext('2d');
				// Draw the image on the canvas
				ctx?.drawImage(img, 0, 0);
				// Get the image data from the canvas
				const imgData = ctx?.getImageData(0, 0, 400, 300);
				// Resolve the promise with the image data
				resolve(imgData);
			});
		};
		// get the image urls from the current level
		const { image, drawnEvalUrl } = levels[currentLevel - 1];

		const drawnImage = new Image();
		drawnImage;
		const solutionImage = new Image();

		drawnImage.src = image;
		drawnImage.onload = imageLoaded;

		solutionImage.src = drawnEvalUrl;
		solutionImage.onload = imageLoaded;

		// Wait for the image to load
		let imagesLoaded = 0;
		function imageLoaded() {
			imagesLoaded++;
			if (imagesLoaded == 2) {
				allImagesLoaded();
				dispatch(sendScoreToParentFrame());
			}
		}

		const allImagesLoaded = async () => {
			// console.log('COMPARING IMAGES: ', level?.solutionUrl, level?.drawingUrl);
			// set the src of the image to the data url
			const img1Data = (await getPixelData(drawnImage)) as ImageData;
			const img2Data = (await getPixelData(solutionImage)) as ImageData;

			// Create a diff image with the same dimensions as img1
			const diff = Buffer.alloc(img2Data.data.length as number) as Buffer;
			const width = img1Data?.width;
			const height = img1Data?.height;
			const returnValue = pixelmatch(
				img2Data?.data,
				img1Data?.data,
				diff,
				width,
				height,
				{
					threshold: 0.1,
				}
			);
			dispatch(
				updateLevel({
					id: currentLevel,
					diff: diff.toString('base64'),
					accuracy: returnValue as number,
				})
			);
			dispatch(updatePointsThunk(returnValue as number));
		};
		// allImagesLoaded();
	};

	const levelChanger = (pickedLevel: any) => {
		// get the level object from the levels array
		const level = levels.find((level) => level.difficulty === pickedLevel);
		if (level) {
			// dispatch the levels id to the store as the current level
			dispatch(setCurrentLevel(level.id));
		}
	};

	return (
		<div id='three-navs'>
			<HelpModal />
			<NavButton clickHandler={beginEvaluation}>Evaluate</NavButton>
			<NavMenu clickHandler={levelChanger} menuItems={difficulties}>
				Levels
			</NavMenu>
		</div>
	);
};
