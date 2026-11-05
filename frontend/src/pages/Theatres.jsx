import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import { EmptyState, ErrorAlert, Loader } from '../components/common';

export default function Theatres() {
  const [theatres, setTheatres] = useState([]);
  const [cities, setCities] = useState([]);
  const [city, setCity] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/theatres/cities').then((r) => setCities(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      api.get('/theatres', { params: { city: city || undefined, q: q || undefined } })
        .then((r) => setTheatres(r.data))
        .catch((e) => setError(errorMessage(e)))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [city, q]);

  return (
    <div className="container py-5">
      <h1 className="section-title">Cinemas</h1>
      <p className="text-secondary">Choose a theatre to see what&apos;s playing.</p>
      <div className="row g-2 mb-4">
        <div className="col-md-8">
          <div className="search-box w-100">
            <i className="bi bi-search" />
            <input className="form-control" type="search" placeholder="Search by name or area" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search theatres" />
          </div>
        </div>
        <div className="col-md-4">
          <select className="form-select" value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
            <option value="">All cities</option>
            {cities.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <ErrorAlert message={error} />
      {loading ? <Loader /> : theatres.length === 0 ? <EmptyState icon="building" title="No theatres found" /> : (
        <div className="row g-3">
          {theatres.map((t) => (
            <div className="col-md-6 col-xl-4" key={t.id}>
              <Link to={`/theatres/${t.id}`} className="theatre-card h-100 text-decoration-none">
                <div className="d-flex align-items-start gap-3">
                  <div className="theatre-icon"><i className="bi bi-building" /></div>
                  <div className="flex-grow-1 min-w-0">
                    <h5 className="mb-1 text-white">{t.name}</h5>
                    <div className="small text-secondary"><i className="bi bi-geo-alt" /> {t.address}, {t.city}</div>
                    <div className="small text-secondary mt-1"><i className="bi bi-display" /> {t.screen_count} screen{t.screen_count === 1 ? '' : 's'}</div>
                    {t.amenities && (
                      <div className="d-flex flex-wrap gap-1 mt-2">
                        {t.amenities.split(',').map((a) => <span className="chip chip-sm static" key={a}>{a.trim()}</span>)}
                      </div>
                    )}
                  </div>
                  <i className="bi bi-chevron-right text-secondary" />
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
