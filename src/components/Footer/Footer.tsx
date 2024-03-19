/** @format */

import { styled, Theme } from "@mui/system";

const FooterStyled = styled("footer")(
  ({ theme }: { theme: Theme }) => `
  // margin: 10px;
  text-align: center;
  padding: 10px;
  width: 100%;
  height: fit-content;
  background-color: ${theme.palette.secondary.main};
  color: ${theme.palette.primary.main};
  z-index: 50;
  pointer-events: none;
  font-size: 0.5rem;
`
);

const LinkStyled = styled("a")`
  color: #f5c518;
  text-shadow: 1px 1px 1px #000;
  text-decoration: none;
  margin: 10px;
  pointer-events: visible;
`;

export const Footer = () => {
  return (
    <FooterStyled>
      Inspired by
      <LinkStyled
        href="https://cssbattle.dev/"
        target="_blank"
        rel="noreferrer"
      >
        CSS Battle
      </LinkStyled>
    </FooterStyled>
  );
};
