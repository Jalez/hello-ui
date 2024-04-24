import { Input } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { useState } from "react";

interface InputProps {
  actionToDispatch: any;
  reduxState: string;
}

const InfoInput = ({ reduxState, actionToDispatch }: InputProps) => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const detail = useAppSelector(
    (state: any) => state.levels[currentLevel - 1][reduxState]
  );
  const [value, setValue] = useState(detail);

  const dispatch = useAppDispatch();
  const handleChange = (e: any) => {
    setValue(e.target.value);
    dispatch(actionToDispatch({ levelId: currentLevel, text: e.target.value }));
  };
  console.log("value", value);
  return (
    <Input
      color="primary"
      sx={{
        color: "primary.main",
        // make the width as small as possible, based on the content
        width: "40px",
      }}
      type="number"
      value={value}
      onChange={handleChange}
    />
  );
};

export default InfoInput;
