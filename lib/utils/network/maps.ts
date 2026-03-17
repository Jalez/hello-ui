import { mapUrl } from "@/constants";
import { Level, MapDetails } from "@/types";
import { makeRequest } from "./makeRequest";

const url = mapUrl;
const MAP_LEVELS_CACHE_TTL_MS = 1500;
const mapLevelsCache = new Map<string, {
  data?: Level[];
  expiresAt: number;
  promise?: Promise<Level[]>;
}>();

type getMapLevels = (mapName: string, options?: { forceFresh?: boolean }) => Promise<Level[]>;
type getMapNames = () => Promise<string[]>;
type getMapByName = (name: string) => Promise<MapDetails>;
type createMap = (map: MapDetails) => Promise<MapDetails>;
type updateMap = (name: string, map: MapDetails) => Promise<MapDetails>;
type deleteMap = (name: string) => Promise<MapDetails>;
type getAllMaps = () => Promise<MapDetails[]>;
type addLevelsToMap = (mapName: string, levelIds: string[]) => Promise<void>;
type removeLevelFromMap = (mapName: string, levelId: string) => Promise<void>;

/**
 * @description Get the levels of a map
 * @param mapName  - the name of the map
 * @returns Promise<Level[]>
 */
export const getMapLevels: getMapLevels = async (mapName, options = {}) => {
  const cacheKey = mapName;
  const now = Date.now();
  const cached = mapLevelsCache.get(cacheKey);

  if (!options.forceFresh && cached) {
    if (cached.data && cached.expiresAt > now) {
      return cached.data;
    }
    if (cached.promise) {
      return cached.promise;
    }
  }

  const requestUrl = `${mapUrl}/levels/${mapName}`;
  const request = makeRequest<Level[]>(requestUrl).then((levels) => {
    mapLevelsCache.set(cacheKey, {
      data: levels,
      expiresAt: Date.now() + MAP_LEVELS_CACHE_TTL_MS,
    });
    return levels;
  }).catch((error) => {
    const active = mapLevelsCache.get(cacheKey);
    if (active?.promise === request) {
      mapLevelsCache.delete(cacheKey);
    }
    throw error;
  });

  mapLevelsCache.set(cacheKey, {
    data: options.forceFresh ? undefined : cached?.data,
    expiresAt: cached?.expiresAt ?? 0,
    promise: request,
  });

  return request;
};

function invalidateMapLevelsCache(mapName: string) {
  mapLevelsCache.delete(mapName);
}

/**
 * @description Get the names of all maps from the server
 * @returns Promise<string[]>
 */
export const getMapNames: getMapNames = async () => {
  const url = `${mapUrl}/names`;
  return makeRequest<string[]>(url);
};

/**
 * @description Get a map by its name
 * @param {string} name - the name of the map
 * @returns Promise<MapDetails>
 */
export const getMapByName: getMapByName = async (name) => {
  const url = `${mapUrl}/${name}`;
  return makeRequest<MapDetails>(url);
};

/**
 * @description Create a new map
 * @param {MapDetails} map - the map data
 * @returns Promise<MapDetails>
 */
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

/**
 * @description Update a map
 * @param {string} name - the name of the map
 * @param {MapDetails} map - the map data
 * @returns Promise<MapDetails>
 */
export const updateMap: updateMap = async (name, map) => {
  const url = `${mapUrl}/${name}`;
  const options: RequestInit = {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(map),
  };
  const updated = await makeRequest<MapDetails>(url, options);
  invalidateMapLevelsCache(name);
  return updated;
};

/**
 * @description Delete a map
 * @param {string} name - the name of the map
 * @returns Promise<MapDetails>
 */
export const deleteMap: deleteMap = async (name) => {
  const url = `${mapUrl}/${name}`;
  const options: RequestInit = {
    method: "DELETE",
  };
  const deleted = await makeRequest<MapDetails>(url, options);
  invalidateMapLevelsCache(name);
  return deleted;
};

/**
 * @description Get all maps from the server
 * @returns Promise<MapDetails[]>
 */
export const getAllMaps: getAllMaps = async () => {
  return makeRequest<MapDetails[]>(url);
};

/**
 * @description Add one or more levels to a map by identifier.
 */
export const addLevelsToMap: addLevelsToMap = async (mapName, levelIds) => {
  const endpoint = `${mapUrl}/levels/${mapName}`;
  await makeRequest(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ levels: levelIds }),
  });
  invalidateMapLevelsCache(mapName);
};

/**
 * @description Remove a level from a map by identifier.
 */
export const removeLevelFromMap: removeLevelFromMap = async (mapName, levelId) => {
  const endpoint = `${mapUrl}/levels/${encodeURIComponent(mapName)}/${encodeURIComponent(levelId)}`;
  const response = await fetch(endpoint, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  invalidateMapLevelsCache(mapName);
};
