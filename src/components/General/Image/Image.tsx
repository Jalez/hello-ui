/** @format */

import { drawBoardWidth, drawBoardheight } from "../../../constants";
import { Spinner } from "../Spinner/Spinner";

// interface
interface ModelProps {
  imageUrl: string;
  name: string;
}

export const Image = ({ imageUrl, name }: ModelProps): JSX.Element => {
  return (
    <div
      style={{
        margin: 0,
        height: drawBoardheight + "px",
      }}
    >
      <div>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="
					The image that the user will draw a copy of
					"
            width={drawBoardWidth}
          />
        ) : (
          <Spinner />
        )}
      </div>
    </div>
  );
};
