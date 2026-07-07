const { login, register } = require('../controllers/authController');
const { validateBody } = require('../validation/validate');
const { loginSchema, userCreateSchema } = require('../validation/schemas');

async function authRoutes(fastify, options) {
  fastify.post('/login', { preHandler: validateBody(loginSchema) }, login);
  fastify.post('/register', { preHandler: validateBody(userCreateSchema) }, register);
}

module.exports = authRoutes;
