import { IsEnum, IsInt, IsOptional, IsPositive, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryInfraccionesDto {
  @IsOptional() @IsString() @Matches(/^[A-Z]-?\d{7}$/) nro_acta?: string;
  @IsOptional() @IsString() @Matches(/^[A-Z]-?\d{7}$/) nro_desde?: string;
  @IsOptional() @IsString() @Matches(/^[A-Z]-?\d{7}$/) nro_hasta?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha_desde?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha_hasta?: string;
  @IsOptional() @IsEnum(['todas','notificadas','no_notificadas'])
  estado: 'todas'|'notificadas'|'no_notificadas' = 'todas';
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() limit = 100;
  @IsOptional() @Type(() => Number) @IsInt() offset = 0;
}
