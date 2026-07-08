const { getAllUsers, createUser, updateUser, deleteUser, getProfile, updateProfile } = require('../controllers/userController');
const { validateBody } = require('../validation/validate');
const { userCreateSchema, userUpdateSchema } = require('../validation/schemas');

async function userRoutes(fastify, options) {
  fastify.get('/profile', { preValidation: [fastify.authenticate] }, getProfile);
  fastify.put('/profile', { preValidation: [fastify.authenticate] }, updateProfile);

  fastify.get('/', { preValidation: [fastify.authenticate, fastify.requireAdmin] }, getAllUsers);
  fastify.post('/', {
    preValidation: [fastify.authenticate, fastify.requireAdmin],
    preHandler: validateBody(userCreateSchema)
  }, createUser);
  fastify.put('/:id', {
    preValidation: [fastify.authenticate, fastify.requireAdmin],
    preHandler: validateBody(userUpdateSchema)
  }, updateUser);
  fastify.delete('/:id', {
    preValidation: [fastify.authenticate, fastify.requireAdmin]
  }, deleteUser);
}

module.exports = userRoutes;
