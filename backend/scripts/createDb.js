const fs = require('fs');
const path = require('path');

const db = require('../models/index.js');

const LEVELS_FILE = path.resolve(__dirname, '../db/json/levels.json');
const LEVEL_MAPS_FILE = path.resolve(__dirname, '../db/json/maps.json');

const Sequelize = require('sequelize');
const level = require('../models/level.js');

(async () => {
  await db.sequelize.sync();

  // Levels
  const levelsData = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8'));

  const levelMappings = {};

  const transaction = await db.sequelize.transaction();

  try {
    // Create levels
    await Promise.all(
      Object.values(levelsData).map(data => {
        const json = { ...data };
        delete json.identifier;
        delete json.name;

        return db.Level.create(
          {
            name: data.name,
            json: json
          },
          { transaction }
        )
          .then(level => level.reload({ transaction }))
          .then(level => (levelMappings[data.identifier] = level.identifier));
      })
    );

    const mapsData = JSON.parse(fs.readFileSync(LEVEL_MAPS_FILE, 'utf8'));

    // Create maps
    await Promise.all(
      Object.entries(mapsData).map(([name, data]) =>
        db.Map.create(
          {
            name: name,
            random: data.random,
            canUseAI: data.canUseAI ?? false
          },
          { transaction }
        )
      )
    );

    const maps = await db.Map.findAll({ include: [db.Level], transaction });

    // connect levels to maps
    await Promise.all(
      maps.map(map => {
        const identifiers = mapsData[map.name]['levels'].map(
          id => levelMappings[id]
        );

        return db.Level.findAll({
          where: { identifier: identifiers },
          transaction
        }).then(levels =>
          Promise.all(levels.map(level => map.addLevel(level, { transaction })))
        );
      })
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error(error);
  }
})();
