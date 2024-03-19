/** @format */

import styled from "@emotion/styled";
import {
  FormControlLabel,
  Stack,
  Switch,
  Typography,
  alpha,
} from "@mui/material";
import { pink } from "@mui/material/colors";
import { Theme, useTheme } from "@mui/material/styles";

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
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography
        style={{
          userSelect: "none",
        }}
      >
        {leftLabel}
      </Typography>
      <PinkSwitch
        theme={theme}
        checked={checked}
        onChange={() => switchHandler()}
        // add border to switch
      />
      {/* <AntSwitch defaultChecked inputProps={{ 'aria-label': 'ant design' }} /> */}
      <Typography
        style={{
          userSelect: "none",
        }}
      >
        {rightLabel}
      </Typography>
    </Stack>
    // <FormControlLabel
    //   control={
    //   }
    //   style={{
    //     userSelect: "none",
    //   }}
    //   label={<Typography variant="body1">{label}</Typography>}
    //   labelPlacement="start"
    // />
  );
};
