"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn("projects", "allow_duplicate_group_users", "allow_duplicate_users");
    await queryInterface.changeColumn("projects", "allow_duplicate_users", {
      type: Sequelize.DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("projects", "allow_duplicate_users", {
      type: Sequelize.DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.renameColumn("projects", "allow_duplicate_users", "allow_duplicate_group_users");
  },
};
