export function parseNroActa(nroActa: string) {
  const s = (nroActa || '').toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^([A-Z])\-?(\d{1,7})$/);
  if (!m) throw new Error('Formato de nro_acta inválido');
  const correlativo = parseInt(m[2], 10);
  return { serie: m[1], correlativo };
}
