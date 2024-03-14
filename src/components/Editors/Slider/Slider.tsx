import { Divider } from "@mui/material";
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

export const Slider = ({
  sliderValue,
  dragSlider,
  resetSlider,
  needsPress = false,
  orientation = "vertical",
}: SliderProps) => {
  const [hideSlider, setHideSlider] = useState<boolean>(true);
  const [mousePressed, setMousePressed] = useState<boolean>(false);
  const [mouseDragged, setMouseDragged] = useState<boolean>(false);
  const [newSliderValue, setNewSliderValue] = useState<number>(sliderValue);

  const handleMouseDrag = (e: any) => {
    if (needsPress && mousePressed) {
      setMouseDragged(true);
      if (orientation === "horizontal" && e.clientY > window.innerHeight - 40) {
        return;
      } else if (
        orientation === "vertical" &&
        (e.clientX > window.innerWidth - 200 || e.clientX < 200)
      ) {
        return;
      }
      dragSlider(e);
    }
    if (!needsPress) {
      setMouseDragged(true);
      dragSlider(e);
    }
  };

  const handleMouseLeave = (e: any) => {
    if (!mouseDragged) {
      setMousePressed(false);
      setHideSlider(true);
      resetSlider();
    }
  };

  const handleMousePress = (e: any) => {
    setMousePressed(true);
    setHideSlider(false);
  };

  const handleMouseRelease = (e: any) => {
    setMousePressed(false);
    setMouseDragged(false);
    setHideSlider(true);
    const x = e.clientX;
    const sliderWidth = window.innerWidth;
    setNewSliderValue((x / sliderWidth) * 100);
    resetSlider();
  };

  const handleMouseEnter = (e: any) => {
    if (mousePressed) setMousePressed(false);
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
          position: "relative",
          backgroundColor: "#111",
          zIndex: hideSlider ? 11 : 50,
          cursor: orientation === "horizontal" ? "ns-resize" : "ew-resize",
        }}
        onMouseEnter={handleMouseEnter}
        // onMouseMove={handleMouseDrag}
        // onMouseLeave={handleMouseLeave}
        onMouseDown={handleMousePress}
        // onMouseUp={handleMouseRelease}
      />
      <SlideContainer
        opacity={mousePressed ? 0.25 : 0}
        background={"#222"}
        zIndex={hideSlider ? 4 : 100}
        hidden={hideSlider}
        onMouseMove={handleMouseDrag}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseRelease}
      ></SlideContainer>
    </>
  );
};
