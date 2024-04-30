import { FormControl, IconButton, Input } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { useState } from "react";
import { Check } from "@mui/icons-material";

interface InputProps {
  actionToDispatch: any;
  reduxState: string;
  dataType?: string;
  finishEditHandler?: () => void;
}

const InfoInput = ({
  reduxState,
  actionToDispatch,
  dataType,
  finishEditHandler,
}: InputProps) => {
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
  };

  const handleUpdate = () => {
    dispatch(actionToDispatch({ levelId: currentLevel, text: value }));
    finishEditHandler && finishEditHandler();
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleUpdate();
      }}
    >
      <FormControl
        fullWidth
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          m: 0,
          p: 0,
        }}
      >
        <Input
          color="primary"
          sx={{
            color: "primary.main",
            // make the width as small as possible, based on the content
            width: "40px",
          }}
          type={dataType}
          value={value}
          onChange={handleChange}
        />
        <IconButton color="primary" onClick={handleUpdate}>
          <Check />
        </IconButton>
      </FormControl>
    </form>
  );
};

export default InfoInput;
