import { mapUrl } from "../../constants";
import { Level, MapDetails } from "../../types";

const url = mapUrl;

type getMapLevels = (mapName: string) => Promise<Level[]>;
type getMapNames = () => Promise<string[]>;
type getMapByName = (name: string) => Promise<MapDetails>;
type createMap = (map: MapDetails) => Promise<MapDetails>;
type updateMap = (name: string, map: MapDetails) => Promise<MapDetails>;
type deleteMap = (name: string) => Promise<MapDetails>;
type getAllMaps = () => Promise<MapDetails[]>;

/**
 *
 * @param mapName string - name of the map
 * @returns levels - array of levels for the map
 */
export const getMapLevels: getMapLevels = async (mapName) => {
  try {
    const response = await fetch(`${url}/levels/${mapName}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

/**
 *
 * @returns names - array of map names
 */

export const getMapNames: getMapNames = async () => {
  try {
    const response = await fetch(`${url}/names`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

/**
 *
 * @param name string - name of the map
 * @returns map - map details
 */

export const getMapByName: getMapByName = async (name) => {
  try {
    const response = await fetch(`${url}/${name}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

/**
 *
 * @param map MapDetails - map details
 * @returns map - map details
 */

export const createMap: createMap = async (map) => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(map),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

/**
 *
 * @param name string - name of the map
 * @param map MapDetails - map details
 * @returns map - map details
 */

export const updateMap: updateMap = async (name, map) => {
  try {
    const response = await fetch(`${url}/${name}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(map),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

/**
 *
 * @param name string - name of the map
 * @returns map - map details
 */

export const deleteMap: deleteMap = async (name) => {
  try {
    const response = await fetch(`${url}/${name}`, {
      method: "DELETE",
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

/**
 *
 * @returns maps - array of map details
 */

export const getAllMaps: getAllMaps = async () => {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};
