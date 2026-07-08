require('dotenv').config();
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const websocket = require('@fastify/websocket');
const { sequelize, User, Device, UserDevice } = require('./db/models');
const { initMqtt } = require('./mqtt/mqttClient');

const fastify = Fastify({ logger: true });

// Setup middleware
fastify.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'supersecretjwtkey123!',
});

fastify.register(websocket);

// Authenticate Decorator
fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// Admin Check Decorator
fastify.decorate('requireAdmin', async (request, reply) => {
  if (!request.user || request.user.role !== 'admin') {
    reply.status(403).send({ error: 'Forbidden: Admin access required' });
  }
});

// ================= REGISTER MVC ROUTES =================
fastify.register(require('./routes/authRoutes'), { prefix: '/api/auth' });
fastify.register(require('./routes/userRoutes'), { prefix: '/api/users' });
fastify.register(require('./routes/deviceRoutes'), { prefix: '/api/devices' });
fastify.register(require('./routes/assignmentRoutes'), { prefix: '/api/assignments' });
fastify.register(require('./routes/telemetryRoutes'), { prefix: '/api/telemetry' });
fastify.register(require('./routes/alertRoutes'), { prefix: '/api/alerts' });

// ================= WEBSOCKET LIVE ROUTE =================
fastify.register(async (fastify) => {
  fastify.get('/ws/live', { websocket: true }, (socket, req) => {
    socket.deviceId = null;
    socket.userId = null;
    socket.userRole = null;

    socket.on('message', async (message) => {
      try {
        const payload = JSON.parse(message.toString());
        
        // Handle auth & subscription
        if (payload.action === 'subscribe') {
          if (payload.token) {
            try {
              const decoded = fastify.jwt.verify(payload.token);
              socket.userId = decoded.id;
              socket.userRole = decoded.role;
            } catch (authErr) {
              socket.send(JSON.stringify({ error: 'Auth failed' }));
              socket.close();
              return;
            }
          }

          const deviceId = payload.deviceId;
          // Verify user has access to this device
          if (socket.userRole !== 'admin') {
            const hasAccess = await UserDevice.findOne({ where: { UserId: socket.userId, DeviceId: deviceId } });
            if (!hasAccess) {
              socket.send(JSON.stringify({ error: 'Access to device denied' }));
              return;
            }
          }

          socket.deviceId = deviceId;
          console.log(`[WS] Connection ${socket.userId} subscribed to device telemetry: ${deviceId}`);
          socket.send(JSON.stringify({ status: `Subscribed to ${deviceId}` }));
        }
      } catch (wsErr) {
        console.error('[WS Message Error]', wsErr);
      }
    });

    socket.on('close', () => {
      console.log('[WS] Client disconnected.');
    });
  });
});

const PORT = process.env.PORT || 5000;

async function start() {
  try {

    
    // Setup MQTT subscription and direct websocket broadcast callback
    initMqtt((data) => {
      if (!fastify.websocketServer) return;
      
      fastify.websocketServer.clients.forEach((client) => {
        if (client.readyState === 1 && client.deviceId === data.deviceId) {
          client.send(JSON.stringify(data));
        }
      });
    });

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Fastify] Server is running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
