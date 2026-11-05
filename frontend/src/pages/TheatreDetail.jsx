import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import ShowtimeGroups from '../components/ShowtimeGroups';
import { DateStrip, EmptyState, ErrorAlert, Loader } from '../components/common';
import { nextDays } from '../utils/format';

export default function TheatreDetail() {
  const { id } = useParams();
  const days = useMemo(() => nextDays(7), []);
  const [day, setDay] = useState(days[0].key);
  const [theatre, setTheatre] = useState(null);
  const [shows, setShows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/theatres/${id}`).then((r) => setTheatre(r.data)).catch((e) => setError(errorMessage(e, 'Theatre not found')));
  }, [id]);

  useEffect(() => {
    const d = days.find((x) => x.key === day);
    setLoading(true);
    api.get('/showtimes', { params: { theatre_id: id, start_from: d.from, start_to: d.to } })
      .then((r) => setShows(r.data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [id, day, days]);

  if (!theatre) return <div className="container py-5">{error ? <ErrorAlert message={error} /> : <Loader />}</div>;

  return (
    <div className="container py-5">
      <div className="theatre-header mb-4">
        <h1 className="display-title mb-1">{theatre.name}</h1>
        <p className="text-secondary mb-2"><i className="bi bi-geo-alt" /> {theatre.address}, {theatre.city}{theatre.state ? `, ${theatre.state}` : ''} {theatre.pincode}</p>
        {theatre.contact_phone && <p className="text-secondary mb-2"><i className="bi bi-telephone" /> {theatre.contact_phone}</p>}
        <div className="d-flex flex-wrap gap-2">
          {theatre.screens.map((s) => <span className="chip static" key={s.id}><i className="bi bi-display" /> {s.name} · {s.screen_type} · {s.capacity} seats</span>)}
        </div>
      </div>
      <DateStrip days={days} value={day} onChange={setDay} />
      <div className="mt-4">
        {loading ? <Loader /> : shows.length === 0 ? (
          <EmptyState icon="calendar-x" title="No shows scheduled on this day" />
        ) : <ShowtimeGroups showtimes={shows} groupBy="movie" />}
      </div>
    </div>
  );
}
