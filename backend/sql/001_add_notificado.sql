ALTER TABLE IF EXISTS infracciones
  ADD COLUMN IF NOT EXISTS notificado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fecha_notificacion TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_infracciones_notificado ON infracciones (notificado);
CREATE INDEX IF NOT EXISTS idx_infracciones_fecha_labrado ON infracciones (fecha_labrado);
CREATE INDEX IF NOT EXISTS idx_infracciones_serie_correl ON infracciones (serie, nro_correlativo);
