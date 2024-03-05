/** @format */

import { Divider } from "@mui/material";
import "./Slider.css";
import { useState } from "react";
import SlideContainer from "./SlideContainer";
interface SliderProps {
  sliderValue: number;
  dragSlider: (e: any) => void;
  resetSlider: () => void;
  hidden?: boolean;
  needsPress?: boolean;
  orientation?: "horizontal" | "vertical";
}

/**
 * The slider component
 * @description - the slider component is used to show the user how much of the image they have drawn
 * @param sliderValue - the value of the slider *
 * @param dragSlider - the function that is called when the slider is dragged, ie when the mouse is moved over the slider
 * @param resetSlider - the function that is called when the slider is released, ie when the mouse leaves the slider
 */
export const Slider = ({
  sliderValue,
  dragSlider,
  resetSlider,
  needsPress = false,
  orientation = "vertical",
}: SliderProps) => {
  const [hideSlider, setHideSlider] = useState<boolean>(true);
  // create a state for listening when the mouse is pressed
  const [mousePressed, setMousePressed] = useState<boolean>(false);
  const [mouseDragged, setMouseDragged] = useState<boolean>(false);
  const [newSliderValue, setNewSliderValue] = useState<number>(sliderValue);

  const handleMouseDrag = (e: any) => {
    if (needsPress && mousePressed) {
      setMouseDragged(true);
      console.log("mouse dragged");
      dragSlider(e);
      // give mouse x and y coordinates
      let x = e.clientX;
      let y = e.clientY;
      console.log("x", x, "y", y);
      console.log("hideSlider", hideSlider);
    }
    if (!needsPress) {
      setMouseDragged(true);
      console.log("mouse dragged");
      dragSlider(e);
    }
    // console.log("mouse dragged");
    // dragSlider(e);
  };
  const handleMouseLeave = (e: any) => {
    console.log("mouse left");
    setHideSlider(true);
    resetSlider();
    console.log("sliderValue", sliderValue);
  };

  const handleMousePress = (e: any) => {
    console.log("mouse pressed");
    setMousePressed(true);
    setHideSlider(false);
  };

  const handleMouseRelease = (e: any) => {
    console.log("mouse released");
    setMousePressed(false);
    setMouseDragged(false);
    setHideSlider(true);
    // set the new slider value
    const x = e.clientX;
    const sliderWidth = window.innerWidth;
    const newSliderValue = (x / sliderWidth) * 100;
    setNewSliderValue(newSliderValue);
    resetSlider();
  };

  return (
    <>
      <Divider
        orientation={orientation}
        flexItem
        sx={{
          minWidth: "5px",
          minHeight: "5px",
          height: orientation === "vertical" ? "100%" : "5px",
          width: orientation === "horizontal" ? "100%" : "5px",
          // borderLeft: "2px solid #222",
          // dont make this occupy space
          position: "relative",

          backgroundColor: "#111",
          zIndex: hideSlider ? 11 : 50,
          cursor: orientation === "horizontal" ? "ns-resize" : "ew-resize",
        }}
        onMouseEnter={() => {
          console.log("mouse entered");

          setHideSlider(false);
        }}
        // listen for on drag events
        onMouseMove={handleMouseDrag}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMousePress}
        onMouseUp={handleMouseRelease}
      />
      <SlideContainer
        opacity={mouseDragged ? 0.25 : 0}
        background={"#222"}
        zIndex={hideSlider ? 4 : 5}
        // hidden={hideSlider}
        hidden={hideSlider}
      >
        {/* <input
          type="range"
          min="0"
          max="100"
          value={newSliderValue}
          className="slider"
          id="myRange"
          onMouseMove={handleMouseDrag}
          onChange={() => {}}
        /> */}
      </SlideContainer>
    </>
  );
};
