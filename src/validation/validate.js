const validateBody = (schema) => (request, reply, done) => {
  const { error } = schema.validate(request.body);
  if (error) {
    reply.status(400).send({ error: error.details[0].message });
  } else {
    done();
  }
};

module.exports = {
  validateBody,
};
