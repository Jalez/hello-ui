const Joi = require('joi');

const idSchema = () => {
  return Joi.string()
    .normalize()
    .trim()
    .guid({ version: 'uuidv1', separator: '-' })
    .label('Level identifier');
};

const nameSchema = () => {
  return Joi.string().normalize().trim().min(1);
};

const levelSchema = Joi.object({
  identifier: idSchema().alter({
    create: schema => schema.forbidden(), // autogenerate identifier during create
    update: schema => schema.forbidden() // do not allow changing identifier afterwards
  }),
  name: nameSchema().alter({
    create: schema => schema.required(),
    update: schema => schema.optional()
  }),
  json: Joi.any().forbidden(),
  createdAt: Joi.date().strip().optional(),
  updatedAt: Joi.date().strip().optional()
}).unknown();

module.exports = { idSchema, nameSchema, levelSchema };
