'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('MapLevels', {
      createdAt: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false
      },
      LevelIdentifier: {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Levels',
          key: 'identifier'
        },
        onDelete: 'cascade',
        onUpdate: 'cascade',
        primaryKey: true
      },
      MapName: {
        type: Sequelize.DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'Maps',
          key: 'name'
        },
        onDelete: 'cascade',
        onUpdate: 'cascade',
        primaryKey: true
      }
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('MapLevels');
  }
};
