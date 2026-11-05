import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Brand() {
  return (
    <span className="brand">
      <i className="bi bi-film" /><span className="brand-word">CINE<span>BOOK</span></span>
    </span>
  );
}

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  useEffect(() => { setOpen(false); setMenu(false); }, [location.pathname]);
  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const doLogout = () => { logout(); navigate('/'); };

  return (
    <nav className="navbar navbar-expand-lg cb-navbar sticky-top">
      <div className="container">
        <Link className="navbar-brand" to="/"><Brand /></Link>
        <button className="navbar-toggler border-0" type="button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>
          <i className={`bi ${open ? 'bi-x-lg' : 'bi-list'} fs-3 text-white`} />
        </button>
        <div className={`collapse navbar-collapse ${open ? 'show' : ''}`}>
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item"><NavLink className="nav-link" to="/" end>Movies</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/theatres">Theatres</NavLink></li>
            {user && !isAdmin && <li className="nav-item"><NavLink className="nav-link" to="/bookings">My Bookings</NavLink></li>}
            {isAdmin && <li className="nav-item"><NavLink className="nav-link" to="/admin">Admin Dashboard</NavLink></li>}
          </ul>
          <div className="d-flex align-items-lg-center gap-2 flex-column flex-lg-row">
            {user ? (
              <div className="position-relative" ref={menuRef}>
                <button type="button" className="btn btn-dark user-chip" onClick={() => setMenu(!menu)} aria-expanded={menu}>
                  <span className="avatar">{user.full_name.charAt(0).toUpperCase()}</span>
                  <span className="d-inline-block text-truncate" style={{ maxWidth: 140 }}>{user.full_name}</span>
                  <i className="bi bi-chevron-down small" />
                </button>
                {menu && (
                  <div className="dropdown-menu dropdown-menu-dark dropdown-menu-end show cb-dropdown">
                    <div className="px-3 py-2 small text-secondary">{user.email}</div>
                    <div className="dropdown-divider" />
                    {isAdmin && <Link className="dropdown-item" to="/admin"><i className="bi bi-speedometer2 me-2" />Dashboard</Link>}
                    {!isAdmin && <Link className="dropdown-item" to="/bookings"><i className="bi bi-ticket-perforated me-2" />My Bookings</Link>}
                    <Link className="dropdown-item" to="/profile"><i className="bi bi-person me-2" />Profile</Link>
                    <div className="dropdown-divider" />
                    <button type="button" className="dropdown-item text-danger" onClick={doLogout}><i className="bi bi-box-arrow-right me-2" />Log out</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link className="btn btn-outline-light" to="/login">Log in</Link>
                <Link className="btn btn-danger" to="/register">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
