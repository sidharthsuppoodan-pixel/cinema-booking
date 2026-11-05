const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export const money = (v) => inr.format(Number(v || 0));

export const fmtDate = (iso, opts = {}) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', ...opts });

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

export const fmtDateTime = (iso) => `${fmtDate(iso)}, ${fmtTime(iso)}`;

export const duration = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

/** Local-day boundaries for the next `n` days, for showtime date pickers. */
export function nextDays(n = 7) {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const end = new Date(d);
    end.setDate(d.getDate() + 1);
    out.push({
      key: d.toISOString(),
      from: d.toISOString(),
      to: end.toISOString(),
      dow: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
      day: d.getDate(),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
    });
  }
  return out;
}

/** Convert a YouTube watch / share URL into an embeddable URL. */
export function trailerEmbed(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    else if (u.hostname.includes('youtube.com')) {
      id = u.searchParams.get('v') || (u.pathname.startsWith('/embed/') ? u.pathname.split('/')[2] : null);
    }
    if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    if (u.hostname.includes('vimeo.com')) return `https://player.vimeo.com/video/${u.pathname.split('/').pop()}?autoplay=1`;
  } catch { /* not a URL */ }
  return null;
}

/** datetime-local value (local time) <-> ISO */
export const toLocalInput = (iso) => {
  const d = new Date(iso);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v) => new Date(v).toISOString();

export const STATUS_VARIANT = {
  CONFIRMED: 'success',
  COMPLETED: 'info',
  CANCELLED: 'danger',
  PAID: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'secondary',
  PARTIALLY_REFUNDED: 'warning',
};

export const CATEGORY_LABEL = { STANDARD: 'Standard', PREMIUM: 'Premium', RECLINER: 'Recliner' };
