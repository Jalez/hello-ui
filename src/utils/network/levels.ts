export const getMapLevelsData = async (selectedMap: string) => {
  try {
    const response = await fetch(`http://localhost:3000/levels/${selectedMap}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};
