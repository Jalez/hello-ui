import { styled } from "@mui/system";
import { FC } from "react";

interface SlideContainerProps {
  opacity: number;
  background: string;
  zIndex: number;
  children?: React.ReactNode;
  hidden?: boolean;
  onMouseMove?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseLeave?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseUp?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
}

const SlideContainer: FC<SlideContainerProps> = styled(
  "div"
)<SlideContainerProps>`
  display: ${(props) => (props.hidden ? "none" : "block")};
  position: absolute;
  margin: 0px;
  padding: 0px;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  opacity: ${(props) => props.opacity};
  background: ${(props) => props.background};
  // background: yellow;
  z-index: ${(props) => props.zIndex};
  cursor: col-resize;
`;

export default SlideContainer;
