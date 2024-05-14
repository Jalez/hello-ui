const debug = require('debug');
const { idSchema, levelSchema } = require('../models/validators/level.js');

// Create logger for debugging
// (Better console.log with colors and does not show any output in production)
const logger = debug('ui_designer:controller:level');

const respondWithErrorMessages = (req, res, err) => {
  logger('%O', err);
  res.status(400);
  return res.json({ error: err.message });
};

// get all levels: /levels
const getAllLevels = async (req, res) => {
  try {
    const db = req.app.get('db');
    const levels = await db.Level.findAll();
    logger('Found %d levels', levels.length);
    res.json(
      levels.map(level => ({
        identifier: level.identifier,
        name: level.name,
        ...level.json
      }))
    );
  } catch (error) {
    logger('Error: %O', error);
    res.status(500).send({ message: 'Failed to fetch levels' });
  }
};

// Get all level names: /levels/names
const getLevelNames = async (req, res) => {
  try {
    const db = req.app.get('db');
    const levels = await db.Level.findAll({
      attributes: ['identifier', 'name']
    });
    res.json(levels.map(level => ({ [level.identifier]: level.name })));
  } catch (error) {
    logger('Error %O', error);
    res.status(500).send({ message: 'Failed to fetch level names' });
  }
};

// Get level by id: /levels/:id (GET)
const getLevelById = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value: id, error } = idSchema().validate(req.params.id);
    if (error) return respondWithErrorMessages(req, res, error);

    const level = await db.Level.findByPk(id);
    return level
      ? res.json({
          identifier: level.identifier,
          name: level.name,
          ...level.json
        })
      : res.status(404).send({ message: 'Level not found' });
  } catch (error) {
    logger('Error %O', error);
    res.status(500).send({ message: 'Failed to fetch level' });
  }
};

// Update level: /levels/:id (PUT)
const updateLevel = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value: id, error: idError } = idSchema().validate(req.params.id);
    if (idError) return respondWithErrorMessages(req, res, idError);

    const level = await db.Level.findByPk(id);

    if (!level)
      return res
        .status(404)
        .send({ message: 'Failed to update: level not found' });

    const { value, error } = levelSchema.tailor('update').validate(req.body);
    if (error) return respondWithErrorMessages(req, res, error);

    const { name = level.name, ...json } = value;
    await level.update({ name, json: { ...level.json, ...json } });

    res.json({
      identifier: level.identifier,
      name: level.name,
      ...level.json
    });
  } catch (error) {
    logger('Error %O', error);
    res.status(500).send({ message: 'Failed to update level' });
  }
};

// Create new level: /levels (POST)
const createLevel = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value, error } = levelSchema.tailor('create').validate(req.body);
    if (error) return respondWithErrorMessages(req, res, error);

    const { name, ...json } = value;
    const level = await db.Level.create({ name, json });

    return level
      ? res.status(201).send({
          identifier: level.identifier,
          name: level.name,
          ...level.json
        })
      : res.status(500).send({ message: 'Failed to create new level' });
  } catch (error) {
    logger('Error %O', error);
    res.status(500).send({ message: 'Failed to create level' });
  }
};

// Delete level: /levels/:id (DELETE)
const deleteLevel = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value: id, error: idError } = idSchema().validate(req.params.id);
    if (idError) return respondWithErrorMessages(req, res, idError);

    const level = await db.Level.findByPk(id);

    if (!level) {
      return res.status(404).send({ message: 'Level not found' });
    }

    await level.destroy();
    return res.status(204).send();
  } catch (error) {
    logger('Error %O', error);
    res.status(500).send({ message: 'Failed to delete level' });
  }
};

module.exports = {
  createLevel,
  deleteLevel,
  getAllLevels,
  getLevelById,
  getLevelNames,
  updateLevel
};
