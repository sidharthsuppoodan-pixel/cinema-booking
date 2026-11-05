import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../../api/client';
import { ErrorAlert, Loader, StatusBadge } from '../../components/common';
import { fmtDateTime, money } from '../../utils/format';
import { PageHeader } from './AdminLayout';

function StatCard({ icon, label, value, sub, to, tone = 'red' }) {
  const body = (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-icon"><i className={`bi bi-${icon}`} /></div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="text-decoration-none">{body}</Link> : body;
}

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const load = () => api.get('/admin/stats').then((r) => setS(r.data)).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []);

  if (!s) return error ? <ErrorAlert message={error} onRetry={load} /> : <Loader />;
  const maxRev = Math.max(1, ...s.daily.map((d) => d.revenue));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your cinema business">
        <button type="button" className="btn btn-outline-light btn-sm" onClick={load}><i className="bi bi-arrow-clockwise" /> Refresh</button>
      </PageHeader>

      <div className="stat-grid mb-4">
        <StatCard icon="film" label="Total movies" value={s.total_movies} sub={`${s.active_movies} now showing`} to="/admin/movies" />
        <StatCard icon="building" label="Theatres" value={s.total_theatres} sub={`${s.total_screens} screens`} to="/admin/theatres" tone="white" />
        <StatCard icon="ticket-perforated" label="Bookings" value={s.total_bookings} sub={`${s.confirmed_bookings} confirmed · ${s.cancelled_bookings} cancelled`} to="/admin/bookings" />
        <StatCard icon="people" label="Customers" value={s.total_customers} sub="registered accounts" to="/admin/customers" tone="white" />
        <StatCard icon="cash-stack" label="Net revenue" value={money(s.net_revenue)} sub={`${money(s.gross_revenue)} gross · ${money(s.refunds)} refunded`} tone="green" />
        <StatCard icon="calendar-week" label="Upcoming shows" value={s.upcoming_showtimes} sub={`${s.tickets_sold} tickets sold`} to="/admin/showtimes" tone="white" />
      </div>

      <div className="row g-4">
        <div className="col-xl-7">
          <div className="panel h-100">
            <h5 className="mb-3">Revenue – last 7 days</h5>
            <div className="bar-chart" role="img" aria-label="Revenue per day for the last seven days">
              {s.daily.map((d) => (
                <div className="bar-col" key={d.date} title={`${d.date}: ${money(d.revenue)} from ${d.bookings} bookings`}>
                  <div className="bar-value">{d.revenue ? money(d.revenue).replace('.00', '') : ''}</div>
                  <div className="bar" style={{ height: `${Math.max(2, (d.revenue / maxRev) * 100)}%` }} />
                  <div className="bar-label">{new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-xl-5">
          <div className="panel h-100">
            <h5 className="mb-3">Top movies by tickets</h5>
            {s.top_movies.length === 0 ? <p className="text-secondary small">No bookings yet.</p> : (
              <ol className="list-unstyled mb-0 top-list">
                {s.top_movies.map((m, i) => (
                  <li key={m.movie_id}>
                    <span className="rank">{i + 1}</span>
                    <span className="flex-grow-1 text-truncate">{m.title}</span>
                    <span className="text-secondary small">{m.tickets} tickets</span>
                    <span className="fw-semibold ms-2">{money(m.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        <div className="col-12">
          <div className="panel">
            <div className="d-flex justify-content-between mb-3">
              <h5 className="mb-0">Recent bookings</h5>
              <Link to="/admin/bookings" className="small">View all</Link>
            </div>
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0 cb-table">
                <thead><tr><th>Booking ID</th><th>Customer</th><th>Movie</th><th>Show</th><th>Seats</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {s.recent_bookings.length === 0 && <tr><td colSpan={7} className="text-secondary text-center py-4">No bookings yet</td></tr>}
                  {s.recent_bookings.map((b) => (
                    <tr key={b.id}>
                      <td><Link to={`/admin/bookings?q=${b.booking_code}`} className="font-monospace">{b.booking_code}</Link></td>
                      <td>{b.customer_name}<div className="small text-secondary">{b.customer_email}</div></td>
                      <td>{b.movie_title}</td>
                      <td className="small">{fmtDateTime(b.start_time)}<div className="text-secondary">{b.theatre_name}</div></td>
                      <td className="small">{b.seats.map((x) => x.seat_label).join(', ')}</td>
                      <td>{money(b.total_amount)}</td>
                      <td><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
