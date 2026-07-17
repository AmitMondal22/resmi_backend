const { getTelemetryHistory, getLatestTelemetry, exportTelemetryExcel } = require('../controllers/telemetryController');

async function telemetryRoutes(fastify, options) {
  fastify.get('/history', { preValidation: [fastify.authenticate] }, getTelemetryHistory);
  fastify.get('/latest', { preValidation: [fastify.authenticate] }, getLatestTelemetry);
  fastify.get('/export-excel', { preValidation: [fastify.authenticate] }, exportTelemetryExcel);
}

module.exports = telemetryRoutes;
