const mapController = require('../controllers/map.js');
const requireJson = require('../middleware/requireJson.js');

module.exports = router => {
  // add/remove levels
  router
    .route('/maps/levels/:name/:id')
    .all(requireJson)
    .post(mapController.addMapLevel)
    .delete(mapController.removeMapLevel);

  // all map levels
  router
    .route('/maps/levels/:name')
    .all(requireJson)
    .get(mapController.getMapLevels)
    .post(mapController.setMapLevels)
    .put(mapController.updateMapLevels)
    .delete(mapController.deleteMapLevels);

  // get map names
  router.route('/maps/names').all(requireJson).get(mapController.getMapNames);

  // map CRUD: /maps/:name
  router
    .route('/maps/:name')
    .all(requireJson)
    .get(mapController.getMapByName)
    .post(mapController.createMap)
    .put(mapController.updateMap)
    .delete(mapController.deleteMap);

  // get all maps
  router.route('/maps/').all(requireJson).get(mapController.getAllMaps);
};
