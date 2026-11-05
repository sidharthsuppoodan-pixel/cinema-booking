import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import { ConfirmDialog, EmptyState, ErrorAlert, Loader, Modal } from '../../components/common';
import { useToast } from '../../context/ToastContext';
import { fmtDate, fmtTime, fromLocalInput, money, toLocalInput } from '../../utils/format';
import { PageHeader } from './AdminLayout';

function ShowtimeForm({ initial, movies, screens, onClose, onSaved }) {
  const notify = useToast();
  const defaultStart = () => {
    const d = new Date(Date.now() + 86400000);
    d.setHours(18, 0, 0, 0);
    return toLocalInput(d.toISOString());
  };
  const [f, setF] = useState(initial ? {
    movie_id: initial.movie_id, screen_id: initial.screen_id, start_time: toLocalInput(initial.start_time), language: initial.language || '',
    price_standard: initial.price_standard, price_premium: initial.price_premium, price_recliner: initial.price_recliner, is_active: initial.is_active,
  } : {
    movie_id: movies[0]?.id || '', screen_id: screens[0]?.id || '', start_time: defaultStart(), language: '',
    price_standard: 180, price_premium: 260, price_recliner: 450, is_active: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const movie = movies.find((m) => m.id === Number(f.movie_id));
  const end = movie && f.start_time ? new Date(new Date(f.start_time).getTime() + (movie.duration_minutes + 15) * 60000) : null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      ...f, movie_id: Number(f.movie_id), screen_id: Number(f.screen_id), start_time: fromLocalInput(f.start_time), language: f.language || null,
      price_standard: Number(f.price_standard), price_premium: Number(f.price_premium), price_recliner: Number(f.price_recliner),
    };
    try {
      if (initial) await api.put(`/showtimes/${initial.id}`, body);
      else await api.post('/showtimes', body);
      notify(initial ? 'Showtime updated' : 'Showtime created');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show title={initial ? 'Edit showtime' : 'Create showtime'} onClose={onClose} size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-outline-light" onClick={onClose}>Cancel</button>
          <button type="submit" form="show-form" className="btn btn-danger" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Save</button>
        </>
      )}
    >
      <form id="show-form" onSubmit={submit}>
        <ErrorAlert message={error} />
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label" htmlFor="sh-movie">Movie *</label>
            <select id="sh-movie" className="form-select" value={f.movie_id} onChange={set('movie_id')} required>
              {movies.map((m) => <option key={m.id} value={m.id}>{m.title}{m.is_active ? '' : ' (hidden)'}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="sh-screen">Screen *</label>
            <select id="sh-screen" className="form-select" value={f.screen_id} onChange={set('screen_id')} required>
              {screens.map((s) => <option key={s.id} value={s.id}>{s.theatre_name} – {s.name} ({s.screen_type})</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="sh-start">Start date &amp; time *</label>
            <input id="sh-start" type="datetime-local" className="form-control" value={f.start_time} onChange={set('start_time')} required />
            {end && <div className="form-text">Ends ≈ {fmtTime(end.toISOString())} (incl. 15 min cleaning buffer)</div>}
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="sh-lang">Language / format override</label>
            <input id="sh-lang" className="form-control" value={f.language} onChange={set('language')} placeholder={movie?.language} maxLength={60} />
          </div>
          <div className="col-4"><label className="form-label" htmlFor="p1">Standard ₹ *</label><input id="p1" type="number" min={0} step="0.01" className="form-control" value={f.price_standard} onChange={set('price_standard')} required /></div>
          <div className="col-4"><label className="form-label" htmlFor="p2">Premium ₹ *</label><input id="p2" type="number" min={0} step="0.01" className="form-control" value={f.price_premium} onChange={set('price_premium')} required /></div>
          <div className="col-4"><label className="form-label" htmlFor="p3">Recliner ₹ *</label><input id="p3" type="number" min={0} step="0.01" className="form-control" value={f.price_recliner} onChange={set('price_recliner')} required /></div>
          <div className="col-12">
            <div className="form-check form-switch">
              <input id="sh-active" className="form-check-input" type="checkbox" checked={f.is_active} onChange={set('is_active')} />
              <label className="form-check-label" htmlFor="sh-active">Open for booking</label>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function ShowtimesAdmin() {
  const notify = useToast();
  const [shows, setShows] = useState([]);
  const [movies, setMovies] = useState([]);
  const [theatres, setTheatres] = useState([]);
  const [screens, setScreens] = useState([]);
  const [filters, setFilters] = useState({ movie_id: '', theatre_id: '', date: '', past: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/movies', { params: { include_inactive: true } }),
      api.get('/theatres', { params: { include_inactive: true } }),
      api.get('/screens'),
    ]).then(([m, t, s]) => {
      setMovies(m.data);
      setTheatres(t.data);
      const names = Object.fromEntries(t.data.map((x) => [x.id, x.name]));
      setScreens(s.data.map((x) => ({ ...x, theatre_name: names[x.theatre_id] })));
    }).catch((e) => setError(errorMessage(e)));
  }, []);

  const load = () => {
    setLoading(true);
    const params = { include_inactive: true, upcoming_only: !filters.past, movie_id: filters.movie_id || undefined, theatre_id: filters.theatre_id || undefined };
    if (filters.date) {
      const d = new Date(`${filters.date}T00:00:00`);
      params.start_from = d.toISOString();
      params.start_to = new Date(d.getTime() + 86400000).toISOString();
      params.upcoming_only = false;
    }
    api.get('/showtimes', { params }).then((r) => setShows(r.data)).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false));
  };
  useEffect(load, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/showtimes/${deleting.id}`);
      notify('Showtime deleted');
      setDeleting(null);
      load();
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const setFilter = (k) => (e) => setFilters({ ...filters, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <>
      <PageHeader title="Showtimes" subtitle="Schedule movies on screens and set ticket prices">
        <button type="button" className="btn btn-danger" disabled={!movies.length || !screens.length} onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" />Create showtime</button>
      </PageHeader>
      <div className="panel mb-3">
        <div className="row g-2 align-items-center">
          <div className="col-md-4">
            <select className="form-select" value={filters.movie_id} onChange={setFilter('movie_id')} aria-label="Filter by movie">
              <option value="">All movies</option>
              {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <select className="form-select" value={filters.theatre_id} onChange={setFilter('theatre_id')} aria-label="Filter by theatre">
              <option value="">All theatres</option>
              {theatres.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="col-md-3"><input type="date" className="form-control" value={filters.date} onChange={setFilter('date')} aria-label="Filter by date" /></div>
          <div className="col-md-2">
            <div className="form-check">
              <input id="f-past" className="form-check-input" type="checkbox" checked={filters.past} onChange={setFilter('past')} />
              <label className="form-check-label small" htmlFor="f-past">Include past</label>
            </div>
          </div>
        </div>
      </div>
      <ErrorAlert message={error} onRetry={load} />
      {loading ? <Loader /> : shows.length === 0 ? <EmptyState icon="calendar-x" title="No showtimes match" /> : (
        <div className="panel p-0">
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0 cb-table">
              <thead><tr><th>Date &amp; time</th><th>Movie</th><th>Theatre / screen</th><th>Prices (S / P / R)</th><th>Occupancy</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {shows.map((s) => {
                  const pct = s.capacity ? Math.round((s.booked_count / s.capacity) * 100) : 0;
                  return (
                    <tr key={s.id}>
                      <td className="text-nowrap">{fmtDate(s.start_time)}<div className="fw-semibold">{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</div></td>
                      <td>{s.movie_title}<div className="small text-secondary">{s.language}</div></td>
                      <td className="small">{s.theatre_name}<div className="text-secondary">{s.screen_name} · {s.screen_type}</div></td>
                      <td className="small text-nowrap">{money(s.price_standard)} / {money(s.price_premium)} / {money(s.price_recliner)}</td>
                      <td style={{ minWidth: 120 }}>
                        <div className="small">{s.booked_count}/{s.capacity}</div>
                        <div className="progress" style={{ height: 6 }}><div className="progress-bar bg-danger" style={{ width: `${pct}%` }} /></div>
                      </td>
                      <td>{s.is_active ? <span className="badge text-bg-success">Open</span> : <span className="badge text-bg-secondary">Closed</span>}</td>
                      <td className="text-end text-nowrap">
                        <Link to={`/admin/bookings?showtime=${s.id}`} className="btn btn-sm btn-outline-light me-1" title="View bookings"><i className="bi bi-ticket-perforated" /></Link>
                        <button type="button" className="btn btn-sm btn-outline-light me-1" onClick={() => setEditing(s)} aria-label="Edit showtime"><i className="bi bi-pencil" /></button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(s)} aria-label="Delete showtime"><i className="bi bi-trash" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editing && <ShowtimeForm initial={editing === 'new' ? null : editing} movies={movies} screens={screens} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmDialog show={!!deleting} title="Delete showtime" confirmLabel="Delete" busy={busy} onConfirm={remove} onClose={() => setDeleting(null)}
        message={deleting && `Delete the ${fmtTime(deleting.start_time)} show of ${deleting.movie_title} on ${fmtDate(deleting.start_time)}? Showtimes with bookings cannot be deleted. Close them for booking instead.`} />
    </>
  );
}
