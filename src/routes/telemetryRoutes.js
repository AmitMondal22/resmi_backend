const { getTelemetryHistory, getLatestTelemetry } = require('../controllers/telemetryController');

async function telemetryRoutes(fastify, options) {
  fastify.get('/history', { preValidation: [fastify.authenticate] }, getTelemetryHistory);
  fastify.get('/latest', { preValidation: [fastify.authenticate] }, getLatestTelemetry);
}

module.exports = telemetryRoutes;
