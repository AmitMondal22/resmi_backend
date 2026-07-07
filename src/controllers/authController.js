const { User } = require('../db/models');

async function login(request, reply) {
  const { username, password } = request.body;
  const user = await User.findOne({ where: { username } });
  if (!user) {
    return reply.status(401).send({ error: 'Invalid username or password' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return reply.status(401).send({ error: 'Invalid username or password' });
  }

  const token = request.server.jwt.sign({
    id: user.id,
    username: user.username,
    role: user.role,
  });

  return { token, user: { id: user.id, username: user.username, role: user.role } };
}

async function register(request, reply) {
  const { username, password, role } = request.body;
  try {
    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return reply.status(400).send({ error: 'Username is already taken' });
    }
    const user = await User.create({ username, password, role });
    return { success: true, message: 'User registered successfully', userId: user.id };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

module.exports = {
  login,
  register,
};
