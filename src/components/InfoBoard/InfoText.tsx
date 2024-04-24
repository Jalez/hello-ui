/** @format */

import { Box, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";

// create prop interface
interface NavTextProps {
  children: any;
}
/**
 * @description InfoText is a component that displays text in the InfoBoard component
 * @param {NavTextProps} props - props for component,
 * @param {any} props.children - children of component
 * @returns {JSX.Element}
 */
export const InfoText = ({ children }: NavTextProps) => {
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  // if in creator mode, show an input instead of text
  if (isCreator) {
    return <Box>{children}</Box>;
  }
  return (
    <Typography
      sx={{
        textAlign: "center",
        userSelect: "none",
      }}
    >
      {children}
    </Typography>
  );
};
