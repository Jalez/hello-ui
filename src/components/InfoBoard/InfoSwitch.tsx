/** @format */

import styled from "@emotion/styled";
import { Stack, Switch, Typography, alpha } from "@mui/material";
import { pink } from "@mui/material/colors";
import { Theme, useTheme } from "@mui/material/styles";
import { useCallback } from "react";

interface InfoSwitchProps {
  switchHandler: () => void;
  rightLabel: string;
  leftLabel: string;
  checked: boolean;
}

const PinkSwitch = styled(Switch)(({ theme }: { theme: Theme }) => ({
  "& .MuiSwitch-switchBase.Mui-checked": {
    color: pink[600],
    "&:hover": {
      backgroundColor: alpha(pink[300], theme.palette.action.hoverOpacity),
    },
  },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
    backgroundColor: pink[600],
  },
  // change the color of the whole switch when it's not checked
  "& .MuiSwitch-switchBase": {
    color: pink[600],
  },
  "& .MuiSwitch-switchBase + .MuiSwitch-track": {
    backgroundColor: pink[300],
  },
}));

export const InfoSwitch = ({
  rightLabel,
  leftLabel,
  switchHandler,
  checked,
}: InfoSwitchProps) => {
  const theme = useTheme();

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        color: theme.palette.primary.main,
      }}
    >
      <Typography
        sx={{
          userSelect: "none",
        }}
      >
        {leftLabel}
      </Typography>
      <PinkSwitch theme={theme} checked={checked} onChange={switchHandler} />

      <Typography
        sx={{
          userSelect: "none",
        }}
      >
        {rightLabel}
      </Typography>
    </Stack>
  );
};
