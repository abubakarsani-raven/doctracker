#!/usr/bin/env node
/** Write multi-page demo contract PDFs into process.argv[2] directory. */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2];
if (!outDir) {
  console.error('Usage: node make-demo-pdfs.js <outdir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

async function make(fileName, title, pages = 3) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595.28, 841.89]);
    const { height } = page.getSize();
    page.drawText(title, {
      x: 50,
      y: height - 60,
      size: 14,
      font: bold,
      color: rgb(0.1, 0.15, 0.25),
    });
    page.drawText(`Page ${i + 1} of ${pages}`, {
      x: 50,
      y: height - 85,
      size: 10,
      font,
    });
    page.drawText(
      'Demo contract for DocTracker. Sign anywhere on any page.',
      { x: 50, y: height - 120, size: 10, font, maxWidth: 480 },
    );
    page.drawText('Governing law: Laws of the Federal Republic of Nigeria.', {
      x: 50,
      y: 80,
      size: 9,
      font,
    });
  }
  fs.writeFileSync(path.join(outDir, fileName), await doc.save());
}

(async () => {
  await make('kano.pdf', 'Framework Agreement: Kano State Ministry of Works', 3);
  await make('fmard.pdf', 'MoU with Federal Ministry of Agriculture (FMARD)', 2);
  await make('dangote.pdf', 'Supply Agreement - Dangote Cement Plc', 4);
  await make('wb.pdf', 'World Bank Financed Consulting Services Contract', 5);
  await make(
    'unicef.pdf',
    'Programme Cooperation Agreement Amendment - UNICEF Nigeria',
    3,
  );
  await make('fcdo.pdf', 'FCDO Technical Assistance Arrangement', 2);
  await make('nda.pdf', 'Non-Disclosure Agreement - Nigeria', 2);
  await make('consult.pdf', 'Standard Consulting Agreement', 3);
  await make(
    'subaward.pdf',
    'Sub-award Agreement with Arewa Contract Services Ltd',
    4,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
