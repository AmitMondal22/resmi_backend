const { getAllAssignments, createAssignment, deleteAssignment } = require('../controllers/assignmentController');
const { validateBody } = require('../validation/validate');
const { assignmentSchema } = require('../validation/schemas');

async function assignmentRoutes(fastify, options) {
  fastify.get('/', { preValidation: [fastify.authenticate, fastify.requireAdmin] }, getAllAssignments);
  fastify.post('/', {
    preValidation: [fastify.authenticate, fastify.requireAdmin],
    preHandler: validateBody(assignmentSchema)
  }, createAssignment);
  fastify.delete('/:id', {
    preValidation: [fastify.authenticate, fastify.requireAdmin]
  }, deleteAssignment);
}

module.exports = assignmentRoutes;
