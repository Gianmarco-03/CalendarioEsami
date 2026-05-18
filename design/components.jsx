/* Shared components — Icon, Modal, etc. */

const { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } = React;

/* Lucide-style icon */
const Icon = ({ d, size = 16, stroke = 1.75, style, className }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    className={className}
  >
    {d && d.split(" M").map((seg, i) => (
      <path key={i} d={i === 0 ? seg : "M" + seg} />
    ))}
  </svg>
);

/* Built-in UI icons (not exam icons) */
const UI = {
  search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14z M20 20l-3.5-3.5",
  plus:   "M12 5v14 M5 12h14",
  upload: "M12 3v12 M7 8l5-5 5 5 M3 19h18",
  cog:    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  back:   "M19 12H5 M12 19l-7-7 7-7",
  close:  "M18 6 6 18 M6 6l12 12",
  pencil: "M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z",
  trash:  "M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M10 11v6 M14 11v6",
  chevL:  "M15 6l-6 6 6 6",
  chevR:  "M9 6l6 6-6 6",
  calendar: "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18",
  bar:    "M3 3v18h18 M7 14v4 M11 10v8 M15 6v12 M19 14v4",
  list:   "M9 6h11 M9 12h11 M9 18h11 M5 6h.01 M5 12h.01 M5 18h.01",
  globe:  "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20 M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20",
  clock:  "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z M12 8v4l3 2",
  user:   "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  bell:   "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0",
  palette: "M12 22a10 10 0 1 1 0-20c5.52 0 10 4.03 10 9 0 3.31-2.69 6-6 6h-1.77c-.28 0-.5.22-.5.5 0 .12.05.23.13.33.41.47.64 1.06.64 1.67A2.5 2.5 0 0 1 12 22z M7.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M12 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M16.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M16.5 15.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  hash:   "M4 9h16 M4 15h16 M10 3 8 21 M16 3l-2 18",
  todo:   "M9 11l3 3 8-8 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  download: "M12 3v12 M17 10l-5 5-5-5 M3 21h18",
  star:   "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.88-5-4.87 6.91-1.01z",
  focus:  "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.93 4.93l2.12 2.12 M16.95 16.95l2.12 2.12 M4.93 19.07l2.12-2.12 M16.95 7.05l2.12-2.12",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54z",
};

/* Italian helpers */
const MONTHS_IT = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
const MONTHS_IT_SHORT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const WEEKDAYS_IT_SHORT = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
const WEEKDAYS_IT_LONG = ["lunedì","martedì","mercoledì","giovedì","venerdì","sabato","domenica"];

function parseYmd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function inRange(dayKey, start, end) {
  return dayKey >= start && dayKey <= end;
}

/* Build month grid (Monday-first) */
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7;  // 0 = Monday
  const last = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = dow;
  const days = [];
  for (let d = 1; d <= last; d++) {
    const dt = new Date(year, month, d);
    days.push({
      key: ymd(dt),
      day: d,
      weekday: (dt.getDay() + 6) % 7,
      isToday: ymd(dt) === TODAY,
    });
  }
  return { year, month, leadingBlanks, days };
}

/* Modal */
function Modal({ open, onClose, title, kicker, accent, size = "md", children, footer, icon }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-panel size-${size}`} style={{ "--accent-color": accent || "var(--text)" }}>
        <div className="modal-accent" style={{ background: accent || "var(--text)" }} />
        <div className="modal-head">
          {icon && <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: accent || "var(--text)", background: accent ? `color-mix(in srgb, ${accent} 16%, transparent)` : "rgba(255,255,255,0.05)", border: `1px solid ${accent ? `color-mix(in srgb, ${accent} 30%, transparent)` : "var(--border)"}` }}>{icon}</div>}
          <div className="head-text">
            {kicker && <div className="head-kicker">{kicker}</div>}
            <h2>{title}</h2>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Chiudi">
            <Icon d={UI.close} size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

Object.assign(window, {
  Icon, UI,
  MONTHS_IT, MONTHS_IT_SHORT, WEEKDAYS_IT_SHORT, WEEKDAYS_IT_LONG,
  parseYmd, ymd, inRange, buildMonthGrid,
  Modal,
});
