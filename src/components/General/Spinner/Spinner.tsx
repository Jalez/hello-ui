/** @format */

import { useTheme } from "@mui/system";
import { secondaryColor } from "../../../constants";
import "./Spinner.css";

type SpinnerProps = {
  height: number;
  width: number;
};

export const Spinner = ({ height, width }: SpinnerProps): JSX.Element => {
  const theme = useTheme();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: height + "px",
        width: width + "px",
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
        <circle className="path" fill="none" cx="33" cy="33" r="30" />
      </svg>
    </div>
  );
};
