const data = require('../db/data.js');

// TODO: Add more granular error handling and better error messages

// get all levels: /levels
const getAllLevels = async (req, res) => {
  const db = req.app.get('db');
  const levels = await db.Level.findAll();
  res.json(levels.map(level => level.json));
};

// get levels by map name /levels/:mapName
const getLevelsByMapName = async (req, res) => {
  const mapName = req.params.mapName;

  if (mapName === 'all') {
    return getAllLevels(req, res);
  }

  const db = req.app.get('db');
  const map = await db.Map.findOne({
    where: { name: mapName },
    include: [db.Level]
  });

  return map
    ? res.json(map.Levels.map(level => level.json))
    : res.status(404).send({ message: 'Map not found' });
};

// Get all level names: /levels/names
const getLevelNames = async (req, res) => {
  const db = req.app.get('db');
  const levels = await db.Level.findAll({ attributes: ['identifier', 'name'] });
  res.json(levels.map(level => ({ [level.identifier]: level.name })));
};

// Get level by id: /levels/:id (GET)
const getLevelById = async (req, res) => {
  const db = req.app.get('db');
  const level = await db.Level.findByPk(req.params.id);
  // const level = data.getLevelById(req.params.id);
  return level
    ? res.json(level.json)
    : res.status(404).send({ message: 'Level not found' });
};

// Update level: /levels/:id (PUT)
const updateLevel = async (req, res) => {
  const db = req.app.get('db');
  const level = await db.Level.findByPk(req.params.id);
  if (!level)
    return res
      .status(404)
      .send({ message: 'Failed to update: level not found' });

  const data = req.body;
  delete data.identifier; // do not change identifier

  if (data.name && level.name !== data.name) {
    level.name = data.name;
  }

  level.json = { ...level.json, ...data };
  await level.save();
  res.json(level.json);
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
