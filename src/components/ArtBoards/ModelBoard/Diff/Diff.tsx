/** @format */
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import './Diff.css';
import { Buffer } from 'buffer';

export const Diff = () => {
	const { currentLevel } = useSelector((state: any) => state.currentLevel);
	const level = useSelector((state: any) => state.levels[currentLevel - 1]);
	// console.log(level.diff);
	// console.log(level.diff.length);
	useEffect(() => {
		if (level.diff.length === 0) return;
		// console.log('diff useEffect');
		const diff = document.getElementById('diff');
		if (diff) {
			diff.innerHTML = '';

			// create a canvas element and use the diff data to draw the image
			const width = 400;
			const height = 300;
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			const imgData = ctx?.createImageData(width, height);
			const deserializedDiff = Buffer.from(level.diff, 'base64');

			imgData?.data.set(deserializedDiff);
			ctx?.putImageData(imgData!, 0, 0);
			diff.appendChild(canvas);
		}
	}, [level.diff]);

	return (
		<div id='diff'>
			<p
				style={{
					textAlign: 'center',
				}}>
				No diff image created for this level yet. Click evaluate to generate.
			</p>
		</div>
	);
};
