import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import { RequireAuth } from './components/common';
import { Login, Register } from './pages/Auth';
import BookingConfirmation from './pages/BookingConfirmation';
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import SeatSelection from './pages/SeatSelection';
import TheatreDetail from './pages/TheatreDetail';
import Theatres from './pages/Theatres';
import AdminLayout from './pages/admin/AdminLayout';
import BookingsAdmin from './pages/admin/BookingsAdmin';
import CustomersAdmin from './pages/admin/CustomersAdmin';
import Dashboard from './pages/admin/Dashboard';
import MoviesAdmin from './pages/admin/MoviesAdmin';
import ScreensAdmin from './pages/admin/ScreensAdmin';
import ShowtimesAdmin from './pages/admin/ShowtimesAdmin';
import TheatresAdmin from './pages/admin/TheatresAdmin';

function NotFound() {
  return (
    <div className="container py-6 text-center">
      <div className="display-1 display-title text-danger">404</div>
      <h1 className="h4">This scene didn&apos;t make the final cut</h1>
      <p className="text-secondary">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link to="/" className="btn btn-danger">Back to movies</Link>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  // Braces matter: newer browsers return a Promise from scrollTo, and an effect
  // must return nothing or a cleanup function.
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  const isAdmin = useLocation().pathname.startsWith('/admin');
  return (
    <div className="app-root d-flex flex-column min-vh-100">
      <ScrollToTop />
      <Navbar />
      <main className="flex-grow-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies/:id" element={<MovieDetail />} />
          <Route path="/theatres" element={<Theatres />} />
          <Route path="/theatres/:id" element={<TheatreDetail />} />
          <Route path="/showtimes/:id/seats" element={<SeatSelection />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/bookings" element={<RequireAuth><MyBookings /></RequireAuth>} />
          <Route path="/bookings/:code" element={<RequireAuth><BookingConfirmation /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth role="admin"><AdminLayout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="movies" element={<MoviesAdmin />} />
            <Route path="theatres" element={<TheatresAdmin />} />
            <Route path="screens" element={<ScreensAdmin />} />
            <Route path="showtimes" element={<ShowtimesAdmin />} />
            <Route path="bookings" element={<BookingsAdmin />} />
            <Route path="customers" element={<CustomersAdmin />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
    </div>
  );
}
