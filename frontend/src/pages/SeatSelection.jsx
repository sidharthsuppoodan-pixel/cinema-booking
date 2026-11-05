import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import SeatGrid from '../components/SeatGrid';
import { ErrorAlert, Loader, Poster } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CATEGORY_LABEL, fmtDate, fmtTime, money } from '../utils/format';

const METHODS = [
  { value: 'UPI', label: 'UPI', icon: 'phone' },
  { value: 'CARD', label: 'Card', icon: 'credit-card' },
  { value: 'NET_BANKING', label: 'Net Banking', icon: 'bank' },
  { value: 'WALLET', label: 'Wallet', icon: 'wallet2' },
];

export default function SeatSelection() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const notify = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [map, setMap] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [method, setMethod] = useState('UPI');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const load = useCallback((silent = false) => {
    api.get(`/showtimes/${id}/seats`)
      .then((r) => {
        setMap(r.data);
        // Drop any selected seat that someone else just booked.
        const booked = new Set(r.data.rows.flatMap((row) => row.seats).filter((s) => s.status !== 'available').map((s) => s.id));
        const lost = [...selectedRef.current].filter((sid) => booked.has(sid));
        if (lost.length) {
          setSelected((prev) => new Set([...prev].filter((sid) => !booked.has(sid))));
          notify('Some seats you picked were just booked by someone else.', 'warning');
        }
      })
      .catch((e) => !silent && setError(errorMessage(e, 'Showtime not found')));
  }, [id, notify]);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 20000); // live availability refresh
    return () => clearInterval(t);
  }, [load]);

  const seatIndex = useMemo(() => {
    const m = new Map();
    map?.rows.forEach((r) => r.seats.forEach((s) => m.set(s.id, s)));
    return m;
  }, [map]);

  if (!map) return <div className="container py-5">{error ? <ErrorAlert message={error} /> : <Loader label="Loading seat layout…" />}</div>;

  const show = map.showtime;
  const started = new Date(show.start_time) <= new Date();
  const picks = [...selected].map((sid) => seatIndex.get(sid)).filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const byCat = picks.reduce((acc, s) => {
    acc[s.category] = acc[s.category] || { count: 0, price: s.price };
    acc[s.category].count += 1;
    return acc;
  }, {});
  const subtotal = picks.reduce((a, s) => a + s.price, 0);
  const fee = picks.length * map.convenience_fee_per_ticket;
  const total = subtotal + fee;

  const toggle = (seat) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else if (next.size >= map.max_seats_per_booking) {
        notify(`You can select up to ${map.max_seats_per_booking} seats per booking.`, 'warning');
        return prev;
      } else next.add(seat.id);
      return next;
    });
  };

  const book = async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const r = await api.post('/bookings', { showtime_id: show.id, seat_ids: [...selected], payment_method: method });
      notify(`Booking confirmed! ID ${r.data.booking_code}`);
      navigate(`/bookings/${r.data.booking_code}`, { state: { justBooked: true } });
    } catch (e) {
      setError(errorMessage(e));
      if (e.response?.status === 409) { setSelected(new Set()); load(true); }
    } finally {
      setSubmitting(false);
    }
  };

  const prices = { STANDARD: show.price_standard, PREMIUM: show.price_premium, RECLINER: show.price_recliner };

  return (
    <div className="container py-4">
      <div className="booking-header mb-4">
        <div className="booking-header-poster d-none d-sm-block"><Poster src={show.movie_poster_url} title={show.movie_title} /></div>
        <div className="min-w-0">
          <Link to={`/movies/${show.movie_id}`} className="small text-secondary"><i className="bi bi-arrow-left" /> Back to showtimes</Link>
          <h1 className="h3 mb-1 mt-1">{show.movie_title} {show.movie_certificate && <span className="cert align-middle">{show.movie_certificate}</span>}</h1>
          <div className="text-secondary small">
            <i className="bi bi-building" /> {show.theatre_name}, {show.theatre_city} · {show.screen_name} ({show.screen_type}) · {show.language}
          </div>
          <div className="small"><i className="bi bi-calendar3" /> {fmtDate(show.start_time)} · <i className="bi bi-clock" /> {fmtTime(show.start_time)}</div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="panel">
            {started && <div className="alert alert-warning">This show has already started. Booking is closed.</div>}
            <SeatGrid rows={map.rows} seatsPerRow={map.seats_per_row} selected={selected} onSeatClick={started ? null : toggle} prices={prices} />
          </div>
        </div>
        <div className="col-lg-4">
          <div className="panel summary-panel">
            <h5 className="mb-3"><i className="bi bi-receipt me-2 text-danger" />Booking summary</h5>
            {picks.length === 0 ? (
              <p className="text-secondary small mb-0">Tap on available seats to select them. Up to {map.max_seats_per_booking} seats per booking.</p>
            ) : (
              <>
                <div className="d-flex flex-wrap gap-1 mb-3">
                  {picks.map((s) => (
                    <button key={s.id} type="button" className="seat-tag" onClick={() => toggle(s)} title="Remove seat">
                      {s.label} <i className="bi bi-x" />
                    </button>
                  ))}
                </div>
                {Object.entries(byCat).map(([cat, v]) => (
                  <div className="d-flex justify-content-between small mb-1" key={cat}>
                    <span>{CATEGORY_LABEL[cat]} × {v.count} <span className="text-secondary">({money(v.price)} each)</span></span>
                    <span>{money(v.price * v.count)}</span>
                  </div>
                ))}
                <div className="d-flex justify-content-between small mb-1 text-secondary">
                  <span>Convenience fee ({money(map.convenience_fee_per_ticket)} × {picks.length})</span><span>{money(fee)}</span>
                </div>
                <hr />
                <div className="d-flex justify-content-between fw-bold fs-5 mb-3"><span>Total</span><span>{money(total)}</span></div>

                <div className="mb-3">
                  <div className="small text-secondary mb-2">Payment method</div>
                  <div className="pay-methods">
                    {METHODS.map((m) => (
                      <label key={m.value} className={`pay-method ${method === m.value ? 'active' : ''}`}>
                        <input type="radio" name="method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} className="visually-hidden" />
                        <i className={`bi bi-${m.icon}`} /> {m.label}
                      </label>
                    ))}
                  </div>
                  <div className="form-text">Demo checkout: payment is simulated, no card or bank details are collected.</div>
                </div>
              </>
            )}
            <ErrorAlert message={error} />
            {isAdmin ? (
              <div className="alert alert-info small mb-0">You are logged in as an administrator. Use a customer account to book tickets.</div>
            ) : (
              <button type="button" className="btn btn-danger w-100 btn-lg" disabled={picks.length === 0 || submitting || started} onClick={book}>
                {submitting && <span className="spinner-border spinner-border-sm me-2" />}
                {user ? `Pay ${money(total)} & Book` : 'Log in to book'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
