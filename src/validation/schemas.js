const Joi = require('joi');

const loginSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  password: Joi.string().min(5).required(),
});

const userCreateSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  password: Joi.string().min(5).required(),
  role: Joi.string().valid('admin', 'user').default('user'),
});

const userUpdateSchema = Joi.object({
  username: Joi.string().min(3).max(30),
  password: Joi.string().min(5).allow('', null).optional(),
  role: Joi.string().valid('admin', 'user'),
});

const deviceCreateSchema = Joi.object({
  id: Joi.string().min(3).max(50).required(),
  name: Joi.string().min(3).max(100).required(),
  site: Joi.string().allow('', null).optional(),
  location: Joi.string().allow('', null).optional(),
  details: Joi.string().allow('', null).optional(),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

const deviceUpdateSchema = Joi.object({
  name: Joi.string().min(3).max(100),
  site: Joi.string().allow('', null).optional(),
  location: Joi.string().allow('', null).optional(),
  details: Joi.string().allow('', null).optional(),
  status: Joi.string().valid('active', 'inactive'),
});

const assignmentSchema = Joi.object({
  userId: Joi.number().integer().required(),
  deviceId: Joi.string().required(),
});

module.exports = {
  loginSchema,
  userCreateSchema,
  userUpdateSchema,
  deviceCreateSchema,
  deviceUpdateSchema,
  assignmentSchema,
};
