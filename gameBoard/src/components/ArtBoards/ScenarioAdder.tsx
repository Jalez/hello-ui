import { Button } from "@mui/material";
import AddToPhotosIcon from "@mui/icons-material/AddToPhotos";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { addNewScenario } from "../../store/slices/levels.slice";

const ScenarioAdder = () => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  if (!isCreator) return null;

  const handleAddNewScenario = () => {
    dispatch(addNewScenario(currentLevel as number));
  };

  return (
    <Button
      onClick={handleAddNewScenario}
      variant="text"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        width: "280px",
        padding: 10,
        margin: 4,
      }}
    >
      <AddToPhotosIcon sx={{ fontSize: 100 }} />
      <>Add a new scenario</>
    </Button>
  );
};

export default ScenarioAdder;
