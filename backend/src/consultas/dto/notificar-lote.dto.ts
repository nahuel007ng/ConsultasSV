import {
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Rango por número de acta usando desde/hasta (formato A-0000001) */
class RangoActas {
  @IsString() @Matches(/^[A-Z]-\d{7}$/) desde!: string;
  @IsString() @Matches(/^[A-Z]-\d{7}$/) hasta!: string;
}

/** Rango por número de acta usando nro_desde/nro_hasta (formato A-0000001) */
class RangoNro {
  @IsString() @Matches(/^[A-Z]-\d{7}$/) nro_desde!: string;
  @IsString() @Matches(/^[A-Z]-\d{7}$/) nro_hasta!: string;
}

/** Período por fechas YYYY-MM-DD */
class PeriodoFechas {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) desde!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) hasta!: string;
}

export class NotificarLoteDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaNotificacion!: string;

  @IsOptional() @IsString()
  email?: string;

  /** Compat: rango con {desde, hasta} */
  @IsOptional() @ValidateNested() @Type(() => RangoActas)
  rangoActas?: RangoActas;

  /** Alternativa: rango con {nro_desde, nro_hasta} */
  @IsOptional() @ValidateNested() @Type(() => RangoNro)
  rango?: RangoNro;

  /** Período por fechas */
  @IsOptional() @ValidateNested() @Type(() => PeriodoFechas)
  periodo?: PeriodoFechas;

  /** NUEVO: selección explícita de IDs para notificar en lote */
  @IsOptional() @IsArray() @ArrayMinSize(1) @Type(() => Number) @IsInt({ each: true })
  seleccion?: number[];
}
