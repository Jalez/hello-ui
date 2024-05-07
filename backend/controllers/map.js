const debug = require('debug');
const { idSchema: levelIdSchema } = require('../models/validators/level.js');
const {
  nameSchema,
  levelsSchema,
  mapSchema
} = require('../models/validators/map.js');

// Create logger for debugging
// (Better console.log with colors and does not show any output in production)
const logger = debug('ui_designer:controller:map');

const respondWithErrorMessages = (req, res, err) => {
  logger('%O', err);
  res.status(400);
  return res.json({ error: err.message });
};

// get all maps: /maps
const getAllMaps = async (req, res) => {
  try {
    const db = req.app.get('db');
    const maps = await db.Map.findAll({ include: [db.Level] });
    logger('Found %d maps', maps.length);
    res.json(
      maps.map(map => {
        const json = map.toJSON();
        delete json.Levels;
        json.levels = map.Levels.map(level => level.identifier);
        return json;
      })
    );
  } catch (error) {
    logger('Error: %O', error);
    res.status(500).send({ message: 'Failed to fetch maps' });
  }
};

// get map names: /maps/names
const getMapNames = async (req, res) => {
  try {
    const db = req.app.get('db');
    const maps = await db.Map.findAll({
      attributes: ['name']
    });
    res.json(maps.map(map => map.name));
  } catch (error) {
    logger('Error %O', error);
    res.status(500).send({ message: 'Failed to fetch map names' });
  }
};

// Get all levels in a map: /maps/levels/:name
const getMapLevels = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value: name, error } = nameSchema().validate(req.params.name);
    if (error) return respondWithErrorMessages(req, res, error);

    const map = await db.Map.findOne({
      where: { name },
      include: [db.Level]
    });

    return map
      ? res.json(
          map.Levels.map(level => ({
            identifier: level.identifier,
            name: level.name,
            ...level.json
          }))
        )
      : res.status(404).send({ message: 'Map not found' });
  } catch (error) {
    logger('Error: %O', error);
    res.status(500).send({ message: 'Failed to fetch levels for map' });
  }
};

// Set levels for a map: /maps/levels/:name (POST)
const setMapLevels = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value: name, error: nameError } = nameSchema().validate(
      req.params.name
    );
    if (nameError) return respondWithErrorMessages(req, res, nameError);

    const { value: identifiers, error } = levelsSchema().validate(req.body);
    if (error) return respondWithErrorMessages(req, res, error);

    const map = await db.Map.findByPk(name);

    if (!map) {
      return res.status(404).send({ message: 'Map not found' });
    }

    const levelCount = await map.countLevels();

    if (levelCount > 0) {
      return res.status(409).send({
        message: `Failed to set map levels: map already has ${levelCount} levels set.`
      });
    }

    const levels = await db.Level.findAll({
      where: { identifier: identifiers }
    });

    await Promise.all(levels.map(level => map.addLevel(level)));
    await map.reload();

    res
      .status(201)
      .send((await map.getLevels()).map(level => level.identifier));
  } catch (error) {
    logger('Error: %O', error);
    res.status(500).send({ message: 'Failed to set levels to map' });
  }
};

// Update map levels (replace levels with the provided ones): /maps/levels/:name/:id (PUT)
const updateMapLevels = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value: name, error: nameError } = nameSchema().validate(
      req.params.name
    );
    if (nameError) return respondWithErrorMessages(req, res, nameError);

    const { value: identifiers, error } = levelsSchema().validate(req.body);
    if (error) return respondWithErrorMessages(req, res, error);

    const map = await db.Map.findByPk(name, { include: [db.Level] });

    if (!map) {
      return res.status(404).send({ message: 'Map not found' });
    }

    // Begin transaction to update map and connections to levels
    const transaction = await db.sequelize.transaction();

    try {
      const levels = await map.getLevels({ transaction });

      const levelsToRemove = levels.filter(
        level => !identifiers.includes(level.identifier)
      );

      const levelsToKeep = levels
        .filter(level => identifiers.includes(level.identifier))
        .map(level => level.identifier);

      const levelsToAdd = identifiers.filter(
        identifier => !levelsToKeep.includes(identifier)
      );

      // Remove levels
      await Promise.all(levelsToRemove.map(level => map.removeLevel(level)));

      // Add new levels
      await Promise.all(
        db.Level.findAll({
          where: { identifier: levelsToAdd },
          transaction
        }).then(levels => {
          return Promise.all(levels.map(map.addLevel(level, { transaction })));
        })
      );

      await map.reload({ transaction }); // fetch current data from database
      const updatedLevels = await map.getLevels({ transaction }); // get the connected levels
      await transaction.commit();

      return res.status(200).json(updatedLevels.map(level => level.identifier));
    } catch (error) {
      logger('Error %O', error);
      await transaction.rollback();
      res.status(500).send({ message: 'Failed to update map levels' });
    }
  } catch (error) {
    logger('Error: %O', error);
    res.status(500).send({ message: 'Failed to update map levels' });
  }
};

// Delete all levels from a map: /maps/levels/:name (DELETE)
const deleteMapLevels = async (req, res) => {
  // FIXME: Add transaction
  try {
    const db = req.app.get('db');
    const { value: name, error } = nameSchema().validate(req.params.name);
    if (error) return respondWithErrorMessages(req, res, error);

    const map = await db.Map.findByPk(name, { include: [db.Level] });

    if (!map) {
      return res.status(404).send({ message: 'Map not found' });
    }

    await Promise.all(map.Levels.map(level => map.removeLevel(level)));
    await map.reload();

    res.status(204);
  } catch (error) {
    logger('Error: %O', error);
    res.status(500).send({ message: 'Failed to delete levels from map' });
  }
};

