import { Controller, Get, Query, Post, Param, Body, ParseIntPipe, Res } from '@nestjs/common';
import { ConsultasService } from './consultas.service.js';
import { QueryInfraccionesDto } from './dto/query-infracciones.dto.js';
import { NotificarUnoDto } from './dto/notificar-uno.dto.js';
import { NotificarLoteDto } from './dto/notificar-lote.dto.js';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/consultas')
export class ConsultasController {
  constructor(private readonly svc: ConsultasService) {}

  @Get('infracciones')
  listar(@Query() q: QueryInfraccionesDto) {
    return this.svc.listar(q);
  }

  @Post('notificar/:id')
  notificarUno(@Param('id', ParseIntPipe) id: number, @Body() dto: NotificarUnoDto) {
    return this.svc.notificarUno(id, dto.fechaNotificacion, dto.email);
  }

  @Post('notificar-lote')
  notificarLote(@Body() dto: NotificarLoteDto) {
    return this.svc.notificarLote(dto);
  }

  /** Sirve la foto asociada a un fileId desde /data/uploads */
  @Get('foto/:fileId')
  async foto(@Param('fileId') fileId: string, @Res() res: Response) {
    const safe = path.basename(fileId);                          // evita path traversal
    const dataDir = process.env.DATA_DIR || '/data';
    const p = path.join(dataDir, 'uploads', safe);

    if (!fs.existsSync(p)) {
      return res.status(404).send('Foto no encontrada');
    }

    const ext = path.extname(p).toLowerCase();
    const ct =
      ext === '.png' ? 'image/png' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      'application/octet-stream';

    res.setHeader('Content-Type', ct);
    return res.sendFile(p);
  }
}
