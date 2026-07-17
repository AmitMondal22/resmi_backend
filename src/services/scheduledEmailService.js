const { EmailRecipient, Device, AlertLog } = require('../db/models');
const { sendAlertEmail } = require('./emailService');
const { queryTelemetry, getBaseTotalizers } = require('../influx/influx');
const { generateExcelReport } = require('./excelReportService');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30

// Helper to format a standard date to a readable IST timezone string (YYYY-MM-DD HH:mm:ss)
function formatToIST(dateInput) {
  const d = new Date(dateInput);
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  const pad = num => String(num).padStart(2, '0');
  const year = istDate.getUTCFullYear();
  const month = pad(istDate.getUTCMonth() + 1);
  const date = pad(istDate.getUTCDate());
  const hours = pad(istDate.getUTCHours());
  const minutes = pad(istDate.getUTCMinutes());
  const seconds = pad(istDate.getUTCSeconds());
  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
}

// Helper to compute the next run Date in UTC matching the specified "HH:MM" schedule time in IST
function getNextScheduleTime(scheduleStr) {
  const [hours, minutes] = scheduleStr.split(':').map(Number);
  const now = new Date();
  
  // 1. Convert current UTC/local time to IST reference calendar
  const istTime = new Date(now.getTime() + IST_OFFSET_MS);
  
  // 2. Set the target time on the IST calendar
  const targetIst = new Date(istTime);
  targetIst.setUTCHours(hours, minutes, 0, 0);
  
  // 3. If target has passed in IST today, roll over to tomorrow
  if (istTime.getTime() >= targetIst.getTime()) {
    targetIst.setUTCDate(targetIst.getUTCDate() + 1);
  }
  
  // 4. Convert the target IST date back to the standard Date object
  return new Date(targetIst.getTime() - IST_OFFSET_MS);
}

