"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Groups", "joinKey", {
      type: Sequelize.DataTypes.STRING(32),
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE "Groups"
      SET "joinKey" = UPPER(SUBSTRING(ENCODE(gen_random_bytes(5), 'hex') FROM 1 FOR 10))
      WHERE "joinKey" IS NULL OR "joinKey" = ''
    `);

    await queryInterface.changeColumn("Groups", "joinKey", {
      type: Sequelize.DataTypes.STRING(32),
      allowNull: false,
    });

    await queryInterface.addIndex("Groups", ["joinKey"], {
      name: "groups_join_key_index",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("Groups", "groups_join_key_index");
    await queryInterface.removeColumn("Groups", "joinKey");
  },
};
