import { Link } from 'react-router-dom';
import { Brand } from './Navbar';

export default function Footer() {
  return (
    <footer className="cb-footer mt-auto">
      <div className="container py-4">
        <div className="row g-4">
          <div className="col-md-5">
            <Brand />
            <p className="text-secondary small mt-2 mb-0">
              Book movie tickets in seconds. Pick your theatre, choose the perfect seat, and enjoy the show.
            </p>
          </div>
          <div className="col-6 col-md-3">
            <h6 className="text-uppercase small text-secondary">Explore</h6>
            <ul className="list-unstyled small">
              <li><Link to="/">Now Showing</Link></li>
              <li><Link to="/theatres">Theatres</Link></li>
              <li><Link to="/bookings">My Bookings</Link></li>
            </ul>
          </div>
          <div className="col-6 col-md-4">
            <h6 className="text-uppercase small text-secondary">Cancellation policy</h6>
            <p className="small text-secondary mb-0">
              Full ticket refund 24h+ before the show, 50% between 24h and 2h. Online cancellation closes 2 hours
              before showtime. Convenience fee is non-refundable.
            </p>
          </div>
        </div>
        <hr className="border-secondary" />
        <p className="small text-secondary mb-0">© {new Date().getFullYear()} CINEBOOK. All rights reserved.</p>
      </div>
    </footer>
  );
}
