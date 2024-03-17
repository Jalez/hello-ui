/** @format */

import { useTheme } from "@mui/system";
import {
  drawBoardWidth,
  drawBoardheight,
  secondaryColor,
} from "../../../constants";
import "./Spinner.css";

export const Spinner = () => {
  const theme = useTheme();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: drawBoardheight + "px",
        width: drawBoardWidth + "px",
        backgroundColor: theme.palette.secondary.main || secondaryColor,
      }}
    >
      <svg
        className="spinner"
        width="65px"
        height="65px"
        viewBox="0 0 66 66"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle className="path" fill="none" cx="33" cy="33" r="30"></circle>
      </svg>
    </div>
  );
};
