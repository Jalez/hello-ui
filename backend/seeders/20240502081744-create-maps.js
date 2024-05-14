'use strict';

const maps = [
  {
    name: 'newOne',
    random: 1,
    canUseAI: true,
    easyLevelPoints: 5,
    mediumLevelPoints: 10,
    hardLevelPoints: 15
  },
  {
    name: 'test',
    random: 0,
    canUseAI: false,
    easyLevelPoints: 1,
    mediumLevelPoints: 2,
    hardLevelPoints: 3
  },
  {
    name: 'js',
    random: 0,
    canUseAI: false,
    easyLevelPoints: 10,
    mediumLevelPoints: 20,
    hardLevelPoints: 30
  }
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'Maps',
      maps.map(map => ({ ...map, createdAt: now, updatedAt: now }))
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Levels', null, {});
  }
};
