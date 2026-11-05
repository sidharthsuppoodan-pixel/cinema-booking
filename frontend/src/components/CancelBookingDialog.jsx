import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';
import { money } from '../utils/format';
import { ConfirmDialog, ErrorAlert, Loader } from './common';

/** Fetches the live cancellation quote, shows the policy outcome and cancels on confirm. */
export default function CancelBookingDialog({ booking, admin = false, onClose, onDone }) {
  const notify = useToast();
  const [quote, setQuote] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!booking) return;
    setQuote(null);
    setError('');
    setReason('');
    const url = admin ? `/admin/bookings/${booking.booking_code}` : `/bookings/${booking.booking_code}/cancellation`;
    api.get(url)
      .then((r) => setQuote(admin ? r.data.cancellation : r.data))
      .catch((e) => setError(errorMessage(e)));
  }, [booking, admin]);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const url = admin ? `/admin/bookings/${booking.booking_code}/cancel` : `/bookings/${booking.booking_code}/cancel`;
      const r = await api.post(url, { reason: reason || null });
      notify(`Booking ${booking.booking_code} cancelled. Refund: ${money(r.data.payment?.refund_amount || 0)}`);
      onDone?.(r.data);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      show={!!booking}
      title={`Cancel booking ${booking?.booking_code || ''}`}
      confirmLabel="Cancel booking"
      busy={busy}
      confirmDisabled={!quote?.cancellable}
      onConfirm={confirm}
      onClose={onClose}
    >
      {!quote && !error && <Loader label="Checking cancellation policy…" />}
      {quote && (
        <div className={`alert ${quote.cancellable ? 'alert-warning' : 'alert-secondary'} small`}>
          <div className="fw-semibold mb-1">{quote.cancellable ? 'This booking can be cancelled' : 'This booking cannot be cancelled'}</div>
          {quote.reason}
          {quote.cancellable && (
            <div className="mt-2 fs-6">Refund amount: <strong>{money(quote.refund_amount)}</strong> ({quote.refund_percent}%)</div>
          )}
        </div>
      )}
      {quote?.cancellable && (
        <div>
          <label className="form-label small" htmlFor="cancel-reason">Reason (optional)</label>
          <input id="cancel-reason" className="form-control" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
      <ErrorAlert message={error} />
    </ConfirmDialog>
  );
}
