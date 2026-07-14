const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT) || 587;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM || 'alerts@rashmigroup.com';

let transporter = null;
const isConfigured = !!(host && user && pass);

if (isConfigured) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
  console.log(`[Email Service] SMTP Transporter initialized successfully for host ${host}.`);
} else {
  console.log(`[Email Service] Running in SIMULATION MODE. Telemetry thresholds will trigger terminal mockups.`);
}

async function sendAlertEmail({ to, subject, body, severity, deviceId, html, attachments }) {
  const badge = severity ? `[${severity.toUpperCase()}]` : '';
  const finalSubject = severity ? `${badge} ${subject}` : subject;
  
  if (isConfigured && transporter) {
    try {
      const mailOptions = {
        from,
        to,
        subject: finalSubject,
        text: body,
      };

      if (html) {
        mailOptions.html = html;
      } else {
        const badgeText = severity ? `[${severity.toUpperCase()} ALERT]` : '[INFO]';
        mailOptions.html = `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
          <h2 style="color: ${severity === 'critical' ? '#dc2626' : '#d97706'}; text-transform: uppercase; margin-bottom: 10px;">${badgeText} Device: ${deviceId || 'N/A'}</h2>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8;">This is an automated notification from RASHMI GROUP IoT Flow Monitoring System.</p>
        </div>`;
      }

      if (attachments) {
        mailOptions.attachments = attachments;
      }

      await transporter.sendMail(mailOptions);
      console.log(`[Email Service] Email sent successfully to ${to}`);
      return true;
    } catch (err) {
      console.error(`[Email Service Error] Failed to send email to ${to}:`, err.message);
      return false;
    }
  } else {
    // Simulated print output
    console.log(`
      ============================================================
      SIMULATED EMAIL DISPATCHED
      ============================================================
      From:     ${from}
      To:       ${to}
      Subject:  ${finalSubject}
      Attachments: ${attachments ? attachments.map(a => a.filename).join(', ') : 'None'}

      Content:
      ${html || body}
      ============================================================
    `);
    return true;
  }
}

module.exports = {
  sendAlertEmail,
};
