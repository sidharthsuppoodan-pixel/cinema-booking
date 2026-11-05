import { Link } from 'react-router-dom';
import { duration } from '../utils/format';
import { Poster } from './common';

export default function MovieCard({ movie }) {
  return (
    <Link to={`/movies/${movie.id}`} className="movie-card text-decoration-none">
      <div className="poster-wrap">
        <Poster src={movie.poster_url} title={movie.title} />
        {movie.rating != null && (
          <span className="rating-chip"><i className="bi bi-star-fill" /> {Number(movie.rating).toFixed(1)}</span>
        )}
        <div className="poster-overlay">
          <span className="btn btn-danger btn-sm"><i className="bi bi-ticket-perforated me-1" />Book tickets</span>
        </div>
      </div>
      <div className="pt-2">
        <h6 className="movie-title mb-1 text-truncate" title={movie.title}>{movie.title}</h6>
        <div className="small text-secondary text-truncate">
          {movie.certificate && <span className="cert me-1">{movie.certificate}</span>}
          {movie.genre} · {duration(movie.duration_minutes)}
        </div>
        <div className="small text-secondary">{movie.language}</div>
      </div>
    </Link>
  );
}
