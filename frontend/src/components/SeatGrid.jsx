import { CATEGORY_LABEL, money } from '../utils/format';

/**
 * Renders a cinema seat layout. Rows are grouped into category sections; row A is
 * nearest the screen, which is drawn at the top.
 *
 * rows: [{ row_label, category, seats: [{ id, seat_number, label, status, price? }] }]
 * status: available | booked | blocked | selected | disabled
 */
export default function SeatGrid({ rows, seatsPerRow, selected = new Set(), onSeatClick, prices = {}, compact = false }) {
  const aisleAfter = seatsPerRow >= 10 ? Math.ceil(seatsPerRow / 2) : null;

  const sections = [];
  rows.forEach((r) => {
    const last = sections[sections.length - 1];
    if (last && last.category === r.category) last.rows.push(r);
    else sections.push({ category: r.category, rows: [r] });
  });

  return (
    <div className={`seat-layout ${compact ? 'compact' : ''}`}>
      <div className="screen-arc" aria-hidden="true"><span>SCREEN THIS WAY</span></div>
      <div className="seat-scroll">
        <div className="seat-inner">
          {sections.map((sec, i) => (
            <div className="seat-section" key={`${sec.category}-${i}`}>
              <div className="seat-section-title">
                {CATEGORY_LABEL[sec.category] || sec.category}
                {prices[sec.category] != null && <span> · {money(prices[sec.category])}</span>}
              </div>
              {sec.rows.map((row) => (
                <div className="seat-row" key={row.row_label}>
                  <span className="row-label">{row.row_label}</span>
                  {row.seats.map((seat) => {
                    const isSel = selected.has(seat.id);
                    const status = isSel ? 'selected' : seat.status;
                    const clickable = onSeatClick && (status === 'available' || status === 'selected' || seat.adminToggle);
                    return (
                      <span key={seat.id} className="d-contents">
                        <button
                          type="button"
                          className={`seat seat-${status} cat-${seat.category.toLowerCase()}`}
                          disabled={!clickable}
                          onClick={() => clickable && onSeatClick(seat)}
                          aria-pressed={isSel}
                          aria-label={`Seat ${seat.label}, ${CATEGORY_LABEL[seat.category]}, ${status}${seat.price != null ? `, ${money(seat.price)}` : ''}`}
                          title={`${seat.label} · ${CATEGORY_LABEL[seat.category]}${seat.price != null ? ` · ${money(seat.price)}` : ''} · ${status}`}
                        >
                          {seat.seat_number}
                        </button>
                        {aisleAfter === seat.seat_number && <span className="aisle" />}
                      </span>
                    );
                  })}
                  <span className="row-label">{row.row_label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="seat-legend">
        <span><i className="seat seat-available legend" /> Available</span>
        <span><i className="seat seat-selected legend" /> Selected</span>
        <span><i className="seat seat-booked legend" /> Booked</span>
        <span><i className="seat seat-blocked legend" /> Unavailable</span>
      </div>
    </div>
  );
}