// Add level to a map: /maps/levels/:name/:id (PUT)
const addMapLevel = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value: name, error: nameError } = nameSchema().validate(
      req.params.name
    );
    if (nameError) return respondWithErrorMessages(req, res, nameError);

    const { value: identifier, error } = levelIdSchema().validate(
      req.params.id
    );
    if (error) return respondWithErrorMessages(req, res, error);

    const map = await db.Map.findByPk(name);
    const level = await db.Level.findByPk(identifier);

    if (!map) {
      return res.status(404).send({ message: 'Map not found' });
    }

    if (!level) {
      return res.status(404).send({ message: 'Level not found' });
    }

    const hasLevel = await map.hasLevel(level);

    if (hasLevel) {
      return res.status(409).send({
        message:
          'Failed to add level to map: level is already added to the same map'
      });
    }

    await map.addLevel(level);

    res.status(201).send({ message: 'Level added to map' });
  } catch (error) {
    logger('Error: %O', error);
    res.status(500).send({ message: 'Failed to add level to map' });
  }
};

// Delete level from a map: /maps/levels/:name/:id (DELETE)
const removeMapLevel = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value: name, error: nameError } = nameSchema().validate(
      req.params.name
    );
    if (nameError) return respondWithErrorMessages(req, res, nameError);

    const { value: identifier, error } = levelIdSchema().validate(
      req.params.id
    );
    if (error) return respondWithErrorMessages(req, res, error);

    const map = await db.Map.findByPk(name);
    const level = await db.Level.findByPk(identifier);

    if (!map) {
      return res.status(404).send({ message: 'Map not found' });
    }

    if (!level) {
      return res.status(404).send({ message: 'Level not found' });
    }

    const hasLevel = await map.hasLevel(level);

    if (!hasLevel) {
      return res.status(409).send({
        message:
          'Failed to delete level from map: level was not added to the map'
      });
    }

    await map.removeLevel(level);

    res.status(204);
  } catch (error) {
    logger('Error: %O', error);
    res.status(500).send({ message: 'Failed to delete level from map' });
  }
};

// Get map by its name: /maps/:name (GET)
const getMapByName = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value: name, error } = nameSchema().validate(req.params.name);
    if (error) return respondWithErrorMessages(req, res, error);

    const map = await db.Map.findByPk(name, { include: [db.Level] });

    if (!map) {
      return res.status(404).send({ message: 'Map not found' });
    }

    const mapJson = map.toJSON();
    delete mapJson.Levels;
    mapJson.levels = map.Levels.map(level => level.identifier);

    return res.json(mapJson);
  } catch (error) {
    logger('Error %O', error);
    res.status(500).send({ message: 'Failed to fetch map' });
  }
};

// Create map: /maps/:name (POST)
const createMap = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value: name, error: nameError } = nameSchema().validate(
      req.params.name
    );
    if (nameError) return respondWithErrorMessages(req, res, nameError);

    const { value: data, error } = mapSchema
      .tailor('create')
      .validate(req.body);
    if (error) return respondWithErrorMessages(req, res, error);

    let map = await db.Map.findByPk(name);

    if (map) {
      return res.status(409).send({
        message: 'Failed to create map: a map with the same name already exists'
      });
    }

    map = await db.Map.create({ name, ...data });
    return res.status(201).json({ ...map.toJSON(), levels: [] });
  } catch (error) {
    logger('Error %O', error);
    await transaction.rollback();
    res.status(500).send({ message: 'Failed to create map' });
  }
};

// Update map: /maps/:name (PUT)
const updateMap = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value: name, error: nameError } = nameSchema().validate(
      req.params.name
    );
    if (nameError) return respondWithErrorMessages(req, res, nameError);

    const { value: data, error } = mapSchema
      .tailor('update')
      .validate(req.body);
    if (error) return respondWithErrorMessages(req, res, error);

    const map = await db.Map.findByPk(name, { include: [db.Level] });

    if (!map) {
      return res.status(404).send({ message: 'Map not found' });
    }

    await map.update({ ...data });

    // build response JSON (include level identifiers)
    const mapJson = map.toJSON();
    delete mapJson.Levels;
    mapJson.levels = map.Levels.map(level => level.identifier);

    return res.status(200).json(mapJson);
  } catch (error) {
    logger('Error %O', error);
    await transaction.rollback();
    res.status(500).send({ message: 'Failed to create map' });
  }
};

// Delete map: /maps/:name (DELETE)
const deleteMap = async (req, res) => {
  try {
    const db = req.app.get('db');
    const { value: name, error } = nameSchema().validate(req.params.name);
    if (error) return respondWithErrorMessages(req, res, error);

    const map = await db.Map.findByPk(name);

    if (!map) {
      return res.status(404).send({ message: 'Map not found' });
    }

    await map.destroy();
    return res.status(204).send();
  } catch (error) {
    logger('Error %O', error);
    res.status(500).send({ message: 'Failed to delete map' });
  }
};

module.exports = {
  addMapLevel,
  createMap,
  deleteMapLevels,
  deleteMap,
  getAllMaps,
  getMapLevels,
  getMapNames,
  getMapByName,
  removeMapLevel,
  setMapLevels,
  updateMap,
  updateMapLevels
};
