'use strict';

const maps = [
  {
    name: 'newOne',
    random: 1,
    canUseAI: true
  },
  {
    name: 'test',
    random: 0,
    canUseAI: false
  },
  {
    name: 'js',
    random: 0,
    canUseAI: false
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
