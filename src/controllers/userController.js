const { User } = require('../db/models');

async function getAllUsers(request, reply) {
  const users = await User.findAll({ attributes: { exclude: ['password'] } });
  return users;
}

async function createUser(request, reply) {
  const { username, password, role } = request.body;
  try {
    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return reply.status(400).send({ error: 'Username is already taken' });
    }
    const user = await User.create({ username, password, role });
    return { id: user.id, username: user.username, role: user.role };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function updateUser(request, reply) {
  const { id } = request.params;
  const { username, password, role } = request.body;
  try {
    const user = await User.findByPk(id);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    if (username) user.username = username;
    if (password) user.password = password; // triggers beforeSave hook hashing
    if (role) user.role = role;

    await user.save();
    return { id: user.id, username: user.username, role: user.role };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function deleteUser(request, reply) {
  const { id } = request.params;
  const user = await User.findByPk(id);
  if (!user) {
    return reply.status(404).send({ error: 'User not found' });
  }
  if (user.username === 'admin') {
    return reply.status(400).send({ error: 'Cannot delete primary admin account' });
  }
  await user.destroy();
  return { message: 'User deleted successfully' };
}

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
};
