const { User, Device } = require('../db/models');

async function getAllDevices(request, reply) {
  if (request.user.role === 'admin') {
    const devices = await Device.findAll();
    return devices;
  } else {
    const user = await User.findByPk(request.user.id);
    const devices = await user.getDevices();
    return devices;
  }
}

async function createDevice(request, reply) {
  const { id, name, site, location, details, status } = request.body;
  try {
    const existing = await Device.findByPk(id);
    if (existing) {
      return reply.status(400).send({ error: 'Device with this ID already exists' });
    }
    const device = await Device.create({ id, name, site, location, details, status });
    return device;
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function updateDevice(request, reply) {
  const { id } = request.params;
  const { name, site, location, details, status } = request.body;
  try {
    const device = await Device.findByPk(id);
    if (!device) {
      return reply.status(404).send({ error: 'Device not found' });
    }
    if (name) device.name = name;
    if (site !== undefined) device.site = site;
    if (location !== undefined) device.location = location;
    if (details !== undefined) device.details = details;
    if (status) device.status = status;

    await device.save();
    return device;
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function deleteDevice(request, reply) {
  const { id } = request.params;
  const device = await Device.findByPk(id);
  if (!device) {
    return reply.status(404).send({ error: 'Device not found' });
  }
  await device.destroy();
  return { message: 'Device deleted successfully' };
}

module.exports = {
  getAllDevices,
  createDevice,
  updateDevice,
  deleteDevice,
};
