const mqtt = require('mqtt');
const { writeTelemetry } = require('../influx/influx');

let mqttClient = null;

function initMqtt(onTelemetry) {
  const host = process.env.MQTT_HOST || 'localhost';
  const port = parseInt(process.env.MQTT_PORT) || 1883;
  const username = process.env.MQTT_USERNAME || process.env.MQTT_USER || '';
  const password = process.env.MQTT_PASSWORD || process.env.MQTT_PASS || '';

  const options = {
    reconnectPeriod: 5000,
  };

  if (username) {
    options.username = username;
  }
  if (password) {
    options.password = password;
  }

  let mqttUrl = process.env.MQTT_URL;
  if (!mqttUrl) {
    const protocol = host.includes('://') ? '' : 'mqtt://';
    mqttUrl = `${protocol}${host}:${port}`;
  }

  console.log(`[MQTT] Connecting to broker at ${mqttUrl}...`);
  mqttClient = mqtt.connect(mqttUrl, options);

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected to broker successfully.');
    mqttClient.subscribe('techavo/gateway/+/data', (err) => {
      if (err) {
        console.error('[MQTT] Subscription error:', err);
      } else {
        console.log('[MQTT] Subscribed to "techavo/gateway/+/data" topic.');
      }
    });
  });

const { AlertRule, AlertLog } = require('../db/models');
const { sendAlertEmail } = require('../services/emailService');

async function checkThresholdAlerts(deviceId, flow) {
  try {
    const rules = await AlertRule.findAll({ where: { deviceId } });
    if (rules.length === 0) return;

    const now = new Date();
    for (const rule of rules) {
      let triggered = false;
      const val = parseFloat(flow);
      const threshold = parseFloat(rule.value);

      switch (rule.operator) {
        case '>':
          triggered = val > threshold;
          break;
        case '<':
          triggered = val < threshold;
          break;
        case '<=':
          triggered = val <= threshold;
          break;
        case '>=':
          triggered = val >= threshold;
          break;
        case '=':
          triggered = val === threshold;
          break;
        default:
          break;
      }

      if (triggered) {
        // Cooldown check
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        const lastTriggered = rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt).getTime() : 0;
        
        if (now.getTime() - lastTriggered >= cooldownMs) {
          // Trigger the alert!
          const message = `Flow Rate is ${val.toFixed(2)} L/min, breaching threshold: ${rule.operator} ${threshold.toFixed(2)} L/min.`;
          
          // Log alert to database
          await AlertLog.create({
            deviceId,
            severity: rule.severity,
            message,
            timestamp: now,
          });

          // Update lastTriggeredAt timestamp
          await rule.update({ lastTriggeredAt: now });

          // Send Alert Email
          await sendAlertEmail({
            to: rule.email,
            subject: `Flow Threshold Breach on ${deviceId}`,
            body: `Flow Rate threshold breached for device ${deviceId}.\n\nCondition: ${rule.operator} ${threshold} L/min\nObserved Flow Rate: ${val.toFixed(2)} L/min\nSeverity: ${rule.severity.toUpperCase()}\nTriggered At: ${now.toLocaleString()}`,
            severity: rule.severity,
            deviceId,
          });
        }
      }
    }
  } catch (err) {
    console.error(`[Alerts Engine Error] Failed checking thresholds for device ${deviceId}:`, err.message);
  }
}

function uint32(low, high) {
  return (low || 0) + (high || 0) * 65536;
}

  mqttClient.on('message', async (topic, message) => {
    try {
      console.log(`[MQTT Message] Topic: "${topic}" | Raw Payload:`, message.toString());
      const parts = topic.split('/');
      const payload = JSON.parse(message.toString());

      // If payload result is response_timeout, skip processing
      if (payload.result === 'response_timeout') {
        console.log(`[MQTT Parser] Skipping packet with result "response_timeout" for device: ${payload.device_id || 'unknown'}`);
        return;
      }

      // Parse deviceId from payload, fallback to topic segments
      const deviceId = payload.device_id || parts[2] || parts[3] || parts[1];

      // Parse telemetry values from registers array, fallback to flow/total_flow properties
      let flow = 0;
      let total_flow = 0;
      let minValue = 0;
      let maxValue = 0;
      let overflowCount = 0;

      if (payload.registers && Array.isArray(payload.registers)) {
        const r = payload.registers;
        minValue = uint32(r[0], r[1]) / 100;
        maxValue = uint32(r[2], r[3]) / 100;
        flow = uint32(r[4], r[5]) / 100;
        total_flow = uint32(r[6], r[7]) / 100;
        overflowCount = uint32(r[8], r[9]);
      } else {
        flow = (parseFloat(payload.flowRate || payload.flow) || 0) / 100;
        total_flow = (parseFloat(payload.totalizer || payload.total_flow) || 0) / 100;
        minValue = (parseFloat(payload.minValue) || 0) / 100;
        maxValue = (parseFloat(payload.maxValue) || 0) / 100;
        overflowCount = parseInt(payload.overflowCount) || 0;
      }

      // Parse timestamp from payload time field, fallback to current time
      const timestamp = payload.time || new Date().toISOString();

      const cumulativeTotalizer = overflowCount * 1000000 + total_flow;

      console.log({
        minValue,
        maxValue,
        flowRate: flow,
        totalizer: total_flow,
        overflowCount,
        cumulativeTotalizer
      });

      // Write to InfluxDB time-series
      await writeTelemetry(deviceId, flow, total_flow, minValue, maxValue, overflowCount, cumulativeTotalizer, timestamp);

      // Check active threshold rules
      await checkThresholdAlerts(deviceId, flow);

      // Broadcast to WebSocket connections
      if (onTelemetry) {
        onTelemetry({
          deviceId,
          flow,
          total_flow,
          minValue,
          maxValue,
          overflowCount,
          cumulativeTotalizer,
          timestamp
        });
      }
    } catch (err) {
      console.error('[MQTT] Failed to process message:', err.message);
    }
  });

  mqttClient.on('error', (err) => {
    console.error('[MQTT] Connection error:', err);
  });

  mqttClient.on('close', () => {
    console.log('[MQTT] Connection closed.');
  });
}

module.exports = {
  initMqtt
};
