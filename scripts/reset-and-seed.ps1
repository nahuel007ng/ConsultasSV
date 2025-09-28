param(
  [string]$Series = 'A',
  [int]$Count = 20,
  [string]$StartDate = '2025-09-01',   # fecha base (UTC) para escalonar las actas
  [switch]$SetCorrelativo              # si lo pasás, deja correlativo en $Count
)

$ErrorActionPreference = 'Stop'
Write-Host "==> Reset & Seed ($Series, $Count actas)..." -ForegroundColor Cyan

# 0) Asegurar servicios arriba (db/api/smtp)
docker compose up -d db api smtp | Out-Null

# 1) Limpiar DB (notificaciones + actas) y reiniciar correlativo
$sqlClean = @"
TRUNCATE TABLE notificaciones;
TRUNCATE TABLE infracciones RESTART IDENTITY CASCADE;
INSERT INTO correlativos(serie, ultimo) VALUES ('$Series',0)
  ON CONFLICT (serie) DO NOTHING;
UPDATE correlativos SET ultimo=0 WHERE serie='$Series';
"@
$sqlClean | docker compose exec -T db psql -U sv -d svdb -v "ON_ERROR_STOP=1" | Out-Null
Write-Host " - DB limpiada y correlativo $Series=0"

# 2) Limpiar PDFs, lotes y uploads
docker compose exec api sh -lc "rm -f /data/pdfs/*.pdf /data/lotes/*.pdf /data/uploads/* 2>/dev/null || true && mkdir -p /data/pdfs /data/lotes /data/uploads" | Out-Null
Write-Host " - Archivos /data limpiados"

# 3) Insertar titulares dummy (TST001..TST0XX)
$sqlTit = @"
WITH s AS (SELECT generate_series(1,$Count) n)
INSERT INTO titulares(dominio, nombre, dni, domicilio)
SELECT 'TST'||lpad(n::text,3,'0'),
       'Titular '||n,
       (30000000+n)::text,
       'Calle '||n
FROM s
ON CONFLICT (dominio) DO UPDATE
  SET nombre=EXCLUDED.nombre, dni=EXCLUDED.dni, domicilio=EXCLUDED.domicilio;
"@
$sqlTit | docker compose exec -T db psql -U sv -d svdb -v "ON_ERROR_STOP=1" | Out-Null
Write-Host " - Titulares cargados"

# 4) Insertar $Count actas (serie $Series, correlativos 1..$Count)
#    Incluye el nuevo campo 'arteria'
$sqlActs = @"
WITH s AS (SELECT generate_series(1,$Count) n)
INSERT INTO infracciones
  (serie, nro_correlativo, dominio, tipo_infraccion, fecha_labrado, arteria,
   velocidad_medida, velocidad_autorizada, ubicacion_texto, lat, lng,
   foto_file_id, cam_serie, tipo_vehiculo, vehiculo_marca, vehiculo_modelo,
   estado, notificado)
SELECT
  '$Series',
  n,
  'TST'||lpad(n::text,3,'0'),
  'Exceso de velocidad',
  (timestamp with time zone '$StartDate 12:00:00+00') + make_interval(days => n),
  CASE WHEN n%2=0 THEN 'AVENIDA' ELSE 'CALLE' END,
  60 + (n % 60),
  40,
  CASE WHEN n%2=0 THEN 'AYACUCHO' ELSE 'MITRE' END,
  NULL, NULL, NULL,
  'TC009925',
  CASE WHEN n%3=0 THEN 'MOTO' WHEN n%3=1 THEN 'AUTO' ELSE 'PICKUP' END,
  CASE WHEN n%3=0 THEN 'Yamaha' WHEN n%3=1 THEN 'Volkswagen' ELSE 'Ford' END,
  CASE WHEN n%3=0 THEN 'FZ'     WHEN n%3=1 THEN 'Gol'        ELSE 'Ranger' END,
  'validada',
  FALSE
FROM s;
"@
$sqlActs | docker compose exec -T db psql -U sv -d svdb -v "ON_ERROR_STOP=1" | Out-Null
Write-Host " - Actas insertadas: $Count ($Series-0000001 … $Series-$("{0:d7}" -f $Count))"

# 5) (Opcional) ajustar correlativo a Count (para que Ingreso continúe desde ahí)
if ($SetCorrelativo) {
  "UPDATE correlativos SET ultimo=$Count WHERE serie='$Series';" |
    docker compose exec -T db psql -U sv -d svdb -v "ON_ERROR_STOP=1" | Out-Null
  Write-Host " - Correlativo $Series seteado en $Count"
}

# 6) Generar PDFs dummy (1 por acta) usando pdf-lib directamente desde el contenedor
$nodeInline = @'
set -e
cat >/tmp/gen-acts.js <<'JS'
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { Pool } = require('pg');
const fs = require('fs');

(async () => {
  const pool = new Pool({
    host: process.env.PGHOST,
    port: +(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  });

  const { rows } = await pool.query(`
    SELECT serie, lpad(nro_correlativo::text,7,'0') AS corr
    FROM infracciones
    ORDER BY id
  `);
  await pool.end();

  fs.mkdirSync('/data/pdfs', { recursive: true });

  let ok = 0;
  for (const r of rows) {
    const nro = `${r.serie}-${r.corr}`;
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText(`ACTA ${nro}`, { x: 72, y: 770, size: 18, font });
    page.drawText('PDF dummy de prueba', { x: 72, y: 740, size: 12, font });
    const bytes = await pdf.save();
    fs.writeFileSync(`/data/pdfs/ACTA-${nro}.pdf`, bytes);
    ok++;
  }
  console.log('PDFs generados:', ok);
})().catch(e => { console.error(e); process.exit(1); });
JS

node /tmp/gen-acts.js
'@

docker compose exec api sh -lc "$nodeInline" | Out-Host

# 7) Listado rápido de PDFs
docker compose exec api sh -lc "ls -1 /data/pdfs | wc -l && ls -1 /data/pdfs | head -n 5 && echo ... && ls -1 /data/pdfs | tail -n 5" | Out-Host

# 8) Resumen rápido de actas
"SELECT COUNT(*) total, MIN(serie||'-'||lpad(nro_correlativo::text,7,'0')) min_acta, MAX(serie||'-'||lpad(nro_correlativo::text,7,'0')) max_acta FROM infracciones;" |
  docker compose exec -T db psql -U sv -d svdb -v "ON_ERROR_STOP=1" | Out-Host

Write-Host "==> Listo. Probá en http://localhost:8080 (rango $Series-0000001 a $Series-$("{0:d7}" -f $Count))." -ForegroundColor Green
