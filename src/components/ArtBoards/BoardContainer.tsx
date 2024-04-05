import { styled } from "@mui/system";

interface BoardContainerProps {
  width: number;
}

const defaultWidthAddition = 100;
const BoardContainer = styled("div")<BoardContainerProps>`
  display: flex;
  flexdirection: row;
  justifycontent: center;
  alignitems: center;
  flex: 1 0 auto;
  flexshrink: 0;
  margin: 0.5em;
  width: ${(props) => props.width}px;
`;

export { BoardContainer };
