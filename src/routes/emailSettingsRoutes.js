const { getEmailRecipients, saveEmailSettings } = require('../controllers/emailSettingsController');

async function emailSettingsRoutes(fastify, options) {
  fastify.get('/', { preValidation: [fastify.authenticate, fastify.requireAdmin] }, getEmailRecipients);
  fastify.post('/save', { preValidation: [fastify.authenticate, fastify.requireAdmin] }, saveEmailSettings);
}

module.exports = emailSettingsRoutes;
