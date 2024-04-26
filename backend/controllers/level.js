const data = require('../db/data.js');

// TODO: Add more granular error handling and better error messages

// get all levels: /levels
const getAllLevels = (req, res) => {
  res.json(data.getAllLevels());
};

// get levels by map name /levels/:mapName
const getLevelsByMapName = (req, res) => {
  const mapName = req.params.mapName;

  if (mapName === 'all') {
    return getAllLevels(req, res);
  }

  const levels = data.getLevelsByMapName(mapName);
  return levels
    ? res.json(levels)
    : res.status(404).send({ message: 'Map not found' });
};

// Get all level names: /levels/names
const getLevelNames = (req, res) => {
  res.json(data.getLevelNames());
};

// Get level by id: /levels/:id (GET)
const getLevelById = (req, res) => {
  const level = data.getLevelById(req.params.id);
  return level
    ? res.json(level)
    : res.status(404).send({ message: 'Level not found' });
};

// Update level: /levels/:id (PUT)
const updateLevel = (req, res) => {
  const level = data.updateLevel(req.params.id, req.body);
  return level
    ? res.json(level)
    : res.status(500).send({ message: 'Failed to update level' });
};

// Create new level: /levels (POST)
const createLevel = (req, res) => {
  const level = data.addLevel(req.body);
  return level
    ? res.status(201).send(level)
    : res.status(500).send({ message: 'Failed to create new level' });
};

// Delete level: /levels/:id (DELETE)
const deleteLevel = (req, res) => {
  return data.deleteLevel(req.params.id)
    ? res.status(204).send()
    : res.status(500).send({ message: 'Failed to delete level' });
};

module.exports = {
  createLevel,
  deleteLevel,
  getAllLevels,
  getLevelById,
  getLevelNames,
  updateLevel
};
