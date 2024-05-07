'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('Maps', {
      name: {
        type: Sequelize.DataTypes.STRING,
        primaryKey: true,
        allowNull: false
      },
      random: {
        type: Sequelize.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      canUseAI: {
        type: Sequelize.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      easyLevelPoints: {
        type: Sequelize.DataTypes.INTEGER,
        allowNull: false
      },
      mediumLevelPoints: {
        type: Sequelize.DataTypes.INTEGER,
        allowNull: false
      },
      hardLevelPoints: {
        type: Sequelize.DataTypes.INTEGER,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false
      }
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('Maps');
  }
};
