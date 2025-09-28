import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Query, Row } from './api';
import {
  fetchInfracciones,
  notificarUno,
  notificarLoteByPeriodo,
  notificarLoteByRango,
  notificarLoteBySeleccion,
  fotoUrl,
} from './api';

const CameraIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const fmtNum = (v?: number | null, d = 5) => (v == null ? '-' : v.toFixed(d));

type ModalKind = 'uno' | 'loteFiltros' | 'loteSeleccion';

export default function ConsultaActas() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [q, setQ] = useState<Query>({ estado: 'todas' });
  const [photoId, setPhotoId] = useState<string | null>(null);

  // Modal de fecha
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ModalKind>('uno');
  const [modalDate, setModalDate] = useState('');
  const [modalRow, setModalRow] = useState<Row | null>(null);

  // Scroll sincronizado (barra superior + tabla)
  const scrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableWidth = 1600; // ancho virtual para habilitar el scroll

  const syncFromTop = () => {
    if (topScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };
  const syncFromBottom = () => {
    if (topScrollRef.current && scrollRef.current) {
      topScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  };

  const canNotifyByFiltros = useMemo(
    () => (q.nro_desde && q.nro_hasta) || (q.desde && q.hasta),
    [q]
  );
  const canNotifyBySeleccion = selected.size > 0;

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    try {
      const data = await fetchInfracciones(q);
      setRows(data);
    } catch (err: any) {
      alert('Error al buscar: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    doSearch().catch(() => {});
  }, []);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  // Abrir modal de fecha según caso
  const openModalUno = (r: Row) => {
    setModalKind('uno');
    setModalRow(r);
    setModalDate('');
    setModalOpen(true);
  };
  const openModalLoteFiltros = () => {
    setModalKind('loteFiltros');
    setModalRow(null);
    setModalDate('');
    setModalOpen(true);
  };
  const openModalLoteSeleccion = () => {
    setModalKind('loteSeleccion');
    setModalRow(null);
    setModalDate('');
    setModalOpen(true);
  };

  // Confirmar modal → llama al endpoint correspondiente
  const confirmModal = async () => {
    if (!modalDate) return alert('Ingrese fecha de notificación (YYYY-MM-DD).');

    try {
      if (modalKind === 'uno' && modalRow) {
        await notificarUno(modalRow.id, modalDate);
        await doSearch();
        alert('Acta notificada correctamente');
      } else if (modalKind === 'loteFiltros') {
        if (q.nro_desde && q.nro_hasta) {
          await notificarLoteByRango(modalDate, q.nro_desde, q.nro_hasta);
        } else if (q.desde && q.hasta) {
          await notificarLoteByPeriodo(modalDate, q.desde, q.hasta);
        } else {
          return alert('Defina un rango de actas o un período de fechas para el lote.');
        }
        await doSearch();
        alert('Actas notificadas correctamente');
      } else if (modalKind === 'loteSeleccion') {
        const ids = Array.from(selected);
        if (!ids.length) return alert('No hay actas seleccionadas.');
        await notificarLoteBySeleccion(modalDate, ids);
        // limpiar selección tras notificar
        setSelected(new Set());
        await doSearch();
        alert('Actas notificadas correctamente');
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setModalOpen(false);
    }
  };

  return (
    <div>
      {/* Filtros */}
      <form onSubmit={doSearch} className="row filters" style={{ marginBottom: 12 }}>
        <input
          placeholder="Nro acta (A-0000001 o A0000001)"
          value={q.nro_acta || ''}
          onChange={(e) => setQ({ ...q, nro_acta: e.target.value })}
        />
        <input
          placeholder="Nro desde (A-0000001 o A0000001)"
          value={q.nro_desde || ''}
          onChange={(e) => setQ({ ...q, nro_desde: e.target.value })}
        />
        <input
          placeholder="Nro hasta (A-0000010 o A0000010)"
          value={q.nro_hasta || ''}
          onChange={(e) => setQ({ ...q, nro_hasta: e.target.value })}
        />
        <input
          type="date"
          placeholder="Fecha desde"
          value={q.desde || ''}
          onChange={(e) => setQ({ ...q, desde: e.target.value })}
        />
        <input
          type="date"
          placeholder="Fecha hasta"
          value={q.hasta || ''}
          onChange={(e) => setQ({ ...q, hasta: e.target.value })}
        />
        <select value={q.estado} onChange={(e) => setQ({ ...q, estado: e.target.value as any })}>
          <option value="todas">Todas</option>
          <option value="notificadas">Notificadas</option>
          <option value="no_notificadas">No notificadas</option>
        </select>
        <button className="btn" style={{ gridColumn: '1 / -1' }}>
          Buscar
        </button>
      </form>

      {/* Acciones de lote */}
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn" onClick={openModalLoteFiltros} disabled={!canNotifyByFiltros}>
          Notificar lote (por filtros)
        </button>
      </div>
      <div className="row" style={{ marginTop: -4, marginBottom: 8 }}>
        <button className="btn" onClick={openModalLoteSeleccion} disabled={!canNotifyBySeleccion}>
          Notificar lote (por selección)
        </button>
      </div>

      {/* Barra horizontal superior (reubicada aquí) */}
      <div
        className="xscroll"
        ref={topScrollRef}
        onScroll={syncFromTop}
        style={{ marginBottom: 8 }}
      >
        <div style={{ width: tableWidth }} />
      </div>

      {loading ? (
        <div>Cargando…</div>
      ) : (
        <div
          className="table-wrap"
          ref={scrollRef}
          onScroll={syncFromBottom}
          style={{ overflowX: 'auto', overflowY: 'hidden' }}
        >
          <div style={{ width: tableWidth }}>
            <table>
              <thead>
                <tr>
                  <th>Sel.</th>
                  <th>Notificar</th>
                  <th>ID</th>
                  <th>Foto</th>
                  <th>Nro de Acta</th>
                  <th>Fecha de carga</th>
                  <th>Dominio</th>
                  <th>Fecha de labrado</th>
                  <th>Arteria</th>
                  <th>Velocidad medida</th>
                  <th>Ubicación</th>
                  <th>Lat.</th>
                  <th>Long.</th>
                  <th>Tipo de vehiculo</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Cam. serie</th>
                  <th>Tipo de infraccion</th>
                  <th>Estado</th>
                  <th>Notificado</th>
                  <th>Fecha notif.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                      />
                    </td>
                    <td>
                      <button
                        className="btn"
                        disabled={!!r.notificado}
                        onClick={() => openModalUno(r)}
                      >
                        Notificar
                      </button>
                    </td>
                    <td>{r.id}</td>
                    <td>
                      {r.foto_file_id ? (
                        <button
                          className="btn"
                          title="Ver foto"
                          onClick={() => setPhotoId(r.foto_file_id!)}
                          style={{ padding: '6px 10px' }}
                        >
                          <CameraIcon />
                        </button>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td>{r.nro_acta}</td>
                    <td>{(r.fecha_carga || '').replace('T', ' ').replace('Z', '')}</td>
                    <td>{r.dominio}</td>
                    <td>{(r.fecha_labrado || '').slice(0, 10)}</td>
                    <td>{r.arteria || '-'}</td>
                    <td>{r.velocidad_medida ?? '-'}</td>
                    <td>{r.ubicacion_texto || '-'}</td>
                    <td>{fmtNum(r.lat)}</td>
                    <td>{fmtNum(r.lng)}</td>
                    <td>{r.tipo_vehiculo || '-'}</td>
                    <td>{r.vehiculo_marca || '-'}</td>
                    <td>{r.vehiculo_modelo || '-'}</td>
                    <td>{r.cam_serie || '-'}</td>
                    <td>{r.tipo_infraccion || '-'}</td>
                    <td>
                      <span className="pill">{r.estado}</span>
                    </td>
                    <td>{r.notificado ? 'Sí' : 'No'}</td>
                    <td>{r.fecha_notificacion || '-'}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={21} style={{ textAlign: 'center', padding: 16 }} className="muted">
                      Sin resultados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Foto */}
      {photoId && (
        <div
          onClick={() => setPhotoId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="card"
            style={{ maxWidth: '95vw', maxHeight: '95vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong>Foto</strong>
              <button className="btn" onClick={() => setPhotoId(null)}>
                Cerrar
              </button>
            </div>
            <img
              src={fotoUrl(photoId)}
              alt="Foto del acta"
              style={{ maxWidth: '90vw', maxHeight: '80vh', display: 'block' }}
            />
          </div>
        </div>
      )}

      {/* Modal de Fecha de Notificación */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ minWidth: 320 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Fecha de notificación</h3>
            <input type="date" value={modalDate} onChange={(e) => setModalDate(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn" onClick={confirmModal}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
