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
          const parsedJSON = JSON.parse(rawJson);

          // add identifier and name back to the json
          if (this.identifier) parsedJSON.identifier = this.identifier;
          if (this.name) parsedJSON.name = this.name;

          return parsedJSON;
        },
        set (value) {
          const valueCopy = { ...value };

          // remove identifier and name (do not save them twice in the database)
          delete valueCopy.identifier;
          delete valueCopy.name;

          this.setDataValue('json', JSON.stringify(valueCopy));
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
