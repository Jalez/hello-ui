'use strict';

const mapLevels = [
  {
    LevelIdentifier: 'b99c2612-0857-11ef-8605-cbeefa1f42bd',
    MapName: 'newOne'
  },
  {
    LevelIdentifier: 'b99c4d22-0857-11ef-8605-cbeefa1f42bd',
    MapName: 'newOne'
  },
  {
    LevelIdentifier: 'b99c4d21-0857-11ef-8605-cbeefa1f42bd',
    MapName: 'test'
  },
  {
    LevelIdentifier: 'b99c4d23-0857-11ef-8605-cbeefa1f42bd',
    MapName: 'test'
  },
  {
    LevelIdentifier: 'b99c4d21-0857-11ef-8605-cbeefa1f42bd',
    MapName: 'js'
  }
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'MapLevels',
      mapLevels.map(connection => ({
        ...connection,
        createdAt: now,
        updatedAt: now
      }))
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('MapLevels', null, {});
  }
};
