import { useAppSelector } from "../../store/hooks/hooks";

const numberTimeToMinutesAndSeconds = (time: number) => {
  if (time < 0) return "0:00";
  const minutes = Math.floor(time / 60000);
  const seconds = ((time % 60000) / 1000).toFixed(0);
  return minutes + ":" + (parseInt(seconds) < 10 ? "0" : "") + seconds;
};

export const InfoTime = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  const start = level.timeData.startTime;
  const completionTime = level.timeData.pointAndTime[level.points];
  const timeInMinutes = numberTimeToMinutesAndSeconds(completionTime - start);
  return <>{timeInMinutes}</>;
};
