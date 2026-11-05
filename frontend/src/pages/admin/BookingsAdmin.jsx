import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import CancelBookingDialog from '../../components/CancelBookingDialog';
import { EmptyState, ErrorAlert, Loader, Modal, Pagination, StatusBadge } from '../../components/common';
import { useToast } from '../../context/ToastContext';
import { fmtDateTime, money } from '../../utils/format';
import { PageHeader } from './AdminLayout';

const STATUSES = ['CONFIRMED', 'COMPLETED', 'CANCELLED'];
const PAY = ['PAID', 'PENDING', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];

function BookingDetail({ code, onClose, onChanged }) {
  const notify = useToast();
  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [payStatus, setPayStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(null);

  const load = () => api.get(`/admin/bookings/${code}`).then((r) => {
    setB(r.data);
    setStatus(r.data.status);
    setPayStatus(r.data.payment?.status || '');
  }).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (status === 'CANCELLED' && b.status !== 'CANCELLED') { setCancelling(b); return; }
    setBusy(true);
    setError('');
    try {
      const body = {};
      if (status !== b.status) body.status = status;
      if (payStatus && payStatus !== b.payment?.status) body.payment_status = payStatus;
      const r = await api.patch(`/admin/bookings/${code}`, body);
      setB(r.data);
      notify('Booking updated');
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show title={`Booking ${code}`} onClose={onClose} size="lg"
      footer={b && (
        <>
          {b.status !== 'CANCELLED' && <button type="button" className="btn btn-outline-danger me-auto" onClick={() => setCancelling(b)}><i className="bi bi-x-circle me-1" />Cancel &amp; refund</button>}
          <button type="button" className="btn btn-outline-light" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-danger" onClick={save} disabled={busy || (status === b.status && payStatus === (b.payment?.status || ''))}>
            {busy && <span className="spinner-border spinner-border-sm me-2" />}Save changes
          </button>
        </>
      )}
    >
      <ErrorAlert message={error} />
      {!b ? <Loader /> : (
        <div className="row g-4">
          <div className="col-md-6">
            <h6 className="text-secondary text-uppercase small">Customer</h6>
            <div className="fw-semibold">{b.customer_name}</div>
            <div className="small">{b.customer_email}</div>
            <div className="small text-secondary">{b.customer_phone || 'No phone'}</div>
            <h6 className="text-secondary text-uppercase small mt-4">Show</h6>
            <div className="fw-semibold">{b.movie_title}</div>
            <div className="small">{fmtDateTime(b.start_time)}</div>
            <div className="small text-secondary">{b.theatre_name}, {b.theatre_city} · {b.screen_name} ({b.screen_type})</div>
            <h6 className="text-secondary text-uppercase small mt-4">Seats</h6>
            <div className="d-flex flex-wrap gap-1">
              {b.seats.map((s) => <span key={s.seat_id} className={`seat-tag ${s.is_active ? '' : 'released'}`} title={`${s.category} · ${money(s.price)}`}>{s.seat_label}</span>)}
            </div>
          </div>
          <div className="col-md-6">
            <h6 className="text-secondary text-uppercase small">Payment</h6>
            <div className="d-flex justify-content-between small"><span>Tickets</span><span>{money(b.subtotal)}</span></div>
            <div className="d-flex justify-content-between small"><span>Convenience fee</span><span>{money(b.convenience_fee)}</span></div>
            <div className="d-flex justify-content-between fw-bold"><span>Total</span><span>{money(b.total_amount)}</span></div>
            {b.payment && (
              <div className="small text-secondary mt-1">
                {b.payment.method.replace('_', ' ')} · {b.payment.transaction_ref}<br />
                Paid {b.payment.paid_at ? fmtDateTime(b.payment.paid_at) : '—'} · Refunded {money(b.payment.refund_amount)}
              </div>
            )}
            <div className="row g-2 mt-3">
              <div className="col-6">
                <label className="form-label small" htmlFor="bk-status">Booking status</label>
                <select id="bk-status" className="form-select form-select-sm" value={status} onChange={(e) => setStatus(e.target.value)} disabled={b.status === 'CANCELLED'}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label small" htmlFor="bk-pay">Payment status</label>
                <select id="bk-pay" className="form-select form-select-sm" value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
                  {PAY.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="small text-secondary mt-3">Booked {fmtDateTime(b.created_at)}</div>
            {b.cancelled_at && <div className="small text-warning">Cancelled {fmtDateTime(b.cancelled_at)}: {b.cancellation_reason}</div>}
          </div>
        </div>
      )}
      <CancelBookingDialog booking={cancelling} admin onClose={() => setCancelling(null)} onDone={() => { load(); onChanged(); }} />
    </Modal>
  );
}

export default function BookingsAdmin() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState('');
  const [payStatus, setPayStatus] = useState('');
  const showtime = params.get('showtime') || '';
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/admin/bookings', { params: { q: q || undefined, status: status || undefined, payment_status: payStatus || undefined, showtime_id: showtime || undefined, page } })
      .then((r) => setData(r.data)).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false));
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, status, payStatus, showtime, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [q, status, payStatus, showtime]);

  return (
    <>
      <PageHeader title="Bookings" subtitle={`${data.total} booking(s)`} />
      <div className="panel mb-3">
        <div className="row g-2">
          <div className="col-md-6">
            <div className="search-box w-100"><i className="bi bi-search" />
              <input className="form-control" type="search" placeholder="Search booking ID, customer name/email, movie…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bookings" />
            </div>
          </div>
          <div className="col-6 col-md-3">
            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Booking status">
              <option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-3">
            <select className="form-select" value={payStatus} onChange={(e) => setPayStatus(e.target.value)} aria-label="Payment status">
              <option value="">All payments</option>{PAY.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        {showtime && (
          <div className="mt-2 small">Filtered to showtime #{showtime} <button type="button" className="btn btn-link btn-sm p-0 ms-1" onClick={() => setParams({})}>clear</button></div>
        )}
      </div>
      <ErrorAlert message={error} onRetry={load} />
      {loading ? <Loader /> : data.items.length === 0 ? <EmptyState icon="ticket-perforated" title="No bookings found" /> : (
        <div className="panel p-0">
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0 cb-table">
              <thead><tr><th>Booking ID</th><th>Customer</th><th>Movie / show</th><th>Seats</th><th>Total</th><th>Status</th><th>Payment</th><th /></tr></thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b.id} className="cursor-pointer" onClick={() => setOpen(b.booking_code)}>
                    <td className="font-monospace">{b.booking_code}<div className="small text-secondary font-sans">{fmtDateTime(b.created_at)}</div></td>
                    <td>{b.customer_name}<div className="small text-secondary">{b.customer_email}</div></td>
                    <td>{b.movie_title}<div className="small text-secondary">{fmtDateTime(b.start_time)} · {b.theatre_name}</div></td>
                    <td className="small">{b.seats.map((s) => s.seat_label).join(', ')}</td>
                    <td>{money(b.total_amount)}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td><StatusBadge status={b.payment?.status} /></td>
                    <td><button type="button" className="btn btn-sm btn-outline-light" aria-label={`Open ${b.booking_code}`}><i className="bi bi-eye" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination page={data.page} pageSize={data.page_size} total={data.total} onChange={setPage} />
      {open && <BookingDetail code={open} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}
