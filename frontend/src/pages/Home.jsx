import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import MovieCard from '../components/MovieCard';
import { EmptyState, ErrorAlert, Loader, Poster, TrailerModal } from '../components/common';
import { duration } from '../utils/format';

export default function Home() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('All');
  const [language, setLanguage] = useState('All');
  const [featured, setFeatured] = useState(0);
  const [trailer, setTrailer] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    api.get('/movies')
      .then((r) => setMovies(r.data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const top = useMemo(() => [...movies].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4), [movies]);
  useEffect(() => {
    if (top.length < 2) return undefined;
    const t = setInterval(() => setFeatured((f) => (f + 1) % top.length), 7000);
    return () => clearInterval(t);
  }, [top.length]);

  const genres = useMemo(
    () => ['All', ...new Set(movies.flatMap((m) => m.genre.split(',').map((g) => g.trim())).filter(Boolean))].slice(0, 12),
    [movies],
  );
  const languages = useMemo(() => ['All', ...new Set(movies.map((m) => m.language))], [movies]);

  const filtered = movies.filter((m) => {
    const text = `${m.title} ${m.cast_members || ''} ${m.director || ''}`.toLowerCase();
    return (!q || text.includes(q.toLowerCase()))
      && (genre === 'All' || m.genre.toLowerCase().includes(genre.toLowerCase()))
      && (language === 'All' || m.language === language);
  });

  const hero = top[featured];

  return (
    <>
      {hero ? (
        <section className="hero" style={{ '--hero-bg': hero.poster_url ? `url("${hero.poster_url}")` : 'none' }}>
          <div className="hero-backdrop" />
          <div className="container position-relative py-5">
            <div className="row align-items-center g-4">
              <div className="col-lg-7 order-2 order-lg-1">
                <span className="badge text-bg-danger mb-3 px-3 py-2"><i className="bi bi-fire me-1" />Now Showing</span>
                <h1 className="display-title">{hero.title}</h1>
                <div className="hero-meta mb-3">
                  {hero.rating != null && <span><i className="bi bi-star-fill text-warning" /> {Number(hero.rating).toFixed(1)}/10</span>}
                  {hero.certificate && <span className="cert">{hero.certificate}</span>}
                  <span>{duration(hero.duration_minutes)}</span>
                  <span>{hero.genre}</span>
                  <span>{hero.language}</span>
                </div>
                <p className="lead text-light-emphasis hero-desc">{hero.description}</p>
                <div className="d-flex gap-2 flex-wrap">
                  <Link to={`/movies/${hero.id}`} className="btn btn-danger btn-lg"><i className="bi bi-ticket-perforated me-2" />Book Tickets</Link>
                  {hero.trailer_url && (
                    <button type="button" className="btn btn-outline-light btn-lg" onClick={() => setTrailer(hero)}>
                      <i className="bi bi-play-circle me-2" />Watch Trailer
                    </button>
                  )}
                </div>
                <div className="hero-dots mt-4">
                  {top.map((m, i) => (
                    <button key={m.id} type="button" aria-label={`Show ${m.title}`} className={i === featured ? 'active' : ''} onClick={() => setFeatured(i)} />
                  ))}
                </div>
              </div>
              <div className="col-lg-5 order-1 order-lg-2 text-center">
                <div className="hero-poster"><Poster src={hero.poster_url} title={hero.title} /></div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="container py-5" id="now-showing">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3 mb-3">
          <div>
            <h2 className="section-title mb-1">Now Showing</h2>
            <p className="text-secondary mb-0">Pick a movie to see showtimes near you</p>
          </div>
          <div className="search-box">
            <i className="bi bi-search" />
            <input type="search" className="form-control" placeholder="Search movies, cast, director…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search movies" />
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 mb-2">
          {genres.map((g) => (
            <button key={g} type="button" className={`chip ${genre === g ? 'active' : ''}`} onClick={() => setGenre(g)}>{g}</button>
          ))}
        </div>
        {languages.length > 2 && (
          <div className="d-flex flex-wrap gap-2 mb-4 align-items-center">
            <small className="text-secondary me-1"><i className="bi bi-translate" /> Language:</small>
            {languages.map((l) => (
              <button key={l} type="button" className={`chip chip-sm ${language === l ? 'active' : ''}`} onClick={() => setLanguage(l)}>{l}</button>
            ))}
          </div>
        )}

        <ErrorAlert message={error} onRetry={load} />
        {loading ? <Loader label="Loading movies…" /> : filtered.length === 0 ? (
          <EmptyState icon="camera-reels" title="No movies match your filters">Try a different search or genre.</EmptyState>
        ) : (
          <div className="movie-grid">
            {filtered.map((m) => <MovieCard key={m.id} movie={m} />)}
          </div>
        )}
      </section>

      <section className="container pb-5">
        <div className="promo-band">
          <div>
            <h3 className="mb-1">Find a theatre near you</h3>
            <p className="mb-0 text-light-emphasis">IMAX, 4DX, 3D and recliner seating across the city.</p>
          </div>
          <Link to="/theatres" className="btn btn-light">Browse theatres <i className="bi bi-arrow-right" /></Link>
        </div>
      </section>

      {trailer && <TrailerModal show url={trailer.trailer_url} title={trailer.title} onClose={() => setTrailer(null)} />}
    </>
  );
}
