import { styled } from "@mui/system";
import { drawBoardheight } from "../../../../../../constants";

export const StyledSlider = styled("input")<{ height: number }>`
  -webkit-appearance: none; /* Override default CSS styles */
  appearance: none;
  width: 100%;
  height: 100%;
  margin: 0px;
  background: none;
  opacity: 0.0001; /* Set transparency (for mouse-over effects on hover) */
  -webkit-transition: 0.5s; /* 0.2 seconds transition on hover */
  transition: opacity 0.5s;
  border-radius: 0px;
  border: none;
  cursor: col-resize; /* Cursor on hover */

  &:hover {
    opacity: 1; /* Fully visible on mouse-over */
  }
  &::-webkit-slider-thumb {
    -webkit-appearance: none; /* Override default look */
    appearance: none;
    width: 2px;
    height: ${(props) => props.height}px;
    background: #000000;
    border-radius: 0px; /* no rounded corners */
  }

  &::-moz-range-thumb {
    appearance: none;
    border: none;
    width: 2px; /* Set a specific slider handle width */
    height: ${(props) => props.height}px; /* Custom height */
    background: #000000;
    border-radius: 0px;
  }
`;
