const mapController = require('../controllers/map.js');
const requireJson = require('../middleware/requireJson.js');
const requireDevelopment = require('../middleware/requireDevelopment.js');

module.exports = router => {
  // add/remove levels
  router
    .route('/maps/levels/:name/:id')
    .all(requireJson)
    .post(requireDevelopment, mapController.addMapLevel)
    .delete(requireDevelopment, mapController.removeMapLevel);

  // all map levels
  router
    .route('/maps/levels/:name')
    .all(requireJson)
    .get(mapController.getMapLevels)
    .post(requireDevelopment, mapController.setMapLevels)
    .put(requireDevelopment, mapController.updateMapLevels)
    .delete(requireDevelopment, mapController.deleteMapLevels);

  // get map names
  router.route('/maps/names').all(requireJson).get(mapController.getMapNames);

  // map CRUD: /maps/:name
  router
    .route('/maps/:name')
    .all(requireJson)
    .get(mapController.getMapByName)
    .post(requireDevelopment, mapController.createMap)
    .put(requireDevelopment, mapController.updateMap)
    .delete(requireDevelopment, mapController.deleteMap);

  // get all maps
  router.route('/maps/').all(requireJson).get(mapController.getAllMaps);
};
