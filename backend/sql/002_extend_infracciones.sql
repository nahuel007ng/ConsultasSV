-- backend/sql/002_extend_infracciones.sql

-- 1) Asegurar columna en tabla base (idempotente)
ALTER TABLE IF EXISTS infracciones
  ADD COLUMN IF NOT EXISTS arteria TEXT;

-- 2) Dropear la vista antes de recrearla (evita 42P16)
DROP VIEW IF EXISTS public.infracciones_view;

-- 3) Recrear con la nueva lista/orden de columnas
CREATE VIEW public.infracciones_view AS
SELECT
  i.id,
  (i.serie || '-' || lpad(i.nro_correlativo::text, 7, '0')) AS nro_acta,
  i.serie,
  i.nro_correlativo,

  i.dominio,
  i.fecha_labrado,

  i.arteria,
  i.velocidad_medida,
  i.velocidad_autorizada,
  i.ubicacion_texto,
  i.lat,
  i.lng,

  i.foto_file_id,

  i.tipo_vehiculo,
  i.vehiculo_marca,
  i.vehiculo_modelo,

  i.cam_serie,
  i.tipo_infraccion,
  i.estado,

  now() AT TIME ZONE 'utc' AS fecha_carga
FROM public.infracciones i;
