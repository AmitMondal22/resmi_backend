const { User, Device, UserDevice } = require('../db/models');

async function getAllAssignments(request, reply) {
  const assignments = await UserDevice.findAll({
    include: [
      { model: User, attributes: ['id', 'username'] },
      { model: Device, attributes: ['id', 'name'] },
    ],
  });

  const list = assignments.map(a => ({
    id: a.id,
    userId: a.UserId,
    deviceId: a.DeviceId,
    username: a.User ? a.User.username : 'Unknown',
    deviceName: a.Device ? a.Device.name : 'Unknown'
  }));
  return list;
}

async function createAssignment(request, reply) {
  const { userId, deviceId } = request.body;
  try {
    const user = await User.findByPk(userId);
    const device = await Device.findByPk(deviceId);
    if (!user || !device) {
      return reply.status(404).send({ error: 'User or Device not found' });
    }
    
    const existing = await UserDevice.findOne({ where: { UserId: userId, DeviceId: deviceId } });
    if (existing) {
      return reply.status(400).send({ error: 'Device is already assigned to this user' });
    }

    const assignment = await UserDevice.create({ UserId: userId, DeviceId: deviceId });
    return { success: true, id: assignment.id, userId, deviceId };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function deleteAssignment(request, reply) {
  const { id } = request.params;
  const assignment = await UserDevice.findByPk(id);
  if (!assignment) {
    return reply.status(404).send({ error: 'Assignment not found' });
  }
  await assignment.destroy();
  return { message: 'Device unassigned from user successfully' };
}

module.exports = {
  getAllAssignments,
  createAssignment,
  deleteAssignment,
};
