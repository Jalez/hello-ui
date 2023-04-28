/** @format */

import { useAppDispatch, useAppSelector } from '../../store/hooks/hooks';
import pixelmatch from 'pixelmatch';
import { Buffer } from 'buffer';
import { updateLevel } from '../../store/slices/levels.slice';
import { updatePointsThunk } from '../../store/actions/score.actions';
import { useEffect } from 'react';

export const PixelMatch = () => {
	const dispatch = useAppDispatch();
	const { currentLevel } = useAppSelector((state) => state.currentLevel);
	const level = useAppSelector((state) => state.levels[currentLevel - 1]);

	// useEffect(() => {
	// 	if (level?.solutionUrl && level?.drawingUrl) compareImages(level);
	// }, [level.drawingUrl, level.solutionUrl]);

	const compareImages = async (level = { solutionUrl: '', drawingUrl: '' }) => {
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

		console.log('COMPARING IMAGES: ', level?.solutionUrl, level?.drawingUrl);

		const img1 = new Image();
		img1.src = level?.solutionUrl;
		const img2 = new Image();
		img2.src = level?.drawingUrl;

		img1.onload = imageLoaded;
		img2.onload = imageLoaded;
		// Wait for the image to load
		let imagesLoaded = 0;
		function imageLoaded() {
			imagesLoaded++;
			if (imagesLoaded == 2) {
				allImagesLoaded();
			}
		}

		const allImagesLoaded = async () => {
			// console.log('COMPARING IMAGES: ', level?.solutionUrl, level?.drawingUrl);
			// set the src of the image to the data url
			const img1Data = (await getPixelData(img1)) as ImageData;
			const img2Data = (await getPixelData(img2)) as ImageData;

			// Create a diff image with the same dimensions as img1
			const diff = Buffer.alloc(img2Data.data.length as number) as Buffer;
			const width = img1Data?.width;
			const height = img1Data?.height;
			console.log('height: ', height, 'width: ', width);
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
			console.log('RETURN VALUE: ', returnValue);
			dispatch(
				updateLevel({
					id: currentLevel,
					diff: diff.toString('base64'),
					accuracy: returnValue as number,
				})
			);
			dispatch(updatePointsThunk(returnValue as number));
		};
	};

	return <></>;
};
