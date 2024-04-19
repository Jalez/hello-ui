/** @format */

// components/ImageContainer/ImageContainer.tsx
import { CSSProperties, useCallback, useState } from "react";
import { Slider } from "./Slider/Slider";
import { Box } from "@mui/material";

interface ImageContainerProps {
  slidingComponent: any;
  staticComponent: any;
  sliderHeight: number;
  showStatic: boolean;
}

export const SlideShower = ({
  slidingComponent,
  staticComponent,
  sliderHeight,
  showStatic,
}: ImageContainerProps) => {
  const [sliderValue, setSliderValue] = useState(100);

  const dragSlider = useCallback((e: any) => {
    const slider = e.target;
    const sliderRect = slider.getBoundingClientRect();
    const mousePos = e.clientX - sliderRect.left;
    const sliderPercent = (mousePos / sliderRect.width) * 100;
    setSliderValue(sliderPercent);
  }, []);

  const resetSlider = useCallback(() => {
    // console.log("resetting slider", sliderValue);
    setSliderValue(100);
  }, []);

  const slidingStyle: CSSProperties = {
    clipPath: `polygon(0 0, ${sliderValue}% 0, ${sliderValue}% 100%, 0 100%)`,
    position: showStatic ? "absolute" : "relative",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    overflow: "hidden",
  };

  return (
    <>
      {showStatic && (
        <>
          <Slider
            sliderValue={sliderValue}
            dragSlider={dragSlider}
            resetSlider={resetSlider}
            sliderHeight={sliderHeight}
          />
          {staticComponent}
        </>
      )}
      <Box sx={slidingStyle}>{slidingComponent}</Box>
    </>
  );
};
