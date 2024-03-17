import React, { useState } from "react";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { styled } from "@mui/system";

interface NavButtonProps {
  clickHandler: any;
  children: any;
  menuItems: Array<String>;
}

const StyledNavContainer = styled("div")(({ theme }) => ({
  fontFamily: "Kontakt",
  flex: 1,
  color: theme.palette.secondary.main,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
}));

const StyledButton = styled(Button)({
  border: "2px solid #111",
  fontFamily: "Kontakt",
  flex: "1 0 100%",
  fontSize: 30,
  fontWeight: "bold",
});

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  fontFamily: "Kontakt",
  fontSize: 30,
  color: theme.palette.secondary.main,
  display: "flex",
  width: "100%",
}));

export default function NavMenu({
  clickHandler,
  children,
  menuItems,
}: NavButtonProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const handleMenuItemClick = (event: React.MouseEvent<HTMLElement>) => {
    clickHandler(event.currentTarget.textContent);
    setAnchorEl(null);
  };

  return (
    <StyledNavContainer>
      <StyledButton
        id="fade-button"
        aria-controls={open ? "fade-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
      >
        {children}
      </StyledButton>
      <Menu
        MenuListProps={{
          "aria-labelledby": "fade-button",
        }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          horizontal: "center",
          vertical: "top",
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        {menuItems.map((item, index) => (
          <StyledMenuItem key={index} onClick={handleMenuItemClick}>
            {item}
          </StyledMenuItem>
        ))}
      </Menu>
    </StyledNavContainer>
  );
}
