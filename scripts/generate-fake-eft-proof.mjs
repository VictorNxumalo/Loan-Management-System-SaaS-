/**
 * Generates a fake EFT proof-of-payment PDF for local testing (not for production use).
 * Usage: node scripts/generate-fake-eft-proof.mjs [output-path]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, '../apps/api/package.json'));
const PDFDocument = require('pdfkit');

const outputPath =
  process.argv[2] ??
  path.join(__dirname, '../fixtures/fake-eft-proof-of-payment.pdf');

const now = new Date();
const paymentDate = now.toISOString().slice(0, 10);
const reference = `EFT${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(Math.floor(Math.random() * 9000) + 1000)}`;
const amountCents = 150000; // R 1,500.00
const amountFormatted = `R ${(amountCents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const doc = new PDFDocument({ size: 'A4', margin: 50 });
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// Header bar
doc.rect(0, 0, doc.page.width, 72).fill('#003366');
doc.fillColor('#ffffff')
  .fontSize(22)
  .font('Helvetica-Bold')
  .text('Standard Bank', 50, 28);
doc.fontSize(10)
  .font('Helvetica')
  .text('Payment Confirmation — EFT', 50, 52);

doc.moveDown(3);
doc.fillColor('#111111');

doc.fontSize(16).font('Helvetica-Bold').text('Proof of Payment', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica').fillColor('#555555').text('This document confirms an electronic funds transfer.', {
  align: 'center',
});
doc.moveDown(2);

const left = 50;
const labelWidth = 160;
const valueX = left + labelWidth;

function row(label, value, bold = false) {
  doc.fillColor('#666666').font('Helvetica').fontSize(10).text(label, left, doc.y, { width: labelWidth });
  const y = doc.y - doc.currentLineHeight();
  doc
    .fillColor('#111111')
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(bold ? 12 : 10)
    .text(value, valueX, y);
  doc.moveDown(0.6);
}

doc.fillColor('#111111').font('Helvetica-Bold').fontSize(11).text('Transaction details');
doc.moveDown(0.5);

row('Status', 'Successful', true);
row('Transaction type', 'Immediate payment (EFT)');
row('Payment date', paymentDate);
row('Value date', paymentDate);
row('Reference number', reference);
row('Bank reference', `SB${reference.slice(3)}`);
row('Channel', 'Internet banking');

doc.moveDown(1);
doc.font('Helvetica-Bold').fontSize(11).text('From account');
doc.moveDown(0.5);

row('Account holder', 'Thabo Mokoena');
row('Bank', 'Standard Bank');
row('Account number', '**** **** 4821');
row('Branch code', '051001');

doc.moveDown(1);
doc.font('Helvetica-Bold').fontSize(11).text('To account');
doc.moveDown(0.5);

row('Account holder', 'Acme Microfinance (Pty) Ltd');
row('Bank', 'FNB');
row('Account number', '**** **** 9034');
row('Branch code', '250655');
row('Payment reference', 'Loan repayment — LMS test');

doc.moveDown(1);
doc.font('Helvetica-Bold').fontSize(11).text('Amount');
doc.moveDown(0.5);
row('Amount paid', amountFormatted, true);
row('Fees', 'R 0.00');
row('Total debited', amountFormatted, true);

doc.moveDown(2);
doc
  .strokeColor('#cccccc')
  .moveTo(left, doc.y)
  .lineTo(doc.page.width - left, doc.y)
  .stroke();

doc.moveDown(1);
doc.fillColor('#888888').fontSize(8).font('Helvetica');
doc.text(
  'This is a simulated proof of payment generated for LMS development and testing only. ' +
    'It is not issued by any bank and has no financial value.',
  left,
  doc.y,
  { width: doc.page.width - 100, align: 'center' },
);

doc.end();

stream.on('finish', () => {
  const stats = fs.statSync(outputPath);
  const kb = (stats.size / 1024).toFixed(1);
  console.log(`Created: ${outputPath}`);
  console.log(`Size: ${kb} KB (${stats.size} bytes)`);
  console.log(`Reference: ${reference}`);
  console.log(`Amount: ${amountFormatted}`);
});
