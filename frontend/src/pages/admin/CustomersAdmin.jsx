import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import { ConfirmDialog, EmptyState, ErrorAlert, Loader, Modal, Pagination, StatusBadge } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fmtDate, fmtDateTime, money } from '../../utils/format';
import { PageHeader } from './AdminLayout';

function CustomerModal({ id, onClose, onSaved }) {
  const notify = useToast();
  const [data, setData] = useState(null);
  const [f, setF] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/admin/customers/${id}`).then((r) => {
      setData(r.data);
      const c = r.data.customer;
      setF({ full_name: c.full_name, email: c.email, phone: c.phone || '', is_active: c.is_active, role: c.role });
    }).catch((e) => setError(errorMessage(e)));
  }, [id]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.put(`/admin/customers/${id}`, { ...f, phone: f.phone || null });
      notify('Customer updated');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show title={data ? data.customer.full_name : 'Customer'} onClose={onClose} size="lg"
      footer={f && (
        <>
          <button type="button" className="btn btn-outline-light" onClick={onClose}>Close</button>
          <button type="submit" form="cust-form" className="btn btn-danger" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Save</button>
        </>
      )}
    >
      <ErrorAlert message={error} />
      {!f ? <Loader /> : (
        <>
          <form id="cust-form" onSubmit={save} className="row g-3 mb-4">
            <div className="col-md-6"><label className="form-label" htmlFor="c-name">Full name</label><input id="c-name" className="form-control" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} minLength={2} maxLength={120} required /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="c-email">Email</label><input id="c-email" type="email" className="form-control" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
            <div className="col-md-4"><label className="form-label" htmlFor="c-phone">Phone</label><input id="c-phone" className="form-control" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={20} /></div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="c-role">Role</label>
              <select id="c-role" className="form-select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="customer">Customer</option><option value="admin">Admin</option></select>
            </div>
            <div className="col-md-4 d-flex align-items-end">
              <div className="form-check form-switch mb-2">
                <input id="c-active" className="form-check-input" type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
                <label className="form-check-label" htmlFor="c-active">Account active</label>
              </div>
            </div>
          </form>
          <h6 className="text-secondary text-uppercase small">Booking history ({data.bookings.length}) · spent {money(data.customer.total_spent)}</h6>
          {data.bookings.length === 0 ? <p className="small text-secondary">No bookings yet.</p> : (
            <div className="table-responsive">
              <table className="table table-dark table-sm align-middle cb-table mb-0">
                <thead><tr><th>ID</th><th>Movie</th><th>Show</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {data.bookings.map((b) => (
                    <tr key={b.id}>
                      <td><Link to={`/admin/bookings?q=${b.booking_code}`} className="font-monospace">{b.booking_code}</Link></td>
                      <td className="small">{b.movie_title}</td>
                      <td className="small">{fmtDateTime(b.start_time)}</td>
                      <td className="small">{money(b.total_amount)}</td>
                      <td><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export default function CustomersAdmin() {
  const notify = useToast();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('customer');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/admin/customers', { params: { q: q || undefined, role: role || undefined, page } })
      .then((r) => setData(r.data)).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false));
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, role, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [q, role]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/customers/${deleting.id}`);
      notify(`Deleted ${deleting.full_name}`);
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
      <PageHeader title="Customers" subtitle={`${data.total} account(s)`}>
        <div className="search-box"><i className="bi bi-search" /><input className="form-control" type="search" placeholder="Search name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" /></div>
        <select className="form-select w-auto" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="customer">Customers</option><option value="admin">Admins</option><option value="">All users</option>
        </select>
      </PageHeader>
      <ErrorAlert message={error} onRetry={load} />
      {loading ? <Loader /> : data.items.length === 0 ? <EmptyState icon="people" title="No accounts found" /> : (
        <div className="panel p-0">
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0 cb-table">
              <thead><tr><th>Name</th><th>Contact</th><th>Joined</th><th>Bookings</th><th>Spent</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td><div className="d-flex align-items-center gap-2"><span className="avatar">{c.full_name.charAt(0).toUpperCase()}</span><span className="fw-semibold">{c.full_name}</span>{c.role === 'admin' && <span className="badge text-bg-danger">Admin</span>}</div></td>
                    <td className="small">{c.email}<div className="text-secondary">{c.phone || '—'}</div></td>
                    <td className="small">{fmtDate(c.created_at)}</td>
                    <td>{c.booking_count}</td>
                    <td>{money(c.total_spent)}</td>
                    <td>{c.is_active ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Disabled</span>}</td>
                    <td className="text-end text-nowrap">
                      <button type="button" className="btn btn-sm btn-outline-light me-1" onClick={() => setOpen(c.id)} aria-label={`Edit ${c.full_name}`}><i className="bi bi-pencil" /></button>
                      <button type="button" className="btn btn-sm btn-outline-danger" disabled={c.id === user.id} onClick={() => setDeleting(c)} aria-label={`Delete ${c.full_name}`}><i className="bi bi-trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination page={data.page} pageSize={data.page_size} total={data.total} onChange={setPage} />
      {open && <CustomerModal id={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />}
      <ConfirmDialog show={!!deleting} title="Delete account" confirmLabel="Delete permanently" busy={busy} onConfirm={remove} onClose={() => setDeleting(null)}
        message={`Permanently delete ${deleting?.full_name} (${deleting?.email})? Their ${deleting?.booking_count} booking(s) will also be removed and their seats released. To keep history, disable the account instead.`} />
    </>
  );
}
