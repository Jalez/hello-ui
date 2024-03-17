/** @format */

import { Button } from "@mui/material";

// create interface for props
interface NavButtonProps {
  clickHandler: any;
  children: any;
  disabled?: boolean;
}

const btnStyle: React.CSSProperties = {
  fontFamily: "Kontakt",
  flex: 1,
  boxSizing: "border-box",
  border: "2px solid #111",
  fontSize: 30,
  minWidth: "fit-content",
  fontWeight: "bold",
};

export const NavButton = ({
  clickHandler,
  children,
  disabled,
}: NavButtonProps) => {
  return (
    <Button onClick={clickHandler} style={btnStyle} disabled={disabled}>
      {children}
    </Button>
  );
};
