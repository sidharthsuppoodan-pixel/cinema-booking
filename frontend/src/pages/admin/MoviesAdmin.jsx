import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api/client';
import { ConfirmDialog, EmptyState, ErrorAlert, Loader, Modal, Poster } from '../../components/common';
import { useToast } from '../../context/ToastContext';
import { duration } from '../../utils/format';
import { PageHeader } from './AdminLayout';

const EMPTY = {
  title: '', description: '', genre: '', language: 'English', duration_minutes: 120, rating: '', certificate: 'UA',
  release_date: '', poster_url: '', trailer_url: '', cast_members: '', director: '', is_active: true,
};

function MovieForm({ initial, onSaved, onClose }) {
  const notify = useToast();
  const [f, setF] = useState(initial ? { ...EMPTY, ...Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? ''])) } : EMPTY);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Poster must be 5 MB or smaller'); return; }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/admin/uploads/poster', fd);
      setF((prev) => ({ ...prev, poster_url: r.data.url }));
      notify('Poster uploaded');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      ...f,
      duration_minutes: Number(f.duration_minutes),
      rating: f.rating === '' ? null : Number(f.rating),
      release_date: f.release_date || null,
      poster_url: f.poster_url || null,
      trailer_url: f.trailer_url || null,
      cast_members: f.cast_members || null,
      director: f.director || null,
      certificate: f.certificate || null,
    };
    ['id', 'created_at'].forEach((k) => delete body[k]);
    try {
      const r = initial ? await api.put(`/movies/${initial.id}`, body) : await api.post('/movies', body);
      notify(initial ? 'Movie updated' : 'Movie added');
      onSaved(r.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show title={initial ? `Edit “${initial.title}”` : 'Add movie'} onClose={onClose} size="xl"
      footer={(
        <>
          <button type="button" className="btn btn-outline-light" onClick={onClose}>Cancel</button>
          <button type="submit" form="movie-form" className="btn btn-danger" disabled={busy || uploading}>
            {busy && <span className="spinner-border spinner-border-sm me-2" />}{initial ? 'Save changes' : 'Add movie'}
          </button>
        </>
      )}
    >
      <form id="movie-form" onSubmit={submit}>
        <ErrorAlert message={error} />
        <div className="row g-4">
          <div className="col-md-4">
            <div className="admin-poster-preview mb-2"><Poster src={f.poster_url} title={f.title || 'Poster'} /></div>
            <label className="btn btn-outline-light w-100 mb-2">
              {uploading ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-upload me-2" />}
              Upload poster
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
            </label>
            <input className="form-control form-control-sm" placeholder="…or paste image URL" value={f.poster_url} onChange={set('poster_url')} aria-label="Poster URL" />
            <div className="form-text">JPEG, PNG or WEBP up to 5 MB. Portrait 2:3 looks best.</div>
          </div>
          <div className="col-md-8">
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label" htmlFor="m-title">Title *</label>
                <input id="m-title" className="form-control" value={f.title} onChange={set('title')} maxLength={200} required />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="m-genre">Genre(s) *</label>
                <input id="m-genre" className="form-control" value={f.genre} onChange={set('genre')} placeholder="Action, Thriller" maxLength={120} required />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="m-lang">Language *</label>
                <input id="m-lang" className="form-control" value={f.language} onChange={set('language')} maxLength={60} required />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label" htmlFor="m-dur">Duration (min) *</label>
                <input id="m-dur" type="number" min={1} max={600} className="form-control" value={f.duration_minutes} onChange={set('duration_minutes')} required />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label" htmlFor="m-rating">Rating (0–10)</label>
                <input id="m-rating" type="number" min={0} max={10} step={0.1} className="form-control" value={f.rating} onChange={set('rating')} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label" htmlFor="m-cert">Certificate</label>
                <select id="m-cert" className="form-select" value={f.certificate} onChange={set('certificate')}>
                  {['', 'U', 'UA', 'A', 'S', 'G', 'PG', 'PG-13', 'R'].map((c) => <option key={c} value={c}>{c || '—'}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label" htmlFor="m-rel">Release date</label>
                <input id="m-rel" type="date" className="form-control" value={f.release_date} onChange={set('release_date')} />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="m-desc">Description</label>
                <textarea id="m-desc" rows={4} className="form-control" value={f.description} onChange={set('description')} maxLength={5000} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="m-dir">Director</label>
                <input id="m-dir" className="form-control" value={f.director} onChange={set('director')} maxLength={120} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="m-cast">Cast</label>
                <input id="m-cast" className="form-control" value={f.cast_members} onChange={set('cast_members')} maxLength={500} />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="m-trailer">Trailer URL (YouTube / Vimeo)</label>
                <input id="m-trailer" type="url" className="form-control" value={f.trailer_url} onChange={set('trailer_url')} placeholder="https://www.youtube.com/watch?v=…" maxLength={500} />
              </div>
              <div className="col-12">
                <div className="form-check form-switch">
                  <input id="m-active" className="form-check-input" type="checkbox" checked={f.is_active} onChange={set('is_active')} />
                  <label className="form-check-label" htmlFor="m-active">Now showing (visible to customers)</label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function MoviesAdmin() {
  const notify = useToast();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | movie
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/movies', { params: { include_inactive: true, q: q || undefined } })
      .then((r) => setMovies(r.data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/movies/${deleting.id}`);
      notify(`Deleted “${deleting.title}”`);
      setDeleting(null);
      load();
    } catch (e) {
      notify(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Movies" subtitle={`${movies.length} movie(s)`}>
        <div className="search-box"><i className="bi bi-search" /><input className="form-control" type="search" placeholder="Search title, cast…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search movies" /></div>
        <button type="button" className="btn btn-danger" onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" />Add movie</button>
      </PageHeader>
      <ErrorAlert message={error} onRetry={load} />
      {loading ? <Loader /> : movies.length === 0 ? <EmptyState title="No movies yet" /> : (
        <div className="panel p-0">
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0 cb-table">
              <thead><tr><th style={{ width: 64 }}>Poster</th><th>Title</th><th>Genre</th><th>Language</th><th>Duration</th><th>Rating</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {movies.map((m) => (
                  <tr key={m.id}>
                    <td><div className="thumb"><Poster src={m.poster_url} title={m.title} /></div></td>
                    <td><div className="fw-semibold">{m.title}</div><div className="small text-secondary">{m.certificate} {m.release_date && `· ${m.release_date}`}</div></td>
                    <td className="small">{m.genre}</td>
                    <td className="small">{m.language}</td>
                    <td className="small">{duration(m.duration_minutes)}</td>
                    <td>{m.rating ?? '—'}</td>
                    <td>{m.is_active ? <span className="badge text-bg-success">Showing</span> : <span className="badge text-bg-secondary">Hidden</span>}</td>
                    <td className="text-end text-nowrap">
                      <button type="button" className="btn btn-sm btn-outline-light me-1" onClick={() => setEditing(m)} aria-label={`Edit ${m.title}`}><i className="bi bi-pencil" /></button>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(m)} aria-label={`Delete ${m.title}`}><i className="bi bi-trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editing && <MovieForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmDialog show={!!deleting} title="Delete movie" confirmLabel="Delete" busy={busy} onConfirm={remove} onClose={() => setDeleting(null)}
        message={`Delete “${deleting?.title}”? All of its showtimes without bookings will be removed too. Movies with existing bookings cannot be deleted. Hide them instead.`} />
    </>
  );
}
