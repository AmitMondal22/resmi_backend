const { UserDevice, Device } = require('../db/models');
const { queryTelemetry, queryLatestTelemetry, getBaseTotalizers } = require('../influx/influx');
const { generateExcelReport } = require('../services/excelReportService');

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

async function exportTelemetryExcel(request, reply) {
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
    const device = await Device.findByPk(deviceId);
    if (!device) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    const rows = await queryTelemetry(deviceId, fromDate, toDate, interval);
    const lastRow = rows.length > 0 ? rows[rows.length - 1] : { cumulativeTotalizer: 0 };
    const bases = await getBaseTotalizers(deviceId, lastRow.cumulativeTotalizer);

    let dateStr = '';
    if (fromDate && toDate) {
      const startStr = fromDate.split('T')[0];
      const endStr = toDate.split('T')[0];
      dateStr = startStr === endStr ? startStr : `${startStr} to ${endStr}`;
    } else {
      dateStr = new Date().toISOString().split('T')[0];
    }

    const excelBuffer = await generateExcelReport(device, rows, dateStr, bases);

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="Flow_Report_${deviceId}_${dateStr}.xlsx"`);
    return reply.send(excelBuffer);
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

module.exports = {
  getTelemetryHistory,
  getLatestTelemetry,
  exportTelemetryExcel,
};
