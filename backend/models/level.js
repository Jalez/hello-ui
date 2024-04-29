'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Level extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate (models) {
      // define association here
      Level.belongsToMany(models.Map, { through: 'MapLevels' });
    }
  }
  Level.init(
    {
      identifier: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV1,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true }
      },
      json: {
        type: DataTypes.JSON,
        allowNull: false,
        get () {
          const rawJson = this.getDataValue('json');
          return JSON.parse(rawJson);
        },
        set (value) {
          this.setDataValue('json', JSON.stringify(value));
        }
      }
    },
    {
      sequelize,
      modelName: 'Level'
    }
  );
  return Level;
};
