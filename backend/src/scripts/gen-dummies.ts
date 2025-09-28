import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

async function createDummyActaPdf(nro_acta: string, outDir: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('ACTA DE NOTIFICACIÓN (DUMMY)', { x: 50, y: 780, size: 16, font, color: rgb(0,0,0) });
  page.drawText(`Nro: ${nro_acta}`, { x: 50, y: 750, size: 12, font });
  page.drawText(`Este PDF es solo de prueba para el módulo Consultas.`, { x: 50, y: 720, size: 12, font });
  const bytes = await pdf.save();
  const out = path.join(outDir, `ACTA-${nro_acta}.pdf`);
  fs.writeFileSync(out, bytes);
  console.log('creado:', out);
}

(async () => {
  const dataDir = process.env.DATA_DIR || '/data';
  const pdfDir = path.join(dataDir, 'pdfs');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

  const pool = new Pool({
    host: process.env.PGHOST, port: +(process.env.PGPORT || 5432),
    user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE,
  });

  const { rows } = await pool.query(`SELECT (serie || '-' || lpad(nro_correlativo::text, 7, '0')) AS nro_acta FROM infracciones`);
  for (const r of rows) {
    const p = path.join(pdfDir, `ACTA-${r.nro_acta}.pdf`);
    if (!fs.existsSync(p)) await createDummyActaPdf(r.nro_acta, pdfDir);
  }
  await pool.end();
})();
