"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.createTable("Levels", {
        identifier: {
          type: Sequelize.DataTypes.UUID,
          defaultValue: Sequelize.DataTypes.UUIDV1,
          allowNull: false,
          primaryKey: true,
        },
        name: {
          type: Sequelize.DataTypes.STRING,
          allowNull: false,
        },
        json: {
          type: Sequelize.DataTypes.JSON,
          allowNull: false,
        },
        createdAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DataTypes.DATE,
          allowNull: false,
        },
      });
    } catch (error) {
      console.log("Error in creating table Levels");
      if (error.errors) {
        error.errors.forEach((errorItem) => {
          console.error(errorItem.message);
        });
      } else {
        console.error(error);
      }
      throw error; // re-throw the error after logging
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Levels");
  },
};
