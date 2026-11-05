import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import SeatGrid from '../../components/SeatGrid';
import { ConfirmDialog, EmptyState, ErrorAlert, Loader, Modal } from '../../components/common';
import { useToast } from '../../context/ToastContext';
import { CATEGORY_LABEL } from '../../utils/format';
import { PageHeader } from './AdminLayout';

const TYPES = ['2D', '3D', 'IMAX', '4DX'];
const CATS = ['STANDARD', 'PREMIUM', 'RECLINER'];

function ScreenForm({ theatreId, initial, onClose, onSaved }) {
  const notify = useToast();
  const [f, setF] = useState(initial
    ? { name: initial.name, screen_type: initial.screen_type, seats_per_row: initial.seats_per_row, seat_layout: initial.seat_layout.map((b) => ({ ...b })), is_active: initial.is_active }
    : { name: '', screen_type: '2D', seats_per_row: 12, seat_layout: [{ category: 'STANDARD', rows: 5 }, { category: 'PREMIUM', rows: 3 }, { category: 'RECLINER', rows: 2 }], is_active: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const totalRows = f.seat_layout.reduce((a, b) => a + Number(b.rows || 0), 0);
  const capacity = totalRows * Number(f.seats_per_row || 0);

  const setBlock = (i, k, v) => setF({ ...f, seat_layout: f.seat_layout.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });
  const move = (i, d) => {
    const arr = [...f.seat_layout];
    [arr[i], arr[i + d]] = [arr[i + d], arr[i]];
    setF({ ...f, seat_layout: arr });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (totalRows > 26) { setError('A screen can have at most 26 rows'); return; }
    setBusy(true);
    setError('');
    const body = { ...f, seats_per_row: Number(f.seats_per_row), seat_layout: f.seat_layout.map((b) => ({ category: b.category, rows: Number(b.rows) })) };
    try {
      const r = initial ? await api.put(`/screens/${initial.id}`, body) : await api.post('/screens', { ...body, theatre_id: Number(theatreId) });
      notify(initial ? 'Screen updated' : 'Screen added');
      onSaved(r.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show title={initial ? `Edit ${initial.name}` : 'Add screen'} onClose={onClose} size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-outline-light" onClick={onClose}>Cancel</button>
          <button type="submit" form="screen-form" className="btn btn-danger" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Save</button>
        </>
      )}
    >
      <form id="screen-form" onSubmit={submit}>
        <ErrorAlert message={error} />
        <div className="row g-3 mb-3">
          <div className="col-md-5"><label className="form-label" htmlFor="s-name">Screen name *</label><input id="s-name" className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={60} required /></div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="s-type">Type</label>
            <select id="s-type" className="form-select" value={f.screen_type} onChange={(e) => setF({ ...f, screen_type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="col-6 col-md-4"><label className="form-label" htmlFor="s-per">Seats per row *</label><input id="s-per" type="number" min={1} max={40} className="form-control" value={f.seats_per_row} onChange={(e) => setF({ ...f, seats_per_row: e.target.value })} required /></div>
        </div>
        <label className="form-label">Seat categories <span className="text-secondary small">(first block is nearest the screen, starting at row A)</span></label>
        {f.seat_layout.map((b, i) => (
          <div className="d-flex gap-2 mb-2 align-items-center" key={i}>
            <select className="form-select" value={b.category} onChange={(e) => setBlock(i, 'category', e.target.value)} aria-label="Category">
              {CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
            <div className="input-group" style={{ maxWidth: 160 }}>
              <input type="number" min={1} max={26} className="form-control" value={b.rows} onChange={(e) => setBlock(i, 'rows', e.target.value)} aria-label="Rows" required />
              <span className="input-group-text">rows</span>
            </div>
            <button type="button" className="btn btn-sm btn-outline-light" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><i className="bi bi-arrow-up" /></button>
            <button type="button" className="btn btn-sm btn-outline-light" disabled={i === f.seat_layout.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><i className="bi bi-arrow-down" /></button>
            <button type="button" className="btn btn-sm btn-outline-danger" disabled={f.seat_layout.length === 1} onClick={() => setF({ ...f, seat_layout: f.seat_layout.filter((_, j) => j !== i) })} aria-label="Remove"><i className="bi bi-x-lg" /></button>
          </div>
        ))}
        <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setF({ ...f, seat_layout: [...f.seat_layout, { category: 'STANDARD', rows: 2 }] })}><i className="bi bi-plus" /> Add block</button>
        <div className={`alert ${totalRows > 26 ? 'alert-danger' : 'alert-dark'} small mt-3 mb-2`}>
          Total: <strong>{totalRows}</strong> rows × <strong>{f.seats_per_row || 0}</strong> seats = <strong>{capacity}</strong> seats
        </div>
        <div className="form-check form-switch">
          <input id="s-active" className="form-check-input" type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
          <label className="form-check-label" htmlFor="s-active">Active</label>
        </div>
        {initial && <div className="form-text">Changing seats per row or categories regenerates the seat map. This is blocked once seats have bookings.</div>}
      </form>
    </Modal>
  );
}

export default function ScreensAdmin() {
  const notify = useToast();
  const [params, setParams] = useSearchParams();
  const [theatres, setTheatres] = useState([]);
  const theatreId = params.get('theatre') || '';
  const [screens, setScreens] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/theatres', { params: { include_inactive: true } }).then((r) => {
      setTheatres(r.data);
      if (!theatreId && r.data.length) setParams({ theatre: String(r.data[0].id) }, { replace: true });
    }).catch((e) => setError(errorMessage(e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadScreens = () => {
    if (!theatreId) return;
    setLoading(true);
    api.get('/screens', { params: { theatre_id: theatreId } })
      .then((r) => setScreens(r.data)).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false));
  };
  useEffect(() => { setSelected(null); loadScreens(); }, [theatreId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openScreen = (id) => api.get(`/screens/${id}`).then((r) => setSelected(r.data)).catch((e) => notify(errorMessage(e), 'danger'));

  const toggleSeat = async (seat) => {
    try {
      await api.patch(`/screens/seats/${seat.id}`, { is_active: !seat.is_active });
      await openScreen(selected.id);
      loadScreens();
    } catch (e) {
      notify(errorMessage(e), 'danger');
    }
  };

  const gridRows = useMemo(() => {
    if (!selected) return [];
    const rows = new Map();
    selected.seats.forEach((s) => {
      if (!rows.has(s.row_label)) rows.set(s.row_label, { row_label: s.row_label, category: s.category, seats: [] });
      rows.get(s.row_label).seats.push({ ...s, label: `${s.row_label}${s.seat_number}`, status: s.is_active ? 'available' : 'blocked', adminToggle: true });
    });
    return [...rows.values()];
  }, [selected]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/screens/${deleting.id}`);
      notify(`Deleted ${deleting.name}`);
      if (selected?.id === deleting.id) setSelected(null);
      setDeleting(null);
      loadScreens();
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Screens & Seats" subtitle="Configure auditoriums, seat capacity and seat categories">
        <select className="form-select w-auto" value={theatreId} onChange={(e) => setParams({ theatre: e.target.value })} aria-label="Theatre">
          {theatres.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.city})</option>)}
        </select>
        <button type="button" className="btn btn-danger" disabled={!theatreId} onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" />Add screen</button>
      </PageHeader>
      <ErrorAlert message={error} />
      {theatres.length === 0 && !error ? <EmptyState icon="building" title="Add a theatre first" /> : loading ? <Loader /> : screens.length === 0 ? (
        <EmptyState icon="display" title="No screens in this theatre yet" />
      ) : (
        <div className="row g-3 mb-4">
          {screens.map((s) => (
            <div className="col-sm-6 col-xl-4" key={s.id}>
              <div className={`panel screen-card ${selected?.id === s.id ? 'active' : ''}`}>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h5 className="mb-1">{s.name} <span className="badge text-bg-danger ms-1">{s.screen_type}</span></h5>
                    <div className="small text-secondary">{s.capacity} seats · {s.seats_per_row} per row {!s.is_active && <span className="badge text-bg-secondary ms-1">Inactive</span>}</div>
                  </div>
                  <div className="text-nowrap">
                    <button type="button" className="btn btn-sm btn-outline-light me-1" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}><i className="bi bi-pencil" /></button>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(s)} aria-label={`Delete ${s.name}`}><i className="bi bi-trash" /></button>
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-1 my-2">
                  {Object.entries(s.category_counts).map(([c, n]) => <span key={c} className={`chip chip-sm static cat-chip-${c.toLowerCase()}`}>{CATEGORY_LABEL[c]}: {n}</span>)}
                </div>
                <button type="button" className="btn btn-sm btn-outline-light w-100" onClick={() => openScreen(s.id)}><i className="bi bi-grid-3x3-gap me-1" />View / edit seats</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {selected && (
        <div className="panel">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="mb-0">{selected.theatre_name} – {selected.name} seat map</h5>
            <button type="button" className="btn-close" aria-label="Close seat map" onClick={() => setSelected(null)} />
          </div>
          <p className="small text-secondary">Click a seat to mark it unavailable (e.g. broken or reserved for accessibility), or click again to re-enable it.</p>
          <SeatGrid rows={gridRows} seatsPerRow={selected.seats_per_row} onSeatClick={toggleSeat} />
        </div>
      )}
      {editing && (
        <ScreenForm theatreId={theatreId} initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={(s) => { setEditing(null); loadScreens(); if (selected?.id === s.id) setSelected(s); }} />
      )}
      <ConfirmDialog show={!!deleting} title="Delete screen" confirmLabel="Delete" busy={busy} onConfirm={remove} onClose={() => setDeleting(null)}
        message={`Delete ${deleting?.name}? Its seats and showtimes will be removed. Screens with bookings cannot be deleted.`} />
    </>
  );
}
