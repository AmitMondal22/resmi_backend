const { getRules, createRule, deleteRule, getAlertLogs } = require('../controllers/alertController');

async function alertRoutes(fastify, options) {
  fastify.get('/rules', { preValidation: [fastify.authenticate] }, getRules);
  fastify.post('/rules', { preValidation: [fastify.authenticate] }, createRule);
  fastify.delete('/rules/:id', { preValidation: [fastify.authenticate] }, deleteRule);
  fastify.get('/logs', { preValidation: [fastify.authenticate] }, getAlertLogs);
}

module.exports = alertRoutes;
