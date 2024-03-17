/** @format */

import { FormControlLabel, Switch, Typography } from "@mui/material";

interface InfoSwitchProps {
  switchHandler: () => void;
  label: string;
  checked: boolean;
}

export const InfoSwitch = ({
  label,
  switchHandler,
  checked,
}: InfoSwitchProps) => {
  return (
    <FormControlLabel
      control={
        <Switch
          color="primary"
          checked={checked}
          onChange={() => switchHandler()}
        />
      }
      style={{
        userSelect: "none",
      }}
      label={<Typography variant="body1">{label}</Typography>}
      labelPlacement="start"
    />
  );
};
