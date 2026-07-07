const { AlertRule, AlertLog, UserDevice, Device } = require('../db/models');

async function getRules(request, reply) {
  const { deviceId } = request.query;
  if (!deviceId) {
    return reply.status(400).send({ error: 'deviceId is required' });
  }

  // Security check: Verify device access for standard users
  if (request.user.role !== 'admin') {
    const access = await UserDevice.findOne({ where: { UserId: request.user.id, DeviceId: deviceId } });
    if (!access) {
      return reply.status(403).send({ error: 'Access denied to this device' });
    }
  }

  try {
    const rules = await AlertRule.findAll({
      where: { deviceId },
      order: [['createdAt', 'DESC']]
    });
    return rules;
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function createRule(request, reply) {
  const { deviceId, operator, value, severity, email, cooldownMinutes } = request.body;

  if (!deviceId || !operator || value === undefined || !severity || !email) {
    return reply.status(400).send({ error: 'All fields (deviceId, operator, value, severity, email) are required' });
  }

  const validOperators = ['>', '<', '<=', '>=', '='];
  if (!validOperators.includes(operator)) {
    return reply.status(400).send({ error: 'Invalid operator. Must be one of >, <, <=, >=, =' });
  }

  const validSeverities = ['info', 'warning', 'critical'];
  if (!validSeverities.includes(severity)) {
    return reply.status(400).send({ error: 'Invalid severity. Must be info, warning, or critical' });
  }

  // Security check: Verify device access for standard users
  if (request.user.role !== 'admin') {
    const access = await UserDevice.findOne({ where: { UserId: request.user.id, DeviceId: deviceId } });
    if (!access) {
      return reply.status(403).send({ error: 'Access denied to configure this device' });
    }
  }

  try {
    const rule = await AlertRule.create({
      deviceId,
      operator,
      value: parseFloat(value),
      severity,
      email,
      cooldownMinutes: parseInt(cooldownMinutes) || 15,
      lastTriggeredAt: null
    });
    return rule;
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function deleteRule(request, reply) {
  const { id } = request.params;

  try {
    const rule = await AlertRule.findByPk(id);
    if (!rule) {
      return reply.status(404).send({ error: 'Alert rule not found' });
    }

    // Security check: Verify device access for standard users
    if (request.user.role !== 'admin') {
      const access = await UserDevice.findOne({ where: { UserId: request.user.id, DeviceId: rule.deviceId } });
      if (!access) {
        return reply.status(403).send({ error: 'Access denied to modify this device config' });
      }
    }

    await rule.destroy();
    return { message: 'Alert rule deleted successfully' };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function getAlertLogs(request, reply) {
  const { deviceId } = request.query;

  try {
    if (deviceId) {
      // Security check: Verify device access for standard users
      if (request.user.role !== 'admin') {
        const access = await UserDevice.findOne({ where: { UserId: request.user.id, DeviceId: deviceId } });
        if (!access) {
          return reply.status(403).send({ error: 'Access denied to this device' });
        }
      }

      const logs = await AlertLog.findAll({
        where: { deviceId },
        order: [['timestamp', 'DESC']],
        limit: 100
      });
      return logs;
    } else {
      // Return logs across all allowed devices
      let allowedDevices = [];
      if (request.user.role !== 'admin') {
        const userDevices = await UserDevice.findAll({ where: { UserId: request.user.id } });
        allowedDevices = userDevices.map(ud => ud.DeviceId);
        
        if (allowedDevices.length === 0) {
          return [];
        }
      }

      const whereClause = request.user.role === 'admin' ? {} : { deviceId: allowedDevices };
      const logs = await AlertLog.findAll({
        where: whereClause,
        order: [['timestamp', 'DESC']],
        limit: 200
      });
      return logs;
    }
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

module.exports = {
  getRules,
  createRule,
  deleteRule,
  getAlertLogs
};
