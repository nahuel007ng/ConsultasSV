import * as fs from 'fs';
import * as path from 'path';

export function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function actaPdfPath(baseDir: string, nro_acta: string) {
  return path.join(baseDir, 'pdfs', `ACTA-${nro_acta}.pdf`);
}

export function loteOutPaths(baseDir: string, stamp: string) {
  const dir = path.join(baseDir, 'lotes');
  ensureDirSync(dir);
  return {
    resumenPdf: path.join(dir, `LOTE-${stamp}-RESUMEN.pdf`),
    combinadoPdf: path.join(dir, `LOTE-${stamp}-COMBINADO.pdf`),
  };
}
