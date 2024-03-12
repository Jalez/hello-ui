import { StyledInfoBoard } from "./Styled/StyledInfoBoard";
import { StyledInfoBoardContainer } from "./Styled/StyledInfoBoardContainer";
import { StyledChildContainer } from "./Styled/StyledChildContainer";

interface InfoBoardProps {
  children: any;
}

export const InfoBoard = ({ children }: InfoBoardProps) => {
  return (
    <StyledInfoBoard id="info-board">
      <StyledInfoBoardContainer id="info-board-container">
        {/* map through children */}
        {children
          ? children.map((child: any, index: number) => (
              <StyledChildContainer key={index}>{child}</StyledChildContainer>
            ))
          : null}
      </StyledInfoBoardContainer>
    </StyledInfoBoard>
  );
};
