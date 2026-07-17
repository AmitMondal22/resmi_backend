const ExcelJS = require('exceljs');

/**
 * Helper to apply a border style to a cell.
 */
function setCellBorder(cell, { top, left, bottom, right }) {
  const border = cell.border || {};
  if (top !== undefined) border.top = top ? { style: top } : undefined;
  if (left !== undefined) border.left = left ? { style: left } : undefined;
  if (bottom !== undefined) border.bottom = bottom ? { style: bottom } : undefined;
  if (right !== undefined) border.right = right ? { style: right } : undefined;
  cell.border = border;
}

/**
 * Formats a Date object to IST timestamp (YYYY-MM-DD HH:mm:ss)
 */
function formatToIST(dateInput) {
  const d = new Date(dateInput);
  // Date input is in UTC, format it in IST (UTC+5:30)
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
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

/**
 * Generates a styled Excel sheet matching the Water Consumption Report template.
 * 
 * @param {Object} device - Device DB record { id, name, site, location }
 * @param {Array} rows - Telemetry data rows
 * @param {String} dateStr - Date string for header (e.g. YYYY-MM-DD)
 * @param {Object} bases - Base totalizer values { today_base, month_base }
 * @returns {Promise<Buffer>} - Excel workbook file buffer
 */
async function generateExcelReport(device, rows, dateStr, bases) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1', {
    views: [{ showGridLines: true }]
  });

  // 1. Column dimensions
  worksheet.columns = [
    { key: 'time', width: 13.0 },
    { key: 'reading', width: 9.86 },
    { key: 'avgFlow', width: 10.43 },
    { key: 'flowUnit', width: 11.86 },
    { key: 'velocity', width: 9.71 },
    { key: 'velocityUnit', width: 12.43 },
    { key: 'posComm', width: 21.14 },
    { key: 'negComm', width: 24.29 },
    { key: 'commTotal', width: 18.0 },
    { key: 'commUnit', width: 17.29 }
  ];

  // 2. Row 1: Merged Title
  worksheet.mergeCells('B1:J1');
  const titleCell = worksheet.getCell('B1');
  titleCell.value = 'DAILY WATER METER READING LOG SHEET';
  titleCell.font = { name: 'Calibri', size: 24, bold: false };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 35;

  // Apply borders for Row 1 (A1 separate, B1-J1 merged)
  setCellBorder(worksheet.getCell('A1'), { left: 'medium', top: 'medium', bottom: 'thin', right: 'thin' });
  for (let col = 2; col <= 9; col++) {
    setCellBorder(worksheet.getCell(1, col), { top: 'medium', bottom: 'thin' });
  }
  setCellBorder(worksheet.getCell('J1'), { right: 'medium', top: 'medium', bottom: 'thin' });

  // 3. Row 2: Location and Date
  worksheet.getRow(2).height = 20;
  worksheet.getCell('A2').value = 'Location';
  worksheet.getCell('A2').font = { name: 'Calibri', size: 11, bold: true };
  setCellBorder(worksheet.getCell('A2'), { left: 'medium', top: 'thin', bottom: 'thin', right: 'thin' });

  worksheet.mergeCells('B2:G2');
  const locValCell = worksheet.getCell('B2');
  locValCell.value = device.location || '';
  locValCell.font = { name: 'Calibri', size: 11 };
  locValCell.alignment = { horizontal: 'left', vertical: 'middle' };
  for (let col = 2; col <= 7; col++) {
    setCellBorder(worksheet.getCell(2, col), { top: 'thin', bottom: 'thin' });
  }
  worksheet.getCell('G2').border.right = { style: 'thin' };

  worksheet.getCell('H2').value = 'Date';
  worksheet.getCell('H2').font = { name: 'Calibri', size: 11, bold: true };
  setCellBorder(worksheet.getCell('H2'), { left: 'thin', top: 'thin', bottom: 'thin', right: 'thin' });

  worksheet.mergeCells('I2:J2');
  const dateValCell = worksheet.getCell('I2');
  dateValCell.value = dateStr;
  dateValCell.font = { name: 'Calibri', size: 11 };
  dateValCell.alignment = { horizontal: 'left', vertical: 'middle' };
  setCellBorder(worksheet.getCell('I2'), { top: 'thin', bottom: 'thin' });
  setCellBorder(worksheet.getCell('J2'), { right: 'medium', top: 'thin', bottom: 'thin' });

  // 4. Row 3: Site and Water Meter No
  worksheet.getRow(3).height = 20;
  worksheet.getCell('A3').value = 'Site';
  worksheet.getCell('A3').font = { name: 'Calibri', size: 11, bold: true };
  setCellBorder(worksheet.getCell('A3'), { left: 'medium', top: 'thin', bottom: 'thin', right: 'thin' });

  worksheet.mergeCells('B3:G3');
  const siteValCell = worksheet.getCell('B3');
  siteValCell.value = device.site || '';
  siteValCell.font = { name: 'Calibri', size: 11 };
  siteValCell.alignment = { horizontal: 'left', vertical: 'middle' };
  for (let col = 2; col <= 7; col++) {
    setCellBorder(worksheet.getCell(3, col), { top: 'thin', bottom: 'thin' });
  }
  worksheet.getCell('G3').border.right = { style: 'thin' };

  worksheet.getCell('H3').value = 'Water Meter No';
  worksheet.getCell('H3').font = { name: 'Calibri', size: 11, bold: true };
  setCellBorder(worksheet.getCell('H3'), { left: 'thin', top: 'thin', bottom: 'thin', right: 'thin' });

  worksheet.mergeCells('I3:J3');
  const meterValCell = worksheet.getCell('I3');
  meterValCell.value = device.id;
  meterValCell.font = { name: 'Calibri', size: 11 };
  meterValCell.alignment = { horizontal: 'left', vertical: 'middle' };
  setCellBorder(worksheet.getCell('I3'), { top: 'thin', bottom: 'thin' });
  setCellBorder(worksheet.getCell('J3'), { right: 'medium', top: 'thin', bottom: 'thin' });

  // 5. Row 4: Table Headers
  worksheet.getRow(4).height = 25;
  const headers = [
    { col: 1, val: 'Time' },
    { col: 2, val: 'Reading' },
    { col: 3, val: 'Avg Flow' },
    { col: 4, val: 'Flow Unit' },
    { col: 5, val: 'Velocity' },
    { col: 6, val: 'Velocity Unit' },
    { col: 7, val: 'Positive  Commulative' },
    { col: 8, val: 'Negative  Commulative' },
    { col: 9, val: 'Commulative Total' },
    { col: 10, val: 'Commulative Unit' }
  ];

  headers.forEach(h => {
    const cell = worksheet.getCell(4, h.col);
    cell.value = h.val;
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    
    // Set headers borders
    const isLeft = h.col === 1;
    const isRight = h.col === 10;
    setCellBorder(cell, {
      left: isLeft ? 'medium' : 'thin',
      right: isRight ? 'medium' : 'thin',
      top: 'thin',
      bottom: 'thin'
    });
  });

  // 6. Row 5 onwards: Telemetry data rows
  let nextRow = 5;
  const dataCount = rows.length;
  
  if (dataCount > 0) {
    rows.forEach(r => {
      worksheet.getRow(nextRow).height = 20;
      
      const timeStr = formatToIST(r.time);
      
      const cellValues = {
        A: timeStr,
        B: null, // Reading (leave empty)
        C: r.flow !== undefined ? parseFloat(r.flow) : 0,
        D: 'm3/h',
        E: null, // Velocity (leave empty)
        F: 'm/s',
        G: r.cumulativeTotalizer !== undefined ? parseFloat(r.cumulativeTotalizer) : 0,
        H: 0.00, // Negative Cumulative (always 0)
        I: r.cumulativeTotalizer !== undefined ? parseFloat(r.cumulativeTotalizer) : 0,
        J: 'm3'
      };

      Object.entries(cellValues).forEach(([colLetter, val], idx) => {
        const colIdx = idx + 1;
        const cell = worksheet.getCell(`${colLetter}${nextRow}`);
        cell.value = val;
        cell.font = { name: 'Calibri', size: 11 };

        // Number format
        if (typeof val === 'number') {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Borders
        const isLeft = colIdx === 1;
        const isRight = colIdx === 10;
        setCellBorder(cell, {
          left: isLeft ? 'medium' : 'thin',
          right: isRight ? 'medium' : 'thin',
          top: 'thin',
          bottom: 'thin'
        });
      });
      
      nextRow++;
    });
  } else {
    // Write at least one empty row if no data
    worksheet.getRow(nextRow).height = 20;
    for (let c = 1; c <= 10; c++) {
      const cell = worksheet.getCell(nextRow, c);
      setCellBorder(cell, {
        left: c === 1 ? 'medium' : 'thin',
        right: c === 10 ? 'medium' : 'thin',
        top: 'thin',
        bottom: 'thin'
      });
    }
    nextRow++;
  }

  // 7. Row 29 (Blank Row with left/right medium borders)
  worksheet.getRow(nextRow).height = 20;
  for (let c = 1; c <= 10; c++) {
    const cell = worksheet.getCell(nextRow, c);
    setCellBorder(cell, {
      left: c === 1 ? 'medium' : undefined,
      right: c === 10 ? 'medium' : undefined
    });
  }
  nextRow++;

  // 8. Calculate baseline values for totals
  const lastRowData = rows.length > 0 ? rows[rows.length - 1] : { cumulativeTotalizer: 0 };
  const firstRowData = rows.length > 0 ? rows[0] : { cumulativeTotalizer: 0 };
  const lastTotalizer = parseFloat(lastRowData.cumulativeTotalizer || 0);
  const firstTotalizer = parseFloat(firstRowData.cumulativeTotalizer || 0);

  // Baselines from database
  const prevMonthBase = bases && bases.month_base !== null ? parseFloat(bases.month_base) : firstTotalizer;
  const prevDayBase = bases && bases.today_base !== null ? parseFloat(bases.today_base) : firstTotalizer;

  // Consumptions
  const todayConsumption = Math.max(0, lastTotalizer - prevDayBase);
  const monthConsumption = Math.max(0, lastTotalizer - prevMonthBase);

  // 9. Row 30: Previous Month Totalizer & Today Consumption
  worksheet.getRow(nextRow).height = 25;
  
  // Previous Month block
  worksheet.getCell(`A${nextRow}`).value = 'Previous Month Total Commulative :';
  worksheet.getCell(`E${nextRow}`).value = prevMonthBase;
  worksheet.getCell(`F${nextRow}`).value = 'm3';

  // Today block
  worksheet.getCell(`G${nextRow}`).value = 'Today Total Commulative: ';
  worksheet.getCell(`I${nextRow}`).value = todayConsumption;
  worksheet.getCell(`J${nextRow}`).value = 'm3';

  // Formatting & Alignment for Row 30
  worksheet.getCell(`A${nextRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getCell(`E${nextRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
  worksheet.getCell(`E${nextRow}`).numFmt = '#,##0.00';
  worksheet.getCell(`F${nextRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
  
  worksheet.getCell(`G${nextRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getCell(`I${nextRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
  worksheet.getCell(`I${nextRow}`).numFmt = '#,##0.00';
  worksheet.getCell(`J${nextRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  for (let c = 1; c <= 10; c++) {
    const cell = worksheet.getCell(nextRow, c);
    cell.font = { name: 'Calibri', size: 11, bold: false };
    
    // Borders for Row 30
    setCellBorder(cell, {
      top: 'medium',
      bottom: 'medium',
      left: (c === 1 || c === 2 || c === 3 || c === 4 || c === 5 || c === 6 || c === 7) ? 'medium' : undefined,
      right: (c === 1 || c === 2 || c === 3 || c === 4 || c === 5 || c === 6 || c === 7 || c === 10) ? 'medium' : undefined
    });
  }
  nextRow++;

  // 10. Row 31: Previous Day Totalizer & Current Month Consumption
  worksheet.getRow(nextRow).height = 25;

  // Previous Day block
  worksheet.getCell(`A${nextRow}`).value = 'Previous Day Total Commulative :';
  worksheet.getCell(`E${nextRow}`).value = prevDayBase;
  worksheet.getCell(`F${nextRow}`).value = 'm3';

  // Current Month block
  worksheet.getCell(`G${nextRow}`).value = 'Current Month Total Commulative: ';
  worksheet.getCell(`I${nextRow}`).value = monthConsumption;
  worksheet.getCell(`J${nextRow}`).value = 'm3';

  // Formatting & Alignment for Row 31
  worksheet.getCell(`A${nextRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getCell(`E${nextRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
  worksheet.getCell(`E${nextRow}`).numFmt = '#,##0.00';
  worksheet.getCell(`F${nextRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
  
  worksheet.getCell(`G${nextRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getCell(`I${nextRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
  worksheet.getCell(`I${nextRow}`).numFmt = '#,##0.00';
  worksheet.getCell(`J${nextRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  for (let c = 1; c <= 10; c++) {
    const cell = worksheet.getCell(nextRow, c);
    cell.font = { name: 'Calibri', size: 11, bold: false };
    
    // Borders for Row 31
    setCellBorder(cell, {
      top: 'medium',
      bottom: 'medium',
      left: (c === 1 || c === 2 || c === 3 || c === 4 || c === 5 || c === 6 || c === 7 || c === 9) ? 'medium' : undefined,
      right: (c === 1 || c === 2 || c === 3 || c === 4 || c === 5 || c === 6 || c === 7 || c === 10) ? 'medium' : undefined
    });
  }

  // Generate buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = {
  generateExcelReport
};
