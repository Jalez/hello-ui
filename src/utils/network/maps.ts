import { MapDetails } from "../../types";

const url = "http://localhost:3000/maps";

export const postMap = async (mapName: string) => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: mapName }),
    });
    if (!response.ok) {
      throw new Error("Response not OK");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

export const getMapNames = async () => {
  try {
    const response = await fetch(url + "/names");
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

export const getMapLevels = async (selectedMap: string) => {
  try {
    const response = await fetch(`http://localhost:3000/maps/${selectedMap}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

export const updateSelectedMap = async (
  selectedMap: string,
  selectedMapDetails: MapDetails
) => {
  try {
    const response = await fetch(`http://localhost:3000/maps/${selectedMap}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(selectedMapDetails),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};
