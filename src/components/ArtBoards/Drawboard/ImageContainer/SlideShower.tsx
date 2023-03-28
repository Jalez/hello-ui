/** @format */

// components/ImageContainer/ImageContainer.tsx
import { CSSProperties, useState } from 'react';
import { Slider } from './Slider/Slider';

interface ImageContainerProps {
	slidingComponent: any;
	staticComponent: any;
}

export const SlideShower = ({
	slidingComponent,
	staticComponent,
}: ImageContainerProps) => {
	const [sliderValue, setSliderValue] = useState(100);

	const dragSlider = (e: any) => {
		const slider = e.target;
		const sliderRect = slider.getBoundingClientRect();
		const mousePos = e.clientX - sliderRect.left;
		const sliderPercent = (mousePos / sliderRect.width) * 100;
		setSliderValue(sliderPercent);
	};

	const resetSlider = () => {
		setSliderValue(100);
	};

	const slidingStyle: CSSProperties = {
		clipPath: `polygon(0 0, ${sliderValue}% 0, ${sliderValue}% 100%, 0 100%)`,
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		overflow: 'hidden',
	};

	return (
		<>
			{/* <Slider
				sliderValue={sliderValue}
				dragSlider={dragSlider}
				resetSlider={resetSlider}
			/> */}
			{staticComponent}
			<div style={slidingStyle}>{slidingComponent}</div>
		</>
	);
};
