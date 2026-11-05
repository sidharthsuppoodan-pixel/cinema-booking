import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { STATUS_VARIANT, trailerEmbed } from '../utils/format';

export function Loader({ label = 'Loading…', full = false }) {
  return (
    <div className={`d-flex flex-column align-items-center justify-content-center text-secondary ${full ? 'py-6' : 'py-5'}`}>
      <div className="spinner-border text-danger mb-3" role="status" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon = 'film', title, children }) {
  return (
    <div className="empty-state text-center py-5">
      <i className={`bi bi-${icon} display-4 text-danger opacity-75`} />
      <h5 className="mt-3">{title}</h5>
      {children && <div className="text-secondary">{children}</div>}
    </div>
  );
}

export function ErrorAlert({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert alert-danger d-flex align-items-center gap-2" role="alert">
      <i className="bi bi-exclamation-triangle-fill" />
      <div className="flex-grow-1">{message}</div>
      {onRetry && <button type="button" className="btn btn-sm btn-outline-light" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`badge rounded-pill text-bg-${STATUS_VARIANT[status] || 'secondary'}`}>{status.replace('_', ' ')}</span>;
}

export function Poster({ src, title, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`poster poster-fallback ${className}`} aria-label={title}>
        <i className="bi bi-film" />
        <span>{title}</span>
      </div>
    );
  }
  return <img className={`poster ${className}`} src={src} alt={`${title} poster`} loading="lazy" onError={() => setFailed(true)} />;
}

export function Modal({ show, title, onClose, children, footer, size = '', scrollable = true }) {
  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [show, onClose]);
  if (!show) return null;
  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
        <div className={`modal-dialog modal-dialog-centered ${scrollable ? 'modal-dialog-scrollable' : ''} ${size ? `modal-${size}` : ''}`}>
          <div className="modal-content cb-modal">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

export function ConfirmDialog({ show, title = 'Are you sure?', message, confirmLabel = 'Confirm', variant = 'danger', busy, confirmDisabled, onConfirm, onClose, children }) {
  return (
    <Modal
      show={show}
      title={title}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline-light" onClick={onClose} disabled={busy}>Close</button>
          <button type="button" className={`btn btn-${variant}`} onClick={onConfirm} disabled={busy || confirmDisabled}>
            {busy && <span className="spinner-border spinner-border-sm me-2" />}
            {confirmLabel}
          </button>
        </>
      )}
    >
      {message && <p className="mb-2">{message}</p>}
      {children}
    </Modal>
  );
}

export function TrailerModal({ url, title, show, onClose }) {
  const embed = trailerEmbed(url);
  return (
    <Modal show={show} title={`${title} – Trailer`} onClose={onClose} size="lg" scrollable={false}>
      {embed ? (
        <div className="ratio ratio-16x9 rounded overflow-hidden">
          <iframe src={embed} title={`${title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <p className="mb-0">
          This trailer can&apos;t be embedded. <a href={url} target="_blank" rel="noreferrer noopener">Open it in a new tab</a>.
        </p>
      )}
    </Modal>
  );
}

export function RequireAuth({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return children;
}

export function DateStrip({ days, value, onChange }) {
  return (
    <div className="date-strip" role="tablist" aria-label="Select date">
      {days.map((d) => (
        <button
          key={d.key}
          type="button"
          role="tab"
          aria-selected={value === d.key}
          className={`date-pill ${value === d.key ? 'active' : ''}`}
          onClick={() => onChange(d.key)}
        >
          <small>{d.dow}</small>
          <strong>{d.day}</strong>
          <small>{d.month}</small>
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
      <small className="text-secondary">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </small>
      <div className="btn-group">
        <button type="button" className="btn btn-sm btn-outline-light" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <i className="bi bi-chevron-left" /> Prev
        </button>
        <span className="btn btn-sm btn-outline-light disabled">{page} / {pages}</span>
        <button type="button" className="btn btn-sm btn-outline-light" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next <i className="bi bi-chevron-right" />
        </button>
      </div>
    </nav>
  );
}