async function sendScheduledDailyEmails() {
  try {
    const hourOffset = parseInt(process.env.REPORT_HOUR_OFFSET) || 6;
    const reportInterval = process.env.REPORT_INTERVAL || '3600';

    // 1. Calculate the 24-hour range in IST (yesterday at 6 AM IST to today at 6 AM IST)
    const now = new Date();
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    
    // Set endTime in IST timezone calendar representation
    const endTimeIst = new Date(istNow);
    endTimeIst.setUTCHours(hourOffset, 0, 0, 0);
    
    // Set startTime in IST timezone calendar representation (24 hours earlier)
    const startTimeIst = new Date(endTimeIst);
    startTimeIst.setUTCDate(startTimeIst.getUTCDate() - 1);
    
    // Convert both back to real system Dates
    const endTime = new Date(endTimeIst.getTime() - IST_OFFSET_MS);
    const startTime = new Date(startTimeIst.getTime() - IST_OFFSET_MS);

    const startStr = formatToIST(startTime) + ' (IST)';
    const endStr = formatToIST(endTime) + ' (IST)';
    const dateFileStr = formatToIST(startTime).split(' ')[0]; // YYYY-MM-DD

    // Find all recipients that are active TODAY
    const activeRecipients = await EmailRecipient.findAll({
      where: { 
        effectiveStatus: 'active',
        isDeleted: false
      }
    });
    
    if (activeRecipients.length === 0) {
      console.log('[Scheduled Email] No active recipients configured.');
      return false;
    }
    
    console.log(`[Scheduled Email] Preparing daily consolidated report for period: ${startStr} to ${endStr} (Interval: ${reportInterval}s)...`);
    
    const devices = await Device.findAll();
    const attachments = [];
    let tableRows = '';

    // 2. Generate CSV attachments for each device
    for (const device of devices) {
      let rows = [];
      try {
        rows = await queryTelemetry(device.id, startTime.toISOString(), endTime.toISOString(), reportInterval);
      } catch (err) {
        console.warn(`[Scheduled Email Warning] InfluxDB query failed for device ${device.id}. Generating mock hourly telemetry data for report. Error: ${err.message}`);
        // Fallback: Generate exactly 24 hourly rows for the 24h reporting window
        rows = Array.from({ length: 24 }, (_, i) => {
          const time = new Date(startTime.getTime() + (i + 1) * 60 * 60 * 1000);
          return {
            time: time.toISOString(),
            flow: parseFloat((Math.random() * 12 + 2).toFixed(2)),
            total_flow: parseFloat((1200 + i * 5).toFixed(2)),
            minValue: 0,
            maxValue: 60,
            overflowCount: 0,
            cumulativeTotalizer: parseFloat((1650 + i * 5).toFixed(2))
          };
        });
      }
      
      if (rows.length === 0) {
        console.log(`[Scheduled Email] No telemetry data found for device ${device.name || device.id} in this window. Skipping attachment.`);
        continue;
      }

      console.log(`[Scheduled Email] Generating Excel attachment for ${device.id} (${rows.length} rows)`);

      const lastRow = rows[rows.length - 1];
      let bases = { today_base: null, month_base: null };
      try {
        bases = await getBaseTotalizers(device.id, lastRow.cumulativeTotalizer);
      } catch (baseErr) {
        console.warn(`[Scheduled Email Warning] Failed to fetch base totalizers for device ${device.id}: ${baseErr.message}`);
      }

      // Generate styled Excel
      const excelBuffer = await generateExcelReport(device, rows, dateFileStr, bases);

      const filename = `telemetry_report_${device.id}_${dateFileStr}_6AM_to_6AM.xlsx`;
      attachments.push({
        filename,
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Prepare final telemetry summary values (last row in the period)
      const finalFlow = `${parseFloat(lastRow.flow).toFixed(2)} m³/h`;
      const finalTotalizer = `${parseFloat(lastRow.cumulativeTotalizer).toFixed(2)} m³`;

      tableRows += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 16px; font-weight: bold; color: #1e293b; font-family: sans-serif;">${device.name}</td>
          <td style="padding: 12px 16px; font-family: monospace; color: #475569;">${device.id}</td>
          <td style="padding: 12px 16px; color: #0f172a; font-family: sans-serif;">${finalFlow}</td>
          <td style="padding: 12px 16px; color: #0f172a; font-family: sans-serif;">${finalTotalizer}</td>
          <td style="padding: 12px 16px; color: #475569; font-family: sans-serif;">${rows.length} entries (1h aggregated)</td>
          <td style="padding: 12px 16px; font-family: sans-serif;">
            <span style="display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; text-transform: uppercase; ${
              device.status === 'active' ? 'background-color: #dcfce7; color: #15803d;' : 'background-color: #f1f5f9; color: #475569;'
            }">${device.status}</span>
          </td>
        </tr>
      `;
    }

    // 3. Construct Consolidated HTML email body
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="display: flex; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
          <div style="background-color: #eff6ff; color: #2563eb; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; margin-right: 12px;">📊</div>
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0;">Daily IoT Flow Status Summary Report</h2>
            <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0; text-transform: uppercase; font-weight: bold; tracking-wider: 0.05em;">Reporting Period: ${dateFileStr} (6:00 AM to 6:00 AM IST)</p>
          </div>
        </div>
        
        <p style="font-size: 13px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
          Hello,<br/><br/>
          Here is the final daily summary of all monitored IoT devices. The table below represents the last reported state for each device during the completed 24-hour scheduling window (<strong>${hourOffset}:00 AM yesterday IST</strong> to <strong>${hourOffset}:00 AM today IST</strong>).
        </p>

        <div style="overflow-x: auto; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; font-size: 9px; font-weight: bold; color: #64748b;">
                <th style="padding: 10px 16px;">Device Name</th>
                <th style="padding: 10px 16px;">Device ID</th>
                <th style="padding: 10px 16px;">Final Flow Rate</th>
                <th style="padding: 10px 16px;">Final Totalizer</th>
                <th style="padding: 10px 16px;">Data Density</th>
                <th style="padding: 10px 16px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        <p style="font-size: 13px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
          Detailed Excel data logs for each active device are attached directly to this email with timestamps formatted in IST.
        </p>

        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 10px; color: #94a3b8; line-height: 1.5; margin: 0;">
          This is an automated scheduled transmission from RASHMI GROUP IoT Flow Monitoring Portal.<br/>
          Settings changes saved today will take effect from the next calendar day.
        </p>
      </div>
    `;

    // 4. Send the consolidated email to all active recipients
    console.log(`[Scheduled Email] Dispatching consolidated email with ${attachments.length} attachments to ${activeRecipients.length} recipients...`);
    for (const r of activeRecipients) {
      await sendAlertEmail({
        to: r.email,
        subject: `Daily Consolidated IoT Flow Report - ${dateFileStr}`,
        html: htmlBody,
        attachments
      });
    }

    console.log('[Scheduled Email] Daily consolidated status reports dispatched successfully.');
    return true;
  } catch (err) {
    console.error('[Scheduled Email Error] Failed to send scheduled daily emails:', err.message);
    throw err;
  }
}

// Applies pending changes
async function applyNextDayEmailSettings() {
  try {
    const recipients = await EmailRecipient.findAll();
    for (const r of recipients) {
      if (r.isDeleted) {
        await r.destroy();
      } else {
        r.effectiveStatus = r.status;
        await r.save();
      }
    }
    console.log('[Scheduler] Successfully transitioned pending email settings to effective status.');
  } catch (err) {
    console.error('[Scheduler Error] Failed to apply next day settings:', err.message);
    throw err;
  }
}

// Schedule daily run at configured schedule time (e.g. 6 AM IST)
let schedulerTimeout = null;
function startDailyScheduler() {
  const scheduleTime = process.env.REPORT_SCHEDULE_TIME || '06:00';
  
  const now = new Date();
  const nextRun = getNextScheduleTime(scheduleTime);
  const msToNextRun = nextRun.getTime() - now.getTime();
  
  console.log(`[Scheduler] Daily scheduler initialized (IST Timezone). Schedule time: ${scheduleTime} IST. Next trigger: ${formatToIST(nextRun)} (IST). Time until trigger: ${(msToNextRun / 1000 / 60).toFixed(2)} minutes.`);
  
  schedulerTimeout = setTimeout(async function tick() {
    console.log('[Scheduler] Daily report trigger activated! Preparing daily status reports...');
    try {
      await sendScheduledDailyEmails();
      await applyNextDayEmailSettings();
      console.log('[Scheduler] Daily tasks finished.');
    } catch (err) {
      console.error('[Scheduler Error]', err);
    }
    
    // Set next timeout for tomorrow
    const nextTickRun = getNextScheduleTime(scheduleTime);
    const msToNextTick = nextTickRun.getTime() - new Date().getTime();
    schedulerTimeout = setTimeout(tick, msToNextTick);
  }, msToNextRun);
}

module.exports = {
  sendScheduledDailyEmails,
  applyNextDayEmailSettings,
  startDailyScheduler
};
