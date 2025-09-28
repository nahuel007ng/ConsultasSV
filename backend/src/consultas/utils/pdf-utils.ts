import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';

function toYYYYMMDD(v: any): string {
  try {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
  } catch {
    return String(v).slice(0, 10);
  }
}

type ResumenRow = {
  nro_acta: string;
  fecha_labrado: string | Date;
  dominio: string;
  titular: string | null;
  dni: string | null;
};

type ResumenOpts = {
  fechaNotificacion?: string; // YYYY-MM-DD
};

export async function generarResumenPDF(
  rows: ResumenRow[],
  outPath: string,
  opts: ResumenOpts = {}
) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Página A4
  const w = 595.28;
  const h = 841.89;
  const margin = 40;
  const tableWidth = w - margin * 2;

  // Columnas (llenan todo el ancho útil: ~515)
  // Nro de acta | Fecha de labrado | Dominio | Nombre del titular | DNI
  const colW = [95, 95, 85, 175, 65]; // suma 515 aprox
  const headers = [
    'Nro de acta',
    'Fecha de labrado',
    'Dominio',
    'Nombre del titular',
    'DNI',
  ];

  const titleSize = 14;
  const textSize = 10;
  const rowH = 18;
  const headerH = 20;
  const gap = 6;
  const minBottom = margin; // piso inferior para evitar cortes

  let page = pdf.addPage([w, h]);
  let y = h - margin;

  const drawText = (txt: string, x: number, yv: number, bold = false, size = textSize) =>
    page.drawText(txt, {
      x,
      y: yv,
      size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });

  // Truncado con "…" si excede el ancho de columna
  const trunc = (t: string, mw: number) => {
    let s = (t ?? '').toString();
    const ell = '…';
    if (font.widthOfTextAtSize(s, textSize) <= mw - 4) return s;
    while (s.length && font.widthOfTextAtSize(s + ell, textSize) > mw - 4) {
      s = s.slice(0, -1);
    }
    return s ? s + ell : '';
  };

  // Título y subtítulo
  drawText('Resumen de Actas Notificadas', margin, y, true, titleSize);
  y -= titleSize + gap;

  const fechaNotif = opts.fechaNotificacion ? toYYYYMMDD(opts.fechaNotificacion) : '';
  drawText(
    `Resumen de actas por exceso de velocidad notificadas el día ${fechaNotif}`,
    margin,
    y
  );
  y -= textSize + gap;

  // Textos informativos
  drawText('Puede observar cada acta detallada en el PDF COMBINADO.', margin, y);
  y -= textSize + 2;
  drawText(`Total de actas notificadas: ${rows.length}`, margin, y, true);
  y -= textSize + (gap + 4);

  // Dibujo de cabecera (reutilizable por página)
  const drawHeader = () => {
    // Si no entran cabecera + al menos 1 fila, salto de página
    if (y - (headerH + rowH) < minBottom) {
      page = pdf.addPage([w, h]);
      y = h - margin;
    }
    let x = margin;
    headers.forEach((htext, i) => {
      drawText(trunc(htext, colW[i]), x + 2, y - 12, true);
      x += colW[i];
    });
    y -= headerH;
  };

  // Dibujo de fila (evita cortar filas)
  const drawRow = (cols: string[]) => {
    if (y - rowH < minBottom) {
      page = pdf.addPage([w, h]);
      y = h - margin;
      drawHeader(); // redibuja cabecera en la nueva página
    }
    let x = margin;
    cols.forEach((c, i) => {
      drawText(trunc(c ?? '', colW[i]), x + 2, y - 12, false);
      x += colW[i];
    });
    y -= rowH;
  };

  // Cabecera inicial
  drawHeader();

  // Filas
  for (const r of rows) {
    drawRow([
      r.nro_acta,
      toYYYYMMDD(r.fecha_labrado),
      r.dominio,
      r.titular ?? '',
      r.dni ?? '',
    ]);
  }

  fs.writeFileSync(outPath, await pdf.save());
}

export async function combinarPDFs(inputPaths: string[], outPath: string) {
  const out = await PDFDocument.create();
  for (const p of inputPaths) {
    const src = await PDFDocument.load(fs.readFileSync(p));
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((pg) => out.addPage(pg));
  }
  fs.writeFileSync(outPath, await out.save());
}
