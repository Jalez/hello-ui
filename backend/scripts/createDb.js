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
  await Promise.all(
    Object.values(levelsData).map(level =>
      db.Level.create({
        identifier: level.identifier,
        name: level.name,
        json: level
      })
    )
  );

  // Maps
  const maps = JSON.parse(fs.readFileSync(LEVEL_MAPS_FILE, 'utf8'));
  await Promise.all(
    Object.entries(maps).map(([name, map]) =>
      db.Map.create({
        name: name,
        random: map.random,
        canUseAI: map.canUseAI ?? false
      })
    )
  );

  (await db.Map.findAll({ include: [db.Level] })).forEach(map => {
    db.Level.findAll({
      where: { identifier: maps[map.name]['levels'] }
    }).then(levels => Promise.all(levels.map(level => map.addLevel(level))));
  });
})();
