CREATE TABLE IF NOT EXISTS correlativos (
  serie TEXT PRIMARY KEY,
  ultimo INTEGER NOT NULL DEFAULT 0
);
INSERT INTO correlativos(serie, ultimo) VALUES ('A', 0) ON CONFLICT (serie) DO NOTHING;

CREATE TABLE IF NOT EXISTS infracciones (
  id SERIAL PRIMARY KEY,
  serie TEXT NOT NULL,
  nro_correlativo INTEGER NOT NULL,
  dominio TEXT NOT NULL,
  tipo_infraccion TEXT NOT NULL DEFAULT 'Exceso de velocidad',
  fecha_labrado TIMESTAMPTZ NOT NULL,
  velocidad_medida INTEGER,
  velocidad_autorizada INTEGER NOT NULL DEFAULT 0,
  ubicacion_texto TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  foto_file_id TEXT,
  cam_serie TEXT,
  tipo_vehiculo TEXT,
  vehiculo_marca TEXT,
  vehiculo_modelo TEXT,
  estado TEXT NOT NULL DEFAULT 'validada'
);

CREATE TABLE IF NOT EXISTS titulares (
  dominio TEXT PRIMARY KEY,
  nombre TEXT,
  dni TEXT,
  domicilio TEXT
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id SERIAL PRIMARY KEY,
  infraccion_id INTEGER NOT NULL REFERENCES infracciones(id),
  pdf_path TEXT,
  estado TEXT NOT NULL DEFAULT 'generado',
  email TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  sent_at TIMESTAMP WITHOUT TIME ZONE
);

-- Datos de prueba
INSERT INTO titulares(dominio, nombre, dni, domicilio) VALUES
  ('AB123CD','Juan Perez','30111222','Calle Falsa 123'),
  ('CD456EF','Ana Gomez','28999111','Av. Siempre Viva 742')
ON CONFLICT (dominio) DO NOTHING;

-- Tres actas de ejemplo (23/09/2025 a 26/09/2025)
INSERT INTO infracciones (serie, nro_correlativo, dominio, fecha_labrado, velocidad_medida, ubicacion_texto, cam_serie, tipo_vehiculo, vehiculo_marca, vehiculo_modelo)
VALUES
 ('A', 1, 'AB123CD', '2025-09-23T10:00:00Z', 80, 'AYACUCHO', 'TC009925','AUTO','Volkswagen','Gol'),
 ('A', 2, 'CD456EF', '2025-09-25T15:30:00Z', 92, 'MITRE', 'TC009925','AUTO','Ford','Fiesta'),
 ('A',10, 'AB123CD', '2025-09-26T09:10:00Z',105, 'SARMIENTO','TC009925','PICKUP','Toyota','Hilux')
ON CONFLICT DO NOTHING;
