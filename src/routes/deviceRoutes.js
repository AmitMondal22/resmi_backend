const { getAllDevices, createDevice, updateDevice, deleteDevice } = require('../controllers/deviceController');
const { validateBody } = require('../validation/validate');
const { deviceCreateSchema, deviceUpdateSchema } = require('../validation/schemas');

async function deviceRoutes(fastify, options) {
  fastify.get('/', { preValidation: [fastify.authenticate] }, getAllDevices);
  fastify.post('/', {
    preValidation: [fastify.authenticate, fastify.requireAdmin],
    preHandler: validateBody(deviceCreateSchema)
  }, createDevice);
  fastify.put('/:id', {
    preValidation: [fastify.authenticate, fastify.requireAdmin],
    preHandler: validateBody(deviceUpdateSchema)
  }, updateDevice);
  fastify.delete('/:id', {
    preValidation: [fastify.authenticate, fastify.requireAdmin]
  }, deleteDevice);
}

module.exports = deviceRoutes;
