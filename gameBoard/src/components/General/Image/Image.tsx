/** @format */

import { Box } from "@mui/material";
import { Spinner } from "../Spinner/Spinner";

// interface
interface ModelProps {
  imageUrl: string;
  height: number;
  width: number;
  name?: string;
}

export const Image = ({
  imageUrl,
  height,
  width,
  name,
}: ModelProps): JSX.Element => {
  // if (name) console.log(name, height, width);
  return (
    <Box
      aria-label={name ? name + " image" : "image"}
      sx={{
        margin: 0,
        height: height + "px",
      }}
    >
      <div>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="
					The image that the user will draw a copy of
					"
            width={width}
          />
        ) : (
          <Spinner height={height} width={width} />
        )}
      </div>
    </Box>
  );
};
