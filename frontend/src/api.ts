// frontend/src/api.ts

export type Row = {
  id: number;
  nro_acta: string;
  fecha_carga: string;

  dominio: string;
  fecha_labrado: string;

  arteria?: string | null;
  velocidad_medida?: number | null;
  ubicacion_texto?: string | null;
  lat?: number | null;
  lng?: number | null;

  foto_file_id?: string | null;

  tipo_vehiculo?: string | null;
  vehiculo_marca?: string | null;
  vehiculo_modelo?: string | null;

  cam_serie?: string | null;
  tipo_infraccion?: string | null;
  estado: string;

  // Enriquecidos (si tu backend los expone)
  notificado?: boolean;
  fecha_notificacion?: string | null;
  titular_nombre?: string | null;
  titular_dni?: string | null;
};

export type Query = {
  // filtros por nro de acta (exacto) o rango
  nro_acta?: string;
  nro_desde?: string;
  nro_hasta?: string;

  // período por fecha de labrado (YYYY-MM-DD)
  desde?: string;
  hasta?: string;

  // otros
  estado?: 'todas' | 'notificadas' | 'no_notificadas';
  limit?: number;
  offset?: number;
};

type NotificarUnoBody = {
  fechaNotificacion: string; // YYYY-MM-DD
  email?: string;            // opcional
};

type NotificarLotePeriodo = {
  fechaNotificacion: string;
  periodo: { desde: string; hasta: string };
  email?: string;
};

type NotificarLoteRango = {
  fechaNotificacion: string;
  rango: { nro_desde: string; nro_hasta: string };
  email?: string;
};

type NotificarLoteSeleccion = {
  fechaNotificacion: string;
  seleccion: number[]; // IDs de infracciones
  email?: string;
};

const base = ''; // relativo: nginx proxya /api -> api:3000

/** Normaliza 'A0000001' o 'a-1' -> 'A-0000001' */
export function normalizeActa(raw?: string): string | undefined {
  if (!raw) return raw;
  const s = raw.toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^([A-Z])\-?(\d{1,7})$/);
  if (!m) return raw;
  return `${m[1]}-${m[2].padStart(7, '0')}`;
}

/** Convierte objeto a query string omitiendo null/undefined/'' */
function toQS(q: Record<string, any> = {}): string {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v);
    if (!s.trim()) return;
    params.append(k, s);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Busca infracciones según filtros */
export async function fetchInfracciones(q: Query = {}): Promise<Row[]> {
  // normalizar nro_acta y rangos antes de enviar
  const norm: Query = { ...q };
  if (norm.nro_acta) norm.nro_acta = normalizeActa(norm.nro_acta);
  if (norm.nro_desde) norm.nro_desde = normalizeActa(norm.nro_desde);
  if (norm.nro_hasta) norm.nro_hasta = normalizeActa(norm.nro_hasta);

  const res = await fetch(`${base}/api/consultas/infracciones${toQS(norm)}`);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Notifica una sola acta (por id) */
export async function notificarUno(id: number, fechaNotificacion: string, email?: string) {
  const body: NotificarUnoBody = { fechaNotificacion, email };
  const res = await fetch(`${base}/api/consultas/notificar/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json().catch(() => ({}));
}

/** Notifica lote por PERÍODO de fechas (YYYY-MM-DD) */
export async function notificarLoteByPeriodo(
  fechaNotificacion: string,
  desde: string,
  hasta: string,
  email?: string
) {
  const body: NotificarLotePeriodo = { fechaNotificacion, periodo: { desde, hasta }, email };
  const res = await fetch(`${base}/api/consultas/notificar-lote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json().catch(() => ({}));
}

/** Notifica lote por RANGO de ACTAS (usa nro_desde / nro_hasta) */
export async function notificarLoteByRango(
  fechaNotificacion: string,
  nro_desde: string,
  nro_hasta: string,
  email?: string
) {
  const body: NotificarLoteRango = {
    fechaNotificacion,
    rango: { nro_desde: normalizeActa(nro_desde)!, nro_hasta: normalizeActa(nro_hasta)! },
    email,
  };
  const res = await fetch(`${base}/api/consultas/notificar-lote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json().catch(() => ({}));
}

/** Notifica lote por SELECCIÓN de IDs */
export async function notificarLoteBySeleccion(
  fechaNotificacion: string,
  ids: number[],
  email?: string
) {
  const body: NotificarLoteSeleccion = { fechaNotificacion, seleccion: ids, email };
  const res = await fetch(`${base}/api/consultas/notificar-lote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json().catch(() => ({}));
}

/** URL pública para ver la foto asociada a un fileId */
export function fotoUrl(fileId: string) {
  return `${base}/api/consultas/foto/${encodeURIComponent(fileId)}`;
}
