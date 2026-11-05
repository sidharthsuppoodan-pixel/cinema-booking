import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import { ConfirmDialog, EmptyState, ErrorAlert, Loader, Modal } from '../../components/common';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from './AdminLayout';

const EMPTY = { name: '', address: '', city: '', state: '', pincode: '', contact_phone: '', amenities: '', is_active: true };

function TheatreForm({ initial, onClose, onSaved }) {
  const notify = useToast();
  const [f, setF] = useState(initial ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, initial[k] ?? ''])) : EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : v]));
    try {
      if (initial) await api.put(`/theatres/${initial.id}`, body);
      else await api.post('/theatres', body);
      notify(initial ? 'Theatre updated' : 'Theatre added');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show title={initial ? 'Edit theatre' : 'Add theatre'} onClose={onClose} size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-outline-light" onClick={onClose}>Cancel</button>
          <button type="submit" form="theatre-form" className="btn btn-danger" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Save</button>
        </>
      )}
    >
      <form id="theatre-form" onSubmit={submit}>
        <ErrorAlert message={error} />
        <div className="row g-3">
          <div className="col-12"><label className="form-label" htmlFor="t-name">Name *</label><input id="t-name" className="form-control" value={f.name} onChange={set('name')} maxLength={150} required /></div>
          <div className="col-12"><label className="form-label" htmlFor="t-addr">Address / location *</label><input id="t-addr" className="form-control" value={f.address} onChange={set('address')} maxLength={300} required /></div>
          <div className="col-md-4"><label className="form-label" htmlFor="t-city">City *</label><input id="t-city" className="form-control" value={f.city} onChange={set('city')} maxLength={100} required /></div>
          <div className="col-md-4"><label className="form-label" htmlFor="t-state">State</label><input id="t-state" className="form-control" value={f.state} onChange={set('state')} maxLength={100} /></div>
          <div className="col-md-4"><label className="form-label" htmlFor="t-pin">PIN code</label><input id="t-pin" className="form-control" value={f.pincode} onChange={set('pincode')} maxLength={12} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="t-phone">Contact phone</label><input id="t-phone" className="form-control" value={f.contact_phone} onChange={set('contact_phone')} maxLength={20} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="t-amen">Amenities (comma separated)</label><input id="t-amen" className="form-control" value={f.amenities} onChange={set('amenities')} maxLength={300} placeholder="Dolby Atmos, Parking" /></div>
          <div className="col-12">
            <div className="form-check form-switch">
              <input id="t-active" className="form-check-input" type="checkbox" checked={f.is_active} onChange={set('is_active')} />
              <label className="form-check-label" htmlFor="t-active">Active (visible to customers)</label>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function TheatresAdmin() {
  const notify = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/theatres', { params: { include_inactive: true, q: q || undefined } })
      .then((r) => setRows(r.data)).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false));
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/theatres/${deleting.id}`);
      notify(`Deleted ${deleting.name}`);
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
      <PageHeader title="Theatres" subtitle="Cinema locations and their screens">
        <div className="search-box"><i className="bi bi-search" /><input className="form-control" type="search" placeholder="Search name, city…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search theatres" /></div>
        <button type="button" className="btn btn-danger" onClick={() => setEditing('new')}><i className="bi bi-plus-lg me-1" />Add theatre</button>
      </PageHeader>
      <ErrorAlert message={error} onRetry={load} />
      {loading ? <Loader /> : rows.length === 0 ? <EmptyState icon="building" title="No theatres yet" /> : (
        <div className="panel p-0">
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0 cb-table">
              <thead><tr><th>Name</th><th>Location</th><th>Contact</th><th>Screens</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="fw-semibold">{t.name}<div className="small text-secondary">{t.amenities}</div></td>
                    <td className="small">{t.address}<div className="text-secondary">{t.city}{t.state ? `, ${t.state}` : ''} {t.pincode}</div></td>
                    <td className="small">{t.contact_phone || '—'}</td>
                    <td><Link to={`/admin/screens?theatre=${t.id}`} className="badge text-bg-dark text-decoration-none">{t.screen_count} screens <i className="bi bi-arrow-right" /></Link></td>
                    <td>{t.is_active ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}</td>
                    <td className="text-end text-nowrap">
                      <button type="button" className="btn btn-sm btn-outline-light me-1" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}><i className="bi bi-pencil" /></button>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(t)} aria-label={`Delete ${t.name}`}><i className="bi bi-trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editing && <TheatreForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmDialog show={!!deleting} title="Delete theatre" confirmLabel="Delete" busy={busy} onConfirm={remove} onClose={() => setDeleting(null)}
        message={`Delete ${deleting?.name}? Its screens, seats and showtimes will be removed. Theatres with bookings cannot be deleted. Mark them inactive instead.`} />
    </>
  );
}
