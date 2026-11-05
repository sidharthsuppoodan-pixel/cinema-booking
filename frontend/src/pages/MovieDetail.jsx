import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import ShowtimeGroups from '../components/ShowtimeGroups';
import { DateStrip, EmptyState, ErrorAlert, Loader, Poster, TrailerModal } from '../components/common';
import { duration, fmtDate, nextDays } from '../utils/format';

export default function MovieDetail() {
  const { id } = useParams();
  const days = useMemo(() => nextDays(7), []);
  const [day, setDay] = useState(days[0].key);
  const [movie, setMovie] = useState(null);
  const [shows, setShows] = useState([]);
  const [cities, setCities] = useState([]);
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [showsLoading, setShowsLoading] = useState(false);
  const [error, setError] = useState('');
  const [trailer, setTrailer] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get(`/movies/${id}`), api.get('/theatres/cities')])
      .then(([m, c]) => { setMovie(m.data); setCities(c.data); })
      .catch((e) => setError(errorMessage(e, 'Movie not found')))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const d = days.find((x) => x.key === day);
    setShowsLoading(true);
    api.get('/showtimes', { params: { movie_id: id, start_from: d.from, start_to: d.to, city: city || undefined } })
      .then((r) => setShows(r.data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setShowsLoading(false));
  }, [id, day, city, days]);

  if (loading) return <Loader full />;
  if (!movie) return <div className="container py-5"><ErrorAlert message={error || 'Movie not found'} /></div>;

  return (
    <>
      <section className="movie-hero" style={{ '--hero-bg': movie.poster_url ? `url("${movie.poster_url}")` : 'none' }}>
        <div className="hero-backdrop" />
        <div className="container position-relative py-5">
          <div className="row g-4 align-items-center">
            <div className="col-8 col-sm-5 col-md-4 col-lg-3 mx-auto mx-md-0">
              <div className="detail-poster"><Poster src={movie.poster_url} title={movie.title} /></div>
            </div>
            <div className="col-md-8 col-lg-9">
              <h1 className="display-title mb-2">{movie.title}</h1>
              <div className="hero-meta mb-3">
                {movie.rating != null && <span className="rating-big"><i className="bi bi-star-fill text-warning" /> {Number(movie.rating).toFixed(1)}/10</span>}
                {movie.certificate && <span className="cert">{movie.certificate}</span>}
                <span><i className="bi bi-clock" /> {duration(movie.duration_minutes)}</span>
                <span><i className="bi bi-translate" /> {movie.language}</span>
                {movie.release_date && <span><i className="bi bi-calendar-event" /> {fmtDate(movie.release_date, { weekday: undefined })}</span>}
              </div>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {movie.genre.split(',').map((g) => <span key={g} className="chip static">{g.trim()}</span>)}
              </div>
              <p className="lead text-light-emphasis">{movie.description}</p>
              {movie.director && <p className="mb-1"><span className="text-secondary">Director:</span> {movie.director}</p>}
              {movie.cast_members && <p><span className="text-secondary">Cast:</span> {movie.cast_members}</p>}
              <div className="d-flex gap-2 flex-wrap">
                <a href="#showtimes" className="btn btn-danger btn-lg"><i className="bi bi-ticket-perforated me-2" />Book Tickets</a>
                {movie.trailer_url && (
                  <button type="button" className="btn btn-outline-light btn-lg" onClick={() => setTrailer(true)}>
                    <i className="bi bi-play-circle me-2" />Watch Trailer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-5" id="showtimes">
        <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-3">
          <h2 className="section-title mb-0">Showtimes</h2>
          <select className="form-select w-auto" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city">
            <option value="">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <DateStrip days={days} value={day} onChange={setDay} />
        <div className="legend small text-secondary my-3">
          <span><i className="dot ok" />Available</span>
          <span><i className="dot low" />Filling fast</span>
          <span><i className="dot full" />Housefull</span>
        </div>
        <ErrorAlert message={error} />
        {showsLoading ? <Loader label="Finding showtimes…" /> : shows.length === 0 ? (
          <EmptyState icon="calendar-x" title="No showtimes on this day">Try another date or city.</EmptyState>
        ) : <ShowtimeGroups showtimes={shows} groupBy="theatre" />}
      </section>

      {movie.trailer_url && <TrailerModal show={trailer} url={movie.trailer_url} title={movie.title} onClose={() => setTrailer(false)} />}
    </>
  );
}
