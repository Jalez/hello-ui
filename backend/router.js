const express = require('express');
const setupLevels = require('./routes/levels.js');
const setupMaps = require('./routes/maps.js');

const router = express.Router();

setupLevels(router);
setupMaps(router);

module.exports = router;
