/** @format */

import { useTheme } from "@mui/system";
import { secondaryColor } from "../../../constants";
import "./Spinner.css";
import { Typography } from "@mui/material";

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
        flexDirection: "column",
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
      <Typography
        variant="h6"
        sx={{
          color: theme.palette.primary.main,
        }}
      >
        Loading solution image...
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: theme.palette.primary.main,
          textAlign: "center",
        }}
      >
        (If this takes too long, please refresh the page. This is a known issue
        and will be fixed in the future.)
      </Typography>
    </div>
  );
};
