import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import CancelBookingDialog from '../components/CancelBookingDialog';
import { ErrorAlert, Loader, Poster, StatusBadge } from '../components/common';
import { CATEGORY_LABEL, fmtDate, fmtDateTime, fmtTime, money } from '../utils/format';

export default function BookingConfirmation() {
  const { code } = useParams();
  const location = useLocation();
  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(null);

  const load = () => api.get(`/bookings/${code}`).then((r) => setB(r.data)).catch((e) => setError(errorMessage(e, 'Booking not found')));
  useEffect(() => { load(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!b) return <div className="container py-5">{error ? <ErrorAlert message={error} /> : <Loader />}</div>;

  const justBooked = location.state?.justBooked;

  return (
    <div className="container py-5" style={{ maxWidth: 860 }}>
      {justBooked && b.status === 'CONFIRMED' && (
        <div className="text-center mb-4 success-banner">
          <div className="success-icon"><i className="bi bi-check-lg" /></div>
          <h1 className="h3 mt-3 mb-1">Booking confirmed!</h1>
          <p className="text-secondary mb-0">Your tickets are ready. Show this booking ID at the theatre.</p>
        </div>
      )}

      <div className="ticket">
        <div className="ticket-main">
          <div className="d-flex gap-3">
            <div className="ticket-poster"><Poster src={b.movie_poster_url} title={b.movie_title} /></div>
            <div className="min-w-0">
              <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                <h2 className="h4 mb-0">{b.movie_title}</h2>
                {b.movie_certificate && <span className="cert">{b.movie_certificate}</span>}
              </div>
              <div className="text-secondary small mb-2">{b.language} · {b.screen_type}</div>
              <div className="fw-semibold">{fmtDate(b.start_time)}</div>
              <div className="fs-5 text-danger fw-bold">{fmtTime(b.start_time)}</div>
              <div className="small mt-2"><i className="bi bi-building" /> {b.theatre_name}</div>
              <div className="small text-secondary">{b.theatre_address}, {b.theatre_city}</div>
            </div>
          </div>
          <hr className="ticket-divider" />
          <div className="row g-3 small">
            <div className="col-6 col-md-3"><div className="text-secondary">Screen</div><div className="fw-semibold">{b.screen_name}</div></div>
            <div className="col-6 col-md-3"><div className="text-secondary">Seats ({b.seat_count})</div><div className="fw-semibold">{b.seats.map((s) => s.seat_label).join(', ')}</div></div>
            <div className="col-6 col-md-3"><div className="text-secondary">Status</div><StatusBadge status={b.status} /></div>
            <div className="col-6 col-md-3"><div className="text-secondary">Payment</div><StatusBadge status={b.payment?.status} /></div>
          </div>
        </div>
        <div className="ticket-stub">
          <div className="small text-secondary text-uppercase">Booking ID</div>
          <div className="booking-code">{b.booking_code}</div>
          <div className="barcode" aria-hidden="true" />
          <div className="small text-secondary mt-2">Booked {fmtDateTime(b.created_at)}</div>
        </div>
      </div>

      <div className="panel mt-4">
        <h5 className="mb-3">Payment details</h5>
        {Object.entries(b.seats.reduce((acc, s) => {
          acc[s.category] = acc[s.category] || { n: 0, sum: 0 };
          acc[s.category].n += 1;
          acc[s.category].sum += s.price;
          return acc;
        }, {})).map(([cat, v]) => (
          <div className="d-flex justify-content-between small mb-1" key={cat}><span>{CATEGORY_LABEL[cat]} × {v.n}</span><span>{money(v.sum)}</span></div>
        ))}
        <div className="d-flex justify-content-between small mb-1 text-secondary"><span>Convenience fee</span><span>{money(b.convenience_fee)}</span></div>
        <hr />
        <div className="d-flex justify-content-between fw-bold"><span>Total paid</span><span>{money(b.total_amount)}</span></div>
        {b.payment && (
          <div className="small text-secondary mt-2">
            {b.payment.method.replace('_', ' ')} · Txn {b.payment.transaction_ref}
            {b.payment.refund_amount > 0 && <span className="text-warning"> · Refunded {money(b.payment.refund_amount)}</span>}
          </div>
        )}
        {b.status === 'CANCELLED' && (
          <div className="alert alert-secondary small mt-3 mb-0">Cancelled on {fmtDateTime(b.cancelled_at)}{b.cancellation_reason ? ` – ${b.cancellation_reason}` : ''}</div>
        )}
      </div>

      <div className="d-flex flex-wrap gap-2 mt-4 no-print">
        <button type="button" className="btn btn-outline-light" onClick={() => window.print()}><i className="bi bi-printer me-2" />Print ticket</button>
        <Link to="/bookings" className="btn btn-outline-light"><i className="bi bi-ticket-perforated me-2" />My bookings</Link>
        {b.status === 'CONFIRMED' && (
          <button type="button" className="btn btn-outline-danger ms-md-auto" onClick={() => setCancelling(b)}><i className="bi bi-x-circle me-2" />Cancel booking</button>
        )}
      </div>
      {b.cancellation && b.status === 'CONFIRMED' && (
        <p className="small text-secondary mt-2 no-print">{b.cancellation.cancellable ? `Cancellation policy: ${b.cancellation.reason}.` : b.cancellation.reason}</p>
      )}

      <CancelBookingDialog booking={cancelling} onClose={() => setCancelling(null)} onDone={setB} />
    </div>
  );
}
