import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { QueryInfraccionesDto } from './dto/query-infracciones.dto.js';
import { parseNroActa } from './utils/parse.js';
import { InfraccionView } from './types.js';
import { actaPdfPath, loteOutPaths } from './utils/file-utils.js';
import { generarResumenPDF, combinarPDFs } from './utils/pdf-utils.js';
import { MailerService } from './utils/mailer.service.js';
import { NotificarLoteDto } from './dto/notificar-lote.dto.js';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ConsultasService {
  private pool = new Pool({
    host: process.env.PGHOST, port: +(process.env.PGPORT || 5432),
    user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE,
  });
  private dataDir = process.env.DATA_DIR || '/data';
  private mailer = new MailerService();

  async listar(dto: QueryInfraccionesDto) {
    const params: any[] = [];
    const where: string[] = [];
    let base = `
      SELECT v.*, i.notificado, i.fecha_notificacion, t.nombre AS titular_nombre, t.dni AS titular_dni
      FROM infracciones_view v
      JOIN infracciones i ON i.id = v.id
      LEFT JOIN titulares t ON t.dominio = v.dominio
    `;

    if (dto.nro_acta) {
      const { serie, correlativo } = parseNroActa(dto.nro_acta);
      where.push(`(v.serie = $${params.length+1} AND v.nro_correlativo = $${params.length+2})`);
      params.push(serie, correlativo);
    }
    if (dto.nro_desde && dto.nro_hasta) {
      const a = parseNroActa(dto.nro_desde), b = parseNroActa(dto.nro_hasta);
      if (a.serie !== b.serie) throw new BadRequestException('El rango de actas debe ser de la misma serie.');
      where.push(`(v.serie = $${params.length+1} AND v.nro_correlativo BETWEEN $${params.length+2} AND $${params.length+3})`);
      params.push(a.serie, a.correlativo, b.correlativo);
    }
    if (dto.fecha_desde && dto.fecha_hasta) {
      where.push(`(v.fecha_labrado >= $${params.length+1}::timestamptz AND v.fecha_labrado <= ($${params.length+2}::date + INTERVAL '1 day' - INTERVAL '1 second'))`);
      params.push(dto.fecha_desde, dto.fecha_hasta);
    }
    if (dto.estado === 'notificadas') where.push(`i.notificado = TRUE`);
    if (dto.estado === 'no_notificadas') where.push(`i.notificado = FALSE`);

    const sql = base + (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ` ORDER BY v.serie ASC, v.nro_correlativo DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(dto.limit, dto.offset);

    const { rows } = await this.pool.query(sql, params);
    return rows as InfraccionView[];
  }

  private requireActaPdfOr409(nro_acta: string) {
    const p = actaPdfPath(this.dataDir, nro_acta);
    if (!fs.existsSync(p)) throw new ConflictException(`PDF de acta ${nro_acta} no existe. Primero generá/creá ACTA-${nro_acta}.pdf en /data/pdfs`);
    return p;
  }

  async notificarUno(id: number, fechaNotificacion: string, email: string = 'mailejemplo@gmail.com') {
    const { rows } = await this.pool.query(`
      SELECT v.*, i.notificado, i.fecha_notificacion
      FROM infracciones_view v JOIN infracciones i ON i.id = v.id WHERE v.id = $1`, [id]);
    if (!rows.length) throw new NotFoundException('Infracción no encontrada');
    const it: InfraccionView = rows[0];
    const pdfPath = this.requireActaPdfOr409(it.nro_acta);

    const text = `Estimado, adjunto acta por exceso de velocidad nro "${it.nro_acta}", la cual fue debidamente notificada el "${fechaNotificacion}" al infractor.`;
    await this.mailer.sendMail(email, 'Notificacion de Acta', text, [{ filename: `ACTA-${it.nro_acta}.pdf`, path: pdfPath }]);

    await this.pool.query(`UPDATE infracciones SET notificado=TRUE, fecha_notificacion=$1, estado='notificada' WHERE id=$2`,
      [fechaNotificacion, id]);

    await this.pool.query(`INSERT INTO notificaciones (infraccion_id, pdf_path, estado, email, sent_at) VALUES ($1,$2,'enviado',$3, now())`,
      [id, pdfPath, email]);

    return { ok: true, id, nro_acta: it.nro_acta };
  }

  async notificarLote(input: NotificarLoteDto) {
    const email = input.email || 'mailejemplo@gmail.com';

    // 1) Resolver universo de actas a notificar (excluyendo ya notificadas)
    let rows: InfraccionView[] = [];

    if (input.seleccion?.length) {
      // Lote por SELECCIÓN explícita (ids)
      const ids = input.seleccion.map(Number).filter(n => Number.isFinite(n));
      if (!ids.length) throw new BadRequestException('Selección vacía');
      const { rows: r } = await this.pool.query<InfraccionView>(`
        SELECT v.*, t.nombre AS titular_nombre, t.dni AS titular_dni
          FROM infracciones_view v
          JOIN infracciones i ON i.id = v.id
          LEFT JOIN titulares t ON t.dominio = v.dominio
         WHERE i.notificado = FALSE
           AND v.id = ANY($1::int[])
         ORDER BY v.serie ASC, v.nro_correlativo ASC
      `, [ids]);
      rows = r;
    } else if (input.periodo) {
      // Lote por PERÍODO de fechas
      const { desde, hasta } = input.periodo;
      const { rows: r } = await this.pool.query<InfraccionView>(`
        SELECT v.*, t.nombre AS titular_nombre, t.dni AS titular_dni
          FROM infracciones_view v
          JOIN infracciones i ON i.id = v.id
          LEFT JOIN titulares t ON t.dominio = v.dominio
         WHERE i.notificado = FALSE
           AND v.fecha_labrado >= $1::timestamptz
           AND v.fecha_labrado <= ($2::date + INTERVAL '1 day' - INTERVAL '1 second')
         ORDER BY v.serie ASC, v.nro_correlativo ASC
      `, [desde, hasta]);
      rows = r;
    } else {
      // Lote por RANGO de números de acta (acepta rangoActas {desde,hasta} o rango {nro_desde,nro_hasta})
      const r = (input as any).rango ?? (input as any).rangoActas ? { nro_desde: (input as any).rangoActas.desde, nro_hasta: (input as any).rangoActas.hasta } : undefined;
      if (!r) throw new BadRequestException('Debe indicar periodo, rango o selección');

      const a = parseNroActa(r.nro_desde);
      const b = parseNroActa(r.nro_hasta);
      if (a.serie !== b.serie) throw new BadRequestException('El rango de actas debe ser de la misma serie.');

      const { rows: rr } = await this.pool.query<InfraccionView>(`
        SELECT v.*, t.nombre AS titular_nombre, t.dni AS titular_dni
          FROM infracciones_view v
          JOIN infracciones i ON i.id = v.id
          LEFT JOIN titulares t ON t.dominio = v.dominio
         WHERE i.notificado = FALSE
           AND v.serie = $1
           AND v.nro_correlativo BETWEEN $2 AND $3
         ORDER BY v.serie ASC, v.nro_correlativo ASC
      `, [a.serie, a.correlativo, b.correlativo]);
      rows = rr;
    }

    if (!rows.length) return { ok: true, total: 0 };

    // 2) Verificar PDFs individuales y armar paths de salida del lote
    const pdfPaths: string[] = rows.map(r => this.requireActaPdfOr409(r.nro_acta));
    const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const { resumenPdf, combinadoPdf } = loteOutPaths(this.dataDir, stamp);

    // 3) Generar RESUMEN (tabla) y COMBINADO (merge)
    await generarResumenPDF(
      rows.map(r => ({
        nro_acta: r.nro_acta,
        fecha_labrado: r.fecha_labrado,
        dominio: r.dominio,
        titular: (r as any).titular_nombre ?? null,
        dni: (r as any).titular_dni ?? null,
      })),
      resumenPdf,
      { fechaNotificacion: input.fechaNotificacion } // <-- clave
    );

    await combinarPDFs(pdfPaths, combinadoPdf);

    // 4) Enviar mail de lote — CUERPO actualizado con fecha
    const cuerpo = `Estimado, adjunto lote de actas por exceso de velocidad que fueron debitamente notificadas el dia ${input.fechaNotificacion} a los infractores correspondientes.`;
    await this.mailer.sendMail(email, 'Notificacion de actas', cuerpo, [
      { filename: `LOTE-${stamp}-RESUMEN.pdf`, path: resumenPdf },
      { filename: `LOTE-${stamp}-COMBINADO.pdf`, path: combinadoPdf },
    ]);

    // 5) Marcar como notificadas + registrar notificaciones
    const ids = rows.map(r => r.id);
    await this.pool.query(
      `UPDATE infracciones
          SET notificado = TRUE,
              fecha_notificacion = $1,
              estado = 'notificada'
        WHERE id = ANY($2::int[])`,
      [input.fechaNotificacion, ids]
    );

    for (const r of rows) {
      await this.pool.query(
        `INSERT INTO notificaciones (infraccion_id, pdf_path, estado, email, sent_at)
         VALUES ($1, $2, 'enviado', $3, now())`,
        [r.id, actaPdfPath(this.dataDir, r.nro_acta), email]
      );
    }

    return { ok: true, total: rows.length, resumenPdf, combinadoPdf };
  }
}
