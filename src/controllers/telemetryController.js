const { UserDevice } = require('../db/models');
const { queryTelemetry, queryLatestTelemetry } = require('../influx/influx');

async function getTelemetryHistory(request, reply) {
  const { deviceId, fromDate, toDate, interval } = request.query;
  if (!deviceId) {
    return reply.status(400).send({ error: 'deviceId is required' });
  }

  // Security: Check if user has access to device
  if (request.user.role !== 'admin') {
    const access = await UserDevice.findOne({ where: { UserId: request.user.id, DeviceId: deviceId } });
    if (!access) {
      return reply.status(403).send({ error: 'Access denied to this device data' });
    }
  }

  try {
    const data = await queryTelemetry(deviceId, fromDate, toDate, interval);
    return data;
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function getLatestTelemetry(request, reply) {
  let allowedDeviceIds = [];
  if (request.user.role !== 'admin') {
    try {
      const userDevices = await UserDevice.findAll({ where: { UserId: request.user.id } });
      allowedDeviceIds = userDevices.map(ud => ud.DeviceId);
    } catch (dbErr) {
      return reply.status(550).send({ error: 'Failed to resolve user device permissions' });
    }
  }

  try {
    const latestData = await queryLatestTelemetry(allowedDeviceIds, request.user.role === 'admin');
    return latestData;
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

module.exports = {
  getTelemetryHistory,
  getLatestTelemetry,
};
