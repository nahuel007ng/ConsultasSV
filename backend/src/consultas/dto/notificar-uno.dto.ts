import { IsOptional, IsString, Matches } from 'class-validator';
export class NotificarUnoDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) fechaNotificacion!: string;
  @IsOptional() @IsString() email?: string;
}
