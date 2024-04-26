const data = require('../db/data.js');

// TODO: Add more granular error handling and better error messages

// get all maps: /maps
const getAllMaps = (req, res) => {
  res.json(data.getAllMaps());
};

// get map names: /maps/names
const getMapNames = (req, res) => {
  const names = data.getMapNames();
  return names
    ? res.json(names)
    : res.status(500).send({ message: 'Failed to fetch data' });
};

// Get all levels in a map: /maps/levels/:name
const getMapLevels = (req, res) => {
  const name = req.params.name;
  const levels = data.getLevelsByMapName(name);
  return levels
    ? res.json(levels)
    : res.status(500).send({ message: 'Failed to fetch data' });
};

// Get map by its name: /maps/:name (GET)
const getMapByName = (req, res) => {
  const name = req.params.name;
  const map = data.getMapByName(name);
  return map
    ? res.json(map)
    : res.status(500).send({ message: 'Failed to fetch data' });
};

// Create map: /maps/:name (POST)
const createMap = (req, res) => {
  const name = req.params.name;
  const data = req.body;
  const map = data.addMap(name, data);
  return map
    ? res.status(200).send(map)
    : res.status(500).send({ message: 'Failed to create new map' });
};

// Update map: /maps/:name (PUT)
const updateMap = (req, res) => {
  const name = req.params.name;
  const data = req.body;
  const map = data.updateMap(name, data);
  return map
    ? res.status(201).send(map)
    : res.status(500).send({ message: 'Failed to update map' });
};

// Delete map: /maps/:name (DELETE)
const deleteMap = (req, res) => {
  const name = req.params.name;
  return data.deleteMap(name)
    ? res.status(204).send()
    : res.status(500).send({ message: 'Failed to delete map' });
};

module.exports = {
  createMap,
  deleteMap,
  getAllMaps,
  getMapLevels,
  getMapNames,
  getMapByName,
  updateMap
};
