import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import CancelBookingDialog from '../components/CancelBookingDialog';
import { EmptyState, ErrorAlert, Loader, Poster, StatusBadge } from '../components/common';
import { fmtDate, fmtTime, money } from '../utils/format';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('upcoming');
  const [cancelling, setCancelling] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/bookings/me')
      .then((r) => setBookings(r.data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const now = new Date();
  const groups = {
    upcoming: bookings.filter((b) => b.status !== 'CANCELLED' && new Date(b.start_time) > now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
    past: bookings.filter((b) => b.status !== 'CANCELLED' && new Date(b.start_time) <= now),
    cancelled: bookings.filter((b) => b.status === 'CANCELLED'),
  };
  const list = groups[tab];

  return (
    <div className="container py-5" style={{ maxWidth: 980 }}>
      <h1 className="section-title">My Bookings</h1>
      <ul className="nav cb-tabs mb-4">
        {TABS.map((t) => (
          <li className="nav-item" key={t.key}>
            <button type="button" className={`nav-link ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label} <span className="badge text-bg-dark ms-1">{groups[t.key].length}</span>
            </button>
          </li>
        ))}
      </ul>
      <ErrorAlert message={error} onRetry={load} />
      {loading ? <Loader /> : list.length === 0 ? (
        <EmptyState icon="ticket-perforated" title={`No ${tab} bookings`}>
          {tab === 'upcoming' && <Link to="/" className="btn btn-danger mt-3">Browse movies</Link>}
        </EmptyState>
      ) : (
        <div className="d-flex flex-column gap-3">
          {list.map((b) => (
            <div className="booking-row" key={b.id}>
              <div className="booking-row-poster"><Poster src={b.movie_poster_url} title={b.movie_title} /></div>
              <div className="flex-grow-1 min-w-0">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                  <h5 className="mb-0 text-truncate">{b.movie_title}</h5>
                  <StatusBadge status={b.status} />
                </div>
                <div className="small text-secondary">{b.theatre_name}, {b.theatre_city} · {b.screen_name}</div>
                <div className="small"><i className="bi bi-calendar3" /> {fmtDate(b.start_time)} · {fmtTime(b.start_time)}</div>
                <div className="small"><i className="bi bi-grid-3x3-gap" /> {b.seats.map((s) => s.seat_label).join(', ')}</div>
                <div className="small text-secondary mt-1">
                  ID <span className="font-monospace text-white">{b.booking_code}</span> · {money(b.total_amount)}
                  {b.payment?.refund_amount > 0 && <span className="text-warning"> · refunded {money(b.payment.refund_amount)}</span>}
                </div>
              </div>
              <div className="d-flex flex-md-column gap-2 booking-row-actions">
                <Link to={`/bookings/${b.booking_code}`} className="btn btn-sm btn-outline-light">View ticket</Link>
                {b.status === 'CONFIRMED' && new Date(b.start_time) > now && (
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setCancelling(b)}
                    disabled={!b.cancellation?.cancellable} title={b.cancellation?.reason}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <CancelBookingDialog booking={cancelling} onClose={() => setCancelling(null)} onDone={load} />
    </div>
  );
}
