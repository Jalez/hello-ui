'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Map extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate (models) {
      // define association here
      Map.belongsToMany(models.Level, { through: 'MapLevels' });
    }
  }
  Map.init(
    {
      name: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        validate: { notEmpty: true, isAlphanumeric: true, not: /^names$/i }
      },
      random: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { isInt: true, min: 0 }
      },
      canUseAI: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    },
    {
      sequelize,
      modelName: 'Map'
    }
  );
  return Map;
};
