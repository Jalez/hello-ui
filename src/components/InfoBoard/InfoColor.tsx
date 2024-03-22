/** @format */

import { Box, Popover, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { mainColor, secondaryColor } from "../../constants";

interface InfoColorProps {
  color: string;
}

export const InfoColor = ({ color }: InfoColorProps): JSX.Element | null => {
  const [popUp, setPopUp] = useState(false);
  const colorRef = useRef<HTMLParagraphElement>(null);
  // Get the color code from the state

  // get the current level from the store state

  useEffect(() => {
    if (popUp) {
      setTimeout(() => {
        setPopUp(false);
      }, 500);
    }
  }, [popUp]);

  const clickHandler = (
    event: React.MouseEvent<HTMLParagraphElement, MouseEvent>
  ) => {
    // When the p is clicked, copy the color code to the clipboard
    navigator.clipboard.writeText(color);
    // alert the user that the color code has been copied
    // alert('Copied to clipboard');
    setPopUp(true);
  };

  return (
    <Box
      sx={{
        width: "100%",
      }}
    >
      <Popover
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        anchorEl={colorRef.current}
        open={popUp}
      >
        <Typography
          sx={{
            margin: 0,
          }}
        >
          Copied to the clipboard
        </Typography>
      </Popover>
      <Box
        ref={colorRef}
        onClick={clickHandler}
        sx={{
          // make p display box
          display: "flex",
          flexDirection: "row",
          marginLeft: "0.5em",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          className="color-box"
          sx={{
            backgroundColor: color,
            height: "20px",
            width: "20px",
            boxSizing: "border-box",
            borderRadius: "50%",
            border: `0.1em solid #444`,
            // Dont allow the user to select the color box
            userSelect: "none",
          }}
        />
        <Typography
          sx={{
            userSelect: "none",
            // remove margin and padding
            margin: 0,
            marginLeft: "0.5em",
            // backgroundColor: "yellow",
            fontSize: "0.8rem",
          }}
        >
          {color}
        </Typography>
      </Box>
    </Box>
  );
};
