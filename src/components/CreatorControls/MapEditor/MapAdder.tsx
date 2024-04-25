import { Button, FormControl, Input, Typography } from "@mui/material";
import { postMap } from "../../../utils/network/maps";
import { useState } from "react";

type MapAdderProps = {
  updateMapNames: (name: string) => void;
};

const MapAdder = ({ updateMapNames }: MapAdderProps) => {
  const [newMap, setNewMap] = useState("");

  const addMap = async () => {
    if (!newMap.trim()) return; // prevent adding empty map names
    try {
      await postMap(newMap);
      updateMapNames(newMap);
      setNewMap(""); // reset input after adding
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleNewMapInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMap(event.target.value);
  };
  return (
    <>
      <Typography id="add-map-title" variant="h3" component="h2">
        Add a new map:
      </Typography>
      <Typography id="add-map-description" variant="body1" component="p">
        You can add a new map to the UI designer. This map will be used to
        determine what levels are available to the user based on the value of
        the url search parameter "maps".
      </Typography>
      <form
        noValidate
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          addMap();
        }}
      >
        <FormControl
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "space-around",
          }}
        >
          <Input
            placeholder="Enter new Map Name"
            value={newMap}
            onChange={handleNewMapInput}
          />
          <Button onClick={addMap} color="info">
            Add Map
          </Button>
        </FormControl>
      </form>
    </>
  );
};

export default MapAdder;
