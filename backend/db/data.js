const fs = require('fs');
const path = require('path');

const LEVELS_FILE = path.resolve(__dirname, 'json/levels.json');
const LEVEL_MAPS_FILE = path.resolve(__dirname, 'json/maps.json');

const readData = () => {
  return JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8'));
};

const readLevelMaps = () => {
  return JSON.parse(fs.readFileSync(LEVEL_MAPS_FILE, 'utf8'));
};

const writeData = data => {
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(data, null, 2), 'utf8');
};

const writeLevelMaps = data => {
  fs.writeFileSync(LEVEL_MAPS_FILE, JSON.stringify(data, null, 2), 'utf8');
};

//  --------

const getAllLevels = () => {
  return readData();
};

const getAllMaps = () => {
  return readLevelMaps();
};

const getLevelById = id => {
  const levels = getAllLevels();
  return id in levels ? levels[id] : null;
};

const getLevelsByMapName = mapName => {
  const maps = getAllMaps();
  const levelIds = maps[mapName]?.levels;
  if (!levelIds) return null;

  const levels = getAllLevels();
  return levelIds.map(id => levels[id]);
};

const getLevelNames = () => {
  const levels = getAllLevels();
  return Object.keys(levels).map(id => ({
    [id]: levels[id]['name']
  }));
};

const getMapByName = name => {
  const maps = getAllMaps();
  return maps[name];
};

const getMapNames = () => {
  const maps = getAllMaps();
  return Object.keys(maps);
};

const addMap = (name, data) => {
  const maps = getAllMaps();
  const levels = getAllLevels();

  // TODO: better error handling
  if (!name || !data) return false;
  if (name in maps) return false;
  if (!data.levels || !Array.isArray(data.levels)) return false;
  if (data.levels.some(level => !levels[level])) return false; // unknown level found

  maps[name] = data;
  writeLevelMaps({ ...maps });
  return maps[name];
};

const addLevel = data => {
  const levels = getAllLevels();
  const id = data?.identifier; // FIXME: generate id if missing

  // TODO: better error handling
  if (!data) return false;
  if (!id || id in levels) return false;

  writeData({ ...levels, [id]: data });
  return data;
};

const updateLevel = (id, data) => {
  const levels = getAllLevels();

  // TODO: better error handling
  if (!id || !data) return false;
  if (!levels[id]) return false;
  if (data?.identifier !== id) return false;

  levels[id] = { ...levels[id], ...data };
  writeData({ ...levels });
  return levels[id];
};

const updateMap = (name, data) => {
  const maps = getAllMaps();

  // TODO: better error handling
  if (!name || !data) return false;
  if (!maps[name]) return false;
  if (data.levels && data.levels.some(level => !levels[level])) return false; // unknown level found

  maps[name] = { ...maps[name], ...data };
  writeLevelMaps({ ...maps });
  return maps[name];
};

const deleteLevel = id => {
  const levels = getAllLevels();

  // TODO: better error handling
  if (!id) return false;
  if (!levels[id]) return false;

  delete levels[id];
  writeData({ ...levels });
  return true;
};

const deleteMap = name => {
  const maps = getAllMaps();

  // TODO: better error handling
  if (!name) return false;
  if (!maps[name]) return false;

  delete maps[name];
  writeLevelMaps({ ...maps });
  return true;
};

module.exports = {
  addLevel,
  addMap,
  deleteLevel,
  deleteMap,
  getAllLevels,
  getAllMaps,
  getLevelById,
  getLevelsByMapName,
  getLevelNames,
  getMapByName,
  getMapNames,
  updateLevel,
  updateMap
};
