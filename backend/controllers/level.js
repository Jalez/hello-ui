const debug = require('debug');

// Create logger for debugging
// (Better console.log with colors and does not show any output in production)
const logger = debug('ui_designer:controller:level');

// get all levels: /levels
const getAllLevels = async (req, res) => {
  try {
    const db = req.app.get('db');
    const levels = await db.Level.findAll();
    logger('Found %d levels', levels.length);
    res.json(levels.map(level => level.json));
  } catch (error) {
    logger('Error: %O', error);
    res.status(500).send({ message: 'Failed to fetch levels' });
  }
};

// // get levels by map name /levels/:mapName
// const getLevelsByMapName = async (req, res) => {
//   try {
//     const mapName = req.params.mapName;

//     if (mapName === 'all') {
//       return getAllLevels(req, res);
//     }

//     const db = req.app.get('db');
//     const map = await db.Map.findOne({
//       where: { name: mapName },
//       include: [db.Level]
//     });

//     return map
//       ? res.json(levels.map(level => level.json))
//       : res.status(404).send({ message: 'Map not found' });
//   } catch (error) {
//     logger('Error: %O', error);
//     res.status(500).send({ message: 'Failed to fetch levels for map' });
//   }
// };

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
    const level = await db.Level.findByPk(req.params.id);
    return level
      ? res.json(level.json)
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
    const level = await db.Level.findByPk(req.params.id);

    if (!level)
      return res
        .status(404)
        .send({ message: 'Failed to update: level not found' });

    const data = req.body;
    const { name } = data;

    if (name && level.name !== name) {
      level.name = name;
    }

    level.json = { ...level.json, ...data };
    await level.save();
    res.json(level.json);
  } catch (error) {
    logger('Error %O', error);
    res.status(500).send({ message: 'Failed to update level' });
  }
};

// Create new level: /levels (POST)
const createLevel = async (req, res) => {
  try {
    const db = req.app.get('db');
    const data = req.body;
    const { identifier, name } = data;

    if (identifier) {
      const level = await db.Level.findByPk(identifier);

      if (level) {
        return res.status(409).send({
          message:
            'Failed to create new level. A level with the same identifier already exists.'
        });
      }
    }

    if (!name) {
      return res
        .status(400)
        .send({ message: 'Failed to create level: level name is missing' });
    }

    const level = await db.Level.create({ name, json: data });

    return level
      ? res.status(201).send(level.json)
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
    const level = await db.Level.findByPk(req.params.id);

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
