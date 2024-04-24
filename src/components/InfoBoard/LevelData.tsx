/** @format */

import { useAppSelector } from "../../store/hooks/hooks";
import InfoInput from "./InfoInput";

// create prop interface
interface LevelDataProps {
  reduxState: string;
  actionToDispatch?: any;
}

export const LevelData = ({ reduxState, actionToDispatch }: LevelDataProps) => {
  // get redux state

  const { currentLevel } = useAppSelector((state: any) => state.currentLevel);
  const detail = useAppSelector(
    (state: any) => state.levels[currentLevel - 1][reduxState]
  );

  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  // if in creator mode, show an input instead of text

  if (isCreator && actionToDispatch) {
    return (
      <InfoInput actionToDispatch={actionToDispatch} reduxState={reduxState} />
    );
  }

  return <>{detail}</>;
};
