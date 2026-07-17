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
 * Generates a styled Excel sheet with exactly the 6 requested columns.
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
    { key: 'time', width: 22.0 },
    { key: 'reading', width: 12.0 },
    { key: 'flow', width: 12.0 },
    { key: 'flowUnit', width: 12.0 },
    { key: 'commTotal', width: 20.0 },
    { key: 'commUnit', width: 18.0 }
  ];

  // 2. Row 1: Merged Title
  worksheet.mergeCells('B1:F1');
  const titleCell = worksheet.getCell('B1');
  titleCell.value = 'DAILY WATER METER READING LOG SHEET';
  titleCell.font = { name: 'Calibri', size: 24, bold: false };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 35;

  // Apply borders for Row 1 (A1 separate, B1-F1 merged)
  setCellBorder(worksheet.getCell('A1'), { left: 'medium', top: 'medium', bottom: 'thin', right: 'thin' });
  for (let col = 2; col <= 5; col++) {
    setCellBorder(worksheet.getCell(1, col), { top: 'medium', bottom: 'thin' });
  }
  setCellBorder(worksheet.getCell('F1'), { right: 'medium', top: 'medium', bottom: 'thin' });

  // 3. Row 2: Location and Date
  worksheet.getRow(2).height = 20;
  worksheet.getCell('A2').value = 'Location';
  worksheet.getCell('A2').font = { name: 'Calibri', size: 11, bold: true };
  setCellBorder(worksheet.getCell('A2'), { left: 'medium', top: 'thin', bottom: 'thin', right: 'thin' });

  worksheet.mergeCells('B2:D2');
  const locValCell = worksheet.getCell('B2');
  locValCell.value = device.location || '';
  locValCell.font = { name: 'Calibri', size: 11 };
  locValCell.alignment = { horizontal: 'left', vertical: 'middle' };
  for (let col = 2; col <= 4; col++) {
    setCellBorder(worksheet.getCell(2, col), { top: 'thin', bottom: 'thin' });
  }
  worksheet.getCell('D2').border.right = { style: 'thin' };

  worksheet.getCell('E2').value = 'Date';
  worksheet.getCell('E2').font = { name: 'Calibri', size: 11, bold: true };
  setCellBorder(worksheet.getCell('E2'), { left: 'thin', top: 'thin', bottom: 'thin', right: 'thin' });

  worksheet.getCell('F2').value = dateStr;
  worksheet.getCell('F2').font = { name: 'Calibri', size: 11 };
  worksheet.getCell('F2').alignment = { horizontal: 'left', vertical: 'middle' };
  setCellBorder(worksheet.getCell('F2'), { right: 'medium', top: 'thin', bottom: 'thin' });

  // 4. Row 3: Site and Water Meter No
  worksheet.getRow(3).height = 20;
  worksheet.getCell('A3').value = 'Site';
  worksheet.getCell('A3').font = { name: 'Calibri', size: 11, bold: true };
  setCellBorder(worksheet.getCell('A3'), { left: 'medium', top: 'thin', bottom: 'thin', right: 'thin' });

  worksheet.mergeCells('B3:D3');
  const siteValCell = worksheet.getCell('B3');
  siteValCell.value = device.site || '';
  siteValCell.font = { name: 'Calibri', size: 11 };
  siteValCell.alignment = { horizontal: 'left', vertical: 'middle' };
  for (let col = 2; col <= 4; col++) {
    setCellBorder(worksheet.getCell(3, col), { top: 'thin', bottom: 'thin' });
  }
  worksheet.getCell('D3').border.right = { style: 'thin' };

  worksheet.getCell('E3').value = 'Water Meter No';
  worksheet.getCell('E3').font = { name: 'Calibri', size: 11, bold: true };
  setCellBorder(worksheet.getCell('E3'), { left: 'thin', top: 'thin', bottom: 'thin', right: 'thin' });

  worksheet.getCell('F3').value = device.id;
  worksheet.getCell('F3').font = { name: 'Calibri', size: 11 };
  worksheet.getCell('F3').alignment = { horizontal: 'left', vertical: 'middle' };
  setCellBorder(worksheet.getCell('F3'), { right: 'medium', top: 'thin', bottom: 'thin' });

  // 5. Row 4: Table Headers
  worksheet.getRow(4).height = 25;
  const headers = [
    { col: 1, val: 'time' },
    { col: 2, val: 'Reading' },
    { col: 3, val: 'flow' },
    { col: 4, val: 'Flow Unit' },
    { col: 5, val: 'Commulative Total' },
    { col: 6, val: 'Commulative Unit' }
  ];

  headers.forEach(h => {
    const cell = worksheet.getCell(4, h.col);
    cell.value = h.val;
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    const isLeft = h.col === 1;
    const isRight = h.col === 6;
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
        B: null, // Reading
        C: r.flow !== undefined ? parseFloat(r.flow) : 0,
        D: 'm3/h',
        E: r.cumulativeTotalizer !== undefined ? parseFloat(r.cumulativeTotalizer) : 0,
        F: 'm3'
      };

      Object.entries(cellValues).forEach(([colLetter, val], idx) => {
        const colIdx = idx + 1;
        const cell = worksheet.getCell(`${colLetter}${nextRow}`);
        cell.value = val;
        cell.font = { name: 'Calibri', size: 11 };

        if (typeof val === 'number') {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        const isLeft = colIdx === 1;
        const isRight = colIdx === 6;
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
    // Write at least one empty row
    worksheet.getRow(nextRow).height = 20;
    for (let c = 1; c <= 6; c++) {
      const cell = worksheet.getCell(nextRow, c);
      setCellBorder(cell, {
        left: c === 1 ? 'medium' : 'thin',
        right: c === 6 ? 'medium' : 'thin',
        top: 'thin',
        bottom: 'thin'
      });
    }
    nextRow++;
  }

  // 7. Row 29 (Blank Row with left/right borders)
  worksheet.getRow(nextRow).height = 20;
  for (let c = 1; c <= 6; c++) {
    const cell = worksheet.getCell(nextRow, c);
    setCellBorder(cell, {
      left: c === 1 ? 'medium' : undefined,
      right: c === 6 ? 'medium' : undefined
    });
  }
  nextRow++;

  // 8. Calculate baseline values for totals
  const lastRowData = rows.length > 0 ? rows[rows.length - 1] : { cumulativeTotalizer: 0 };
  const firstRowData = rows.length > 0 ? rows[0] : { cumulativeTotalizer: 0 };
  const lastTotalizer = parseFloat(lastRowData.cumulativeTotalizer || 0);
  const firstTotalizer = parseFloat(firstRowData.cumulativeTotalizer || 0);

  const prevMonthBase = bases && bases.month_base !== null ? parseFloat(bases.month_base) : firstTotalizer;
  const prevDayBase = bases && bases.today_base !== null ? parseFloat(bases.today_base) : firstTotalizer;

  const todayConsumption = Math.max(0, lastTotalizer - prevDayBase);
  const monthConsumption = Math.max(0, lastTotalizer - prevMonthBase);

  // 9. Row 30 to 33: Stacking totals vertically
  const totalsData = [
    { label: 'Previous Month Total Commulative :', value: prevMonthBase },
    { label: 'Previous Day Total Commulative :', value: prevDayBase },
    { label: 'Today Total Commulative: ', value: todayConsumption },
    { label: 'Current Month Total Commulative: ', value: monthConsumption }
  ];

  totalsData.forEach((t, i) => {
    const currentRowNum = nextRow + i;
    worksheet.getRow(currentRowNum).height = 25;

    // Merge A:D for the label
    worksheet.mergeCells(`A${currentRowNum}:D${currentRowNum}`);
    const labelCell = worksheet.getCell(`A${currentRowNum}`);
    labelCell.value = t.label;
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // E is the value
    const valCell = worksheet.getCell(`E${currentRowNum}`);
    valCell.value = t.value;
    valCell.alignment = { horizontal: 'right', vertical: 'middle' };
    valCell.numFmt = '#,##0.00';

    // F is the unit
    const unitCell = worksheet.getCell(`F${currentRowNum}`);
    unitCell.value = 'm3';
    unitCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Set borders for Row
    for (let c = 1; c <= 6; c++) {
      const cell = worksheet.getCell(currentRowNum, c);
      cell.font = { name: 'Calibri', size: 11, bold: false };
      setCellBorder(cell, {
        top: 'medium',
        bottom: 'medium',
        left: (c === 1 || c === 5 || c === 6) ? 'medium' : undefined,
        right: (c === 4 || c === 5 || c === 6) ? 'medium' : undefined
      });
    }
  });

  // Generate buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = {
  generateExcelReport
};
