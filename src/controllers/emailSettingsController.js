const { EmailRecipient } = require('../db/models');
const { sendScheduledDailyEmails } = require('../services/scheduledEmailService');

async function getEmailRecipients(request, reply) {
  try {
    // Return only non-deleted recipients for configuration
    const recipients = await EmailRecipient.findAll({
      where: { isDeleted: false },
      order: [['id', 'ASC']]
    });
    return recipients;
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

async function saveEmailSettings(request, reply) {
  const { recipients } = request.body;
  if (!Array.isArray(recipients)) {
    return reply.status(400).send({ error: 'Recipients list is required and must be an array' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  try {
    // 1. Get all current recipients in DB
    const existingRecipients = await EmailRecipient.findAll();
    const existingEmails = existingRecipients.map(r => r.email.toLowerCase());
    const incomingEmails = recipients.map(r => r.email.toLowerCase());

    // 2. Handle deletions: if existing is not in incoming list
    for (const existing of existingRecipients) {
      const emailLower = existing.email.toLowerCase();
      if (!incomingEmails.includes(emailLower)) {
        if (existing.effectiveStatus === 'none') {
          // If it was just added today and never took effect, delete it immediately
          await existing.destroy();
        } else {
          // Otherwise queue it for next-day deletion
          existing.isDeleted = true;
          await existing.save();
        }
      }
    }

    // 3. Handle additions and modifications
    for (const item of recipients) {
      if (!item.email || !emailRegex.test(item.email)) {
        return reply.status(400).send({ error: `Invalid email address: ${item.email || 'empty'}` });
      }
      
      const emailLower = item.email.toLowerCase();
      const existing = existingRecipients.find(r => r.email.toLowerCase() === emailLower);
      const status = item.status === 'active' || item.status === true ? 'active' : 'inactive';

      if (existing) {
        // Existing recipient: update status and ensure isDeleted is false
        existing.status = status;
        existing.isDeleted = false;
        await existing.save();
      } else {
        // New recipient: create as pending (effectiveStatus: 'none')
        await EmailRecipient.create({
          email: item.email,
          status: status,
          effectiveStatus: 'none',
          isDeleted: false
        });
      }
    }

    return { success: true, message: 'Settings saved successfully. Changes will take effect tomorrow.' };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
}

module.exports = {
  getEmailRecipients,
  saveEmailSettings
};
