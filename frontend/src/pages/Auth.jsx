import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { Brand } from '../components/Navbar';
import { ErrorAlert, Loader } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <div className="auth-art d-none d-lg-flex">
        <div>
          <Brand />
          <h2 className="display-title mt-4">Your seat is<br />waiting.</h2>
          <p className="text-light-emphasis">Browse the latest releases, pick the perfect seat and get your tickets in seconds.</p>
          <ul className="list-unstyled text-light-emphasis small mt-4">
            <li className="mb-2"><i className="bi bi-check2-circle text-danger me-2" />Interactive seat selection</li>
            <li className="mb-2"><i className="bi bi-check2-circle text-danger me-2" />Instant booking confirmation</li>
            <li><i className="bi bi-check2-circle text-danger me-2" />Easy cancellations & refunds</li>
          </ul>
        </div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-card">
          <h1 className="h3 mb-1">{title}</h1>
          <p className="text-secondary mb-4">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-group">
      <input id={id} type={show ? 'text' : 'password'} className="form-control" value={value} onChange={onChange}
        autoComplete={autoComplete} minLength={minLength} maxLength={64} required />
      <button type="button" className="btn btn-outline-secondary" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
        <i className={`bi bi-eye${show ? '-slash' : ''}`} />
      </button>
    </div>
  );
}

export function Login() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loader />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await login(email.trim(), password);
      notify(`Welcome back, ${u.full_name.split(' ')[0]}!`);
      navigate(location.state?.from || (u.role === 'admin' ? '/admin' : '/'), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to book tickets and manage your bookings.">
      <form onSubmit={submit} noValidate={false}>
        <ErrorAlert message={error} />
        <div className="mb-3">
          <label className="form-label" htmlFor="email">Email</label>
          <input id="email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div className="mb-4">
          <label className="form-label" htmlFor="password">Password</label>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <button type="submit" className="btn btn-danger w-100 btn-lg" disabled={busy}>
          {busy && <span className="spinner-border spinner-border-sm me-2" />}Log in
        </button>
        <p className="text-center text-secondary mt-4 mb-0">New to CINEBOOK? <Link to="/register" state={location.state}>Create an account</Link></p>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useToast();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) { setError('Password must contain at least one letter and one number'); return; }
    setBusy(true);
    try {
      await register({ full_name: form.full_name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, password: form.password });
      notify('Account created. Enjoy the show!');
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="It takes less than a minute.">
      <form onSubmit={submit}>
        <ErrorAlert message={error} />
        <div className="mb-3">
          <label className="form-label" htmlFor="full_name">Full name</label>
          <input id="full_name" className="form-control" value={form.full_name} onChange={set('full_name')} minLength={2} maxLength={120} autoComplete="name" required />
        </div>
        <div className="row g-3 mb-3">
          <div className="col-sm-7">
            <label className="form-label" htmlFor="remail">Email</label>
            <input id="remail" type="email" className="form-control" value={form.email} onChange={set('email')} autoComplete="email" required />
          </div>
          <div className="col-sm-5">
            <label className="form-label" htmlFor="phone">Phone <span className="text-secondary small">(optional)</span></label>
            <input id="phone" type="tel" className="form-control" value={form.phone} onChange={set('phone')} maxLength={20} autoComplete="tel" />
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="rpassword">Password</label>
          <PasswordInput id="rpassword" value={form.password} onChange={set('password')} autoComplete="new-password" minLength={8} />
          <div className="form-text">At least 8 characters, including a letter and a number.</div>
        </div>
        <div className="mb-4">
          <label className="form-label" htmlFor="confirm">Confirm password</label>
          <PasswordInput id="confirm" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" minLength={8} />
        </div>
        <button type="submit" className="btn btn-danger w-100 btn-lg" disabled={busy}>
          {busy && <span className="spinner-border spinner-border-sm me-2" />}Create account
        </button>
        <p className="text-center text-secondary mt-4 mb-0">Already have an account? <Link to="/login" state={location.state}>Log in</Link></p>
      </form>
    </AuthShell>
  );
}
