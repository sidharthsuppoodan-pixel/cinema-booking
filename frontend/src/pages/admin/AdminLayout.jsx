import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const LINKS = [
  { to: '/admin', label: 'Dashboard', icon: 'speedometer2', end: true },
  { to: '/admin/movies', label: 'Movies', icon: 'film' },
  { to: '/admin/theatres', label: 'Theatres', icon: 'building' },
  { to: '/admin/screens', label: 'Screens & Seats', icon: 'display' },
  { to: '/admin/showtimes', label: 'Showtimes', icon: 'calendar-week' },
  { to: '/admin/bookings', label: 'Bookings', icon: 'ticket-perforated' },
  { to: '/admin/customers', label: 'Customers', icon: 'people' },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
        <div className="small text-secondary text-uppercase px-3 mb-2 mt-1">Administration</div>
        <nav className="nav flex-column">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="nav-link">
              <i className={`bi bi-${l.icon}`} /> {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-user small text-secondary px-3">
          Signed in as<br /><span className="text-white">{user.full_name}</span>
        </div>
      </aside>
      {open && <div className="admin-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <main className="admin-main">
        <button type="button" className="btn btn-outline-light btn-sm d-lg-none mb-3" onClick={() => setOpen(true)}>
          <i className="bi bi-layout-sidebar" /> Admin menu
        </button>
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
      <div>
        <h1 className="h3 mb-0">{title}</h1>
        {subtitle && <p className="text-secondary mb-0 small">{subtitle}</p>}
      </div>
      {children && <div className="d-flex gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
