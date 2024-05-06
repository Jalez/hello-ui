const levelController = require('../controllers/level.js');
const requireJson = require('../middleware/requireJson.js');
const requireDevelopment = require('../middleware/requireDevelopment.js');

module.exports = router => {
  router
    .route('/levels/names')
    .all(requireJson)
    .get(levelController.getLevelNames);

  // /levels/:id
  router
    .route('/levels/:id')
    .all(requireJson)
    .get(levelController.getLevelById)
    .put(requireDevelopment, levelController.updateLevel)
    .delete(requireDevelopment, levelController.deleteLevel);

  // /levels
  router
    .route('/levels')
    .all(requireJson)
    .get(levelController.getAllLevels)
    .post(requireDevelopment, levelController.createLevel);
};
