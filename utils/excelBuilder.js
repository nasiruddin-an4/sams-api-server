/**
 * Excel Builder Utility
 * Shared Excel helpers using ExcelJS
 */

const ExcelJS = require('exceljs');

/**
 * Create a new workbook with standard settings
 * @returns {ExcelJS.Workbook}
 */
const createWorkbook = () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SAMS - Student Academic Management System';
  workbook.created = new Date();
  return workbook;
};

/**
 * Add a styled header row to a worksheet
 * @param {ExcelJS.Worksheet} worksheet
 * @param {Array} headers - Array of header strings
 * @param {Object} options
 */
const addStyledHeader = (worksheet, headers, options = {}) => {
  const headerRow = worksheet.addRow(headers);
  const headerColor = options.headerColor || '1a365d';
  const fontColor = options.fontColor || 'FFFFFF';

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: headerColor }
    };
    cell.font = {
      bold: true,
      color: { argb: fontColor },
      size: 11,
      name: 'Calibri'
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'thin', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } }
    };
  });

  headerRow.height = 30;
};

/**
 * Color-code a cell based on percentage value
 * Green >= 75%, Yellow 60-74%, Red < 60%
 * @param {ExcelJS.Cell} cell
 * @param {Number} percentage
 */
const colorCodeCell = (cell, percentage) => {
  let bgColor;
  let fontColor = '000000';

  if (percentage >= 75) {
    bgColor = 'C6EFCE'; // Light green
    fontColor = '006100';
  } else if (percentage >= 60) {
    bgColor = 'FFEB9C'; // Light yellow
    fontColor = '9C5700';
  } else {
    bgColor = 'FFC7CE'; // Light red
    fontColor = '9C0006';
  }

  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: bgColor }
  };
  cell.font = {
    color: { argb: fontColor },
    bold: percentage < 60,
    size: 10
  };
};

/**
 * Auto-fit column widths based on content
 * @param {ExcelJS.Worksheet} worksheet
 * @param {Number} minWidth
 * @param {Number} maxWidth
 */
const autoFitColumns = (worksheet, minWidth = 10, maxWidth = 40) => {
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value ? cell.value.toString() : '';
      maxLength = Math.max(maxLength, cellValue.length);
    });
    column.width = Math.min(Math.max(maxLength + 2, minWidth), maxWidth);
  });
};

/**
 * Freeze the top row (header)
 * @param {ExcelJS.Worksheet} worksheet
 */
const freezeTopRow = (worksheet) => {
  worksheet.views = [
    { state: 'frozen', ySplit: 1, activeCell: 'A2' }
  ];
};

/**
 * Add a title row spanning all columns
 * @param {ExcelJS.Worksheet} worksheet
 * @param {String} title
 * @param {Number} columnCount
 */
const addTitleRow = (worksheet, title, columnCount) => {
  const titleRow = worksheet.addRow([title]);
  worksheet.mergeCells(titleRow.number, 1, titleRow.number, columnCount);

  titleRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '2d3748' }
  };
  titleRow.getCell(1).font = {
    bold: true,
    color: { argb: 'FFFFFF' },
    size: 14,
    name: 'Calibri'
  };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.height = 35;

  worksheet.addRow([]); // Empty spacer row
};

/**
 * Add data rows with alternating colors and borders
 * @param {ExcelJS.Worksheet} worksheet
 * @param {Array} rows - Array of arrays
 */
const addDataRows = (worksheet, rows) => {
  rows.forEach((row, index) => {
    const dataRow = worksheet.addRow(row);

    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'D2D2D2' } },
        left: { style: 'thin', color: { argb: 'D2D2D2' } },
        bottom: { style: 'thin', color: { argb: 'D2D2D2' } },
        right: { style: 'thin', color: { argb: 'D2D2D2' } }
      };
      cell.alignment = { vertical: 'middle' };

      if (index % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F7FAFC' }
        };
      }
    });
  });
};

module.exports = {
  createWorkbook,
  addStyledHeader,
  colorCodeCell,
  autoFitColumns,
  freezeTopRow,
  addTitleRow,
  addDataRows
};
