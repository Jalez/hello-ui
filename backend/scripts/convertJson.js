const fs = require('fs');
const path = require('path');

const LEVELS_FILE = path.resolve(__dirname, '../db/json/levels.json');
const LEVEL_MAPS_FILE = path.resolve(__dirname, '../db/json/maps.json');

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

const oldLevelsData = readData();
const oldMapsData = readLevelMaps();

for (const mapName in oldMapsData) {
  const levels = oldMapsData[mapName].levels;
  oldMapsData[mapName].levels = levels.map(
    name => oldLevelsData[name].identifier
  );
}

const newLevelData = {};

for (const levelName in oldLevelsData) {
  const id = oldLevelsData[levelName].identifier;
  newLevelData[id] = oldLevelsData[levelName];
}

console.log('---------------- LEVELS: levels.json ----------------');
console.log(JSON.stringify(newLevelData, null, 2));
// fs.writeFileSync(LEVELS_FILE, JSON.stringify(newLevelData, null, 2));

console.log('---------------- LEVELS: maps.json ----------------');
console.log(JSON.stringify(oldMapsData, null, 2));
// fs.writeFileSync(LEVEL_MAPS_FILE, JSON.stringify(oldMapsData, null, 2));
