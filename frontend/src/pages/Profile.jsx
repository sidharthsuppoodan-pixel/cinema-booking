import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import { ErrorAlert } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/format';

export default function Profile() {
  const { user, refresh } = useAuth();
  const notify = useToast();
  const [form, setForm] = useState({ full_name: user.full_name, phone: user.phone || '' });
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { full_name: form.full_name, phone: form.phone || null };
      if (pw.new_password) Object.assign(body, pw);
      await api.put('/auth/me', body);
      await refresh();
      setPw({ current_password: '', new_password: '' });
      notify('Profile updated');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="section-title">My Profile</h1>
      <div className="panel">
        <div className="d-flex align-items-center gap-3 mb-4">
          <span className="avatar avatar-lg">{user.full_name.charAt(0).toUpperCase()}</span>
          <div>
            <div className="fw-semibold">{user.email}</div>
            <div className="small text-secondary text-capitalize">{user.role} · member since {fmtDate(user.created_at)}</div>
          </div>
        </div>
        <form onSubmit={save}>
          <ErrorAlert message={error} />
          <div className="mb-3">
            <label className="form-label" htmlFor="pname">Full name</label>
            <input id="pname" className="form-control" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} minLength={2} maxLength={120} required />
          </div>
          <div className="mb-4">
            <label className="form-label" htmlFor="pphone">Phone</label>
            <input id="pphone" type="tel" className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} />
          </div>
          <h6 className="text-secondary text-uppercase small">Change password</h6>
          <div className="row g-3 mb-4">
            <div className="col-sm-6">
              <label className="form-label" htmlFor="cur">Current password</label>
              <input id="cur" type="password" className="form-control" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
            </div>
            <div className="col-sm-6">
              <label className="form-label" htmlFor="newp">New password</label>
              <input id="newp" type="password" className="form-control" autoComplete="new-password" minLength={8} maxLength={64} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
            </div>
          </div>
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-danger" disabled={busy}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Save changes</button>
            {user.role === 'customer' && <Link to="/bookings" className="btn btn-outline-light">My bookings</Link>}
          </div>
        </form>
      </div>
    </div>
  );
}
