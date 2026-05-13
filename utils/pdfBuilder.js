/**
 * PDF Builder Utility
 * Shared PDF layout helpers using PDFKit
 */

const PDFDocument = require('pdfkit');

/**
 * Create a new PDF document with standard settings
 * @param {Object} options
 * @returns {PDFDocument}
 */
const createPDF = (options = {}) => {
  const doc = new PDFDocument({
    size: options.size || 'A4',
    layout: options.layout || 'portrait',
    margin: options.margin || 50,
    bufferPages: true
  });
  return doc;
};

/**
 * Add header to PDF
 * @param {PDFDocument} doc
 * @param {String} title
 * @param {String} subtitle
 */
const addHeader = (doc, title, subtitle = '') => {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Header background
  doc.rect(doc.page.margins.left - 10, doc.y - 10, pageWidth + 20, 70)
    .fill('#1a365d');

  doc.fillColor('#ffffff')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text(title, doc.page.margins.left, doc.y - 55, { width: pageWidth, align: 'center' });

  if (subtitle) {
    doc.fontSize(11)
      .font('Helvetica')
      .text(subtitle, { width: pageWidth, align: 'center' });
  }

  doc.fillColor('#000000');
  doc.moveDown(2);
};

/**
 * Add a colored table to PDF
 * @param {PDFDocument} doc
 * @param {Array} headers - Array of column header strings
 * @param {Array} rows - Array of arrays (row data)
 * @param {Object} options
 */
const addTable = (doc, headers, rows, options = {}) => {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidths = options.colWidths || headers.map(() => pageWidth / headers.length);
  const startX = doc.page.margins.left;
  let startY = doc.y;
  const rowHeight = options.rowHeight || 25;
  const fontSize = options.fontSize || 9;
  const headerColor = options.headerColor || '#2d3748';
  const altRowColor = options.altRowColor || '#f7fafc';

  // Check if we need a new page
  const checkNewPage = (currentY) => {
    if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage();
      return doc.page.margins.top;
    }
    return currentY;
  };

  // Header row
  startY = checkNewPage(startY);
  doc.rect(startX, startY, pageWidth, rowHeight).fill(headerColor);

  doc.fillColor('#ffffff').fontSize(fontSize).font('Helvetica-Bold');
  let xPos = startX;
  headers.forEach((header, i) => {
    doc.text(header, xPos + 4, startY + 7, { width: colWidths[i] - 8, align: 'left' });
    xPos += colWidths[i];
  });

  startY += rowHeight;

  // Data rows
  doc.font('Helvetica').fillColor('#000000');
  rows.forEach((row, rowIndex) => {
    startY = checkNewPage(startY);

    // Alternating row colors
    if (rowIndex % 2 === 0) {
      doc.rect(startX, startY, pageWidth, rowHeight).fill(altRowColor);
    }

    doc.fillColor('#2d3748').fontSize(fontSize);
    xPos = startX;
    row.forEach((cell, i) => {
      const cellText = cell != null ? String(cell) : '';
      doc.text(cellText, xPos + 4, startY + 7, { width: colWidths[i] - 8, align: 'left' });
      xPos += colWidths[i];
    });

    startY += rowHeight;
  });

  doc.y = startY + 10;
};

/**
 * Add footer with timestamp to all pages
 * @param {PDFDocument} doc
 */
const addFooter = (doc) => {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    const pageWidth = doc.page.width;
    const bottomY = doc.page.height - 30;

    doc.fontSize(8)
      .fillColor('#718096')
      .text(
        `Generated on: ${new Date().toLocaleString()} | Page ${i + 1} of ${pages.count}`,
        50, bottomY,
        { width: pageWidth - 100, align: 'center' }
      );
  }
};

/**
 * Add watermark to all pages
 * @param {PDFDocument} doc
 * @param {String} text
 */
const addWatermark = (doc, text = 'CONFIDENTIAL') => {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    doc.save();
    doc.fontSize(60)
      .fillColor('#e2e8f0')
      .opacity(0.15)
      .translate(doc.page.width / 2, doc.page.height / 2)
      .rotate(-45, { origin: [0, 0] })
      .text(text, -150, -30);
    doc.restore();
    doc.opacity(1);
  }
};

/**
 * Add signature block
 * @param {PDFDocument} doc
 * @param {Array} signatories - Array of { title, name }
 */
const addSignatureBlock = (doc, signatories = []) => {
  doc.moveDown(3);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = pageWidth / signatories.length;
  const startX = doc.page.margins.left;
  const y = doc.y;

  signatories.forEach((sig, i) => {
    const x = startX + (i * colWidth);

    doc.moveTo(x + 10, y + 30)
      .lineTo(x + colWidth - 10, y + 30)
      .stroke('#4a5568');

    doc.fontSize(9)
      .fillColor('#4a5568')
      .text(sig.title, x, y + 35, { width: colWidth, align: 'center' });

    if (sig.name) {
      doc.fontSize(8)
        .text(sig.name, x, y + 48, { width: colWidth, align: 'center' });
    }
  });
};

module.exports = { createPDF, addHeader, addTable, addFooter, addWatermark, addSignatureBlock };
