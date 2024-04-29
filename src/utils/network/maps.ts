import { mapUrl } from "../../constants";
import { Level, MapDetails } from "../../types";
import { makeRequest } from "./makeRequest";

const url = mapUrl;

type getMapLevels = (mapName: string) => Promise<Level[]>;
type getMapNames = () => Promise<string[]>;
type getMapByName = (name: string) => Promise<MapDetails>;
type createMap = (map: MapDetails) => Promise<MapDetails>;
type updateMap = (name: string, map: MapDetails) => Promise<MapDetails>;
type deleteMap = (name: string) => Promise<MapDetails>;
type getAllMaps = () => Promise<MapDetails[]>;

export const getMapLevels: getMapLevels = async (mapName) => {
  const url = `${mapUrl}/levels/${mapName}`;
  return makeRequest<Level[]>(url);
};

export const getMapNames: getMapNames = async () => {
  const url = `${mapUrl}/names`;
  return makeRequest<string[]>(url);
};

export const getMapByName: getMapByName = async (name) => {
  console.log("Get map by name", name);
  const url = `${mapUrl}/${name}`;
  return makeRequest<MapDetails>(url);
};

export const createMap: createMap = async (map) => {
  const options: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(map),
  };
  return makeRequest<MapDetails>(url, options);
};

export const updateMap: updateMap = async (name, map) => {
  const url = `${mapUrl}/${name}`;
  const options: RequestInit = {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(map),
  };
  return makeRequest<MapDetails>(url, options);
};

export const deleteMap: deleteMap = async (name) => {
  const url = `${mapUrl}/${name}`;
  const options: RequestInit = {
    method: "DELETE",
  };
  return makeRequest<MapDetails>(url, options);
};

export const getAllMaps: getAllMaps = async () => {
  return makeRequest<MapDetails[]>(url);
};
