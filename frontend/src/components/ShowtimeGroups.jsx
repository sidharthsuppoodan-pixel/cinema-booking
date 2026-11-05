import { Link } from 'react-router-dom';
import { fmtTime, money } from '../utils/format';

/** Showtimes grouped under a heading (theatre or movie), rendered as time pills. */
export default function ShowtimeGroups({ showtimes, groupBy = 'theatre' }) {
  const groups = new Map();
  showtimes.forEach((s) => {
    const key = groupBy === 'theatre' ? s.theatre_id : s.movie_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  });

  return (
    <div className="d-flex flex-column gap-3">
      {[...groups.values()].map((list) => {
        const first = list[0];
        return (
          <div className="showtime-group" key={groupBy === 'theatre' ? first.theatre_id : first.movie_id}>
            <div className="mb-2">
              {groupBy === 'theatre' ? (
                <>
                  <Link to={`/theatres/${first.theatre_id}`} className="fw-semibold text-white">{first.theatre_name}</Link>
                  <div className="small text-secondary"><i className="bi bi-geo-alt" /> {first.theatre_city}</div>
                </>
              ) : (
                <>
                  <Link to={`/movies/${first.movie_id}`} className="fw-semibold text-white">{first.movie_title}</Link>
                  <div className="small text-secondary">{first.movie_certificate} · {first.language}</div>
                </>
              )}
            </div>
            <div className="d-flex flex-wrap gap-2">
              {list.map((s) => {
                const ratio = s.capacity ? s.available_count / s.capacity : 0;
                const level = s.available_count === 0 ? 'full' : ratio < 0.25 ? 'low' : 'ok';
                const label = `${fmtTime(s.start_time)} · ${s.screen_name} (${s.screen_type}) · from ${money(Math.min(s.price_standard, s.price_premium, s.price_recliner))} · ${s.available_count} seats left`;
                return level === 'full' ? (
                  <span key={s.id} className="time-pill full" title="Housefull">{fmtTime(s.start_time)}<small>Housefull</small></span>
                ) : (
                  <Link key={s.id} to={`/showtimes/${s.id}/seats`} className={`time-pill ${level}`} title={label} aria-label={label}>
                    {fmtTime(s.start_time)}
                    <small>{s.screen_type} · {s.screen_name}</small>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
