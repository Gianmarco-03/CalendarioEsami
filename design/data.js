/* Sample data for the Calendario prototype.
   Italian university exams + projects with study days + appelli (exam attempts).
   Today is set to 2026-05-18 (Monday, May). */

const TODAY = "2026-05-18";

const TODAY_DATE = (() => {
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(y, m - 1, d);
})();

/* helper for date arithmetic */
function ymdAdd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function rangeYmd(start, end) {
  const out = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = ymdAdd(cur, 1);
  }
  return out;
}

/* exam icons — Lucide path strings (24x24) */
const EXAM_ICONS = {
  atom:       "M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9C11.18 3.79 5.85 1.77 3.8 3.8c-2.03 2.05-.01 7.38 4.5 11.9 4.52 4.5 9.85 6.5 11.9 4.5z M15.7 15.7c4.52-4.52 6.54-9.85 4.5-11.9-2.04-2.03-7.37-.02-11.9 4.5C3.79 12.82 1.77 18.15 3.8 20.2c2.05 2.04 7.38.02 11.9-4.5z",
  sigma:      "M18 7V4H6l6 8-6 8h12v-3",
  book:       "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  beaker:    "M8 3h8 M9 3v8L4 19a1 1 0 0 0 .9 1.5h14.2a1 1 0 0 0 .9-1.5L15 11V3 M6 14h12",
  scale:     "M12 3v18 M3 9h18 M5 9l-3 7h6zm14 0-3 7h6z",
  landmark:  "M3 22h18 M5 19V10 M9 19V10 M15 19V10 M19 19V10 M2 8l10-5 10 5z M2 11h20",
  feather:   "M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z M16 8 2 22 M17.5 15H9",
  cpu:       "M4 4h16v16H4z M9 9h6v6H9z M9 1v3 M15 1v3 M9 20v3 M15 20v3 M20 9h3 M20 14h3 M1 9h3 M1 14h3",
  flask:    "M10 2v6L4.3 18a1 1 0 0 0 .85 1.5h13.7a1 1 0 0 0 .85-1.5L14 8V2 M8 2h8 M7 14h10",
  brain:    "M9.5 2a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 0 5 0V2a2.5 2.5 0 0 0-5 0 M14.5 2a2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 1-5 0",
  globe:    "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20 M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20",
  pen:      "M21.17 5.83 18.17 2.83a2 2 0 0 0-2.83 0L3 15.17V21h5.83L21.17 8.66a2 2 0 0 0 0-2.83zM15 5l4 4",
};

/* exam colors (original palette) */
const EXAM_PALETTE_DEFAULT = [
  "#E8543F", "#2E86C1", "#27AE60", "#8E44AD",
  "#F39C12", "#16A0A0", "#D81B7A", "#5D6D7E",
  "#C0392B", "#1F8A4C", "#7D5FFF", "#E67E22",
];

const EXAM_PALETTE_NEXO = [
  "#5a7cff", "#2fbf8f", "#f59f00", "#d9480f",
  "#e64980", "#7b61ff", "#2f9e44", "#0991b2",
  "#495057", "#a78bfa", "#14b8a6", "#f97316",
];

/* Sample exams */
const SAMPLE_EXAMS = [
  {
    id: 1,
    kind: "esame",
    name: "Meccanica Razionale",
    color: "#E8543F",
    icon: "atom",
    passed: false,
    appelli: [
      { date: "2026-05-20" },
      { date: "2026-06-10" },
      { date: "2026-07-15" },
    ],
    studyDays: [
      { date: "2026-05-04", minutes: 90 },
      { date: "2026-05-06", minutes: 60 },
      { date: "2026-05-09", minutes: 120 },
      { date: "2026-05-11", minutes: 75 },
      { date: "2026-05-13", minutes: 105 },
      { date: "2026-05-15", minutes: 90 },
      { date: "2026-05-16", minutes: 60 },
      { date: "2026-05-18", minutes: 80 },
    ],
    ranges: [],
  },
  {
    id: 2,
    kind: "esame",
    name: "Analisi III",
    color: "#2E86C1",
    icon: "sigma",
    passed: false,
    appelli: [
      { date: "2026-05-29" },
      { date: "2026-06-22" },
    ],
    studyDays: [
      { date: "2026-05-05", minutes: 60 },
      { date: "2026-05-07", minutes: 90 },
      { date: "2026-05-10", minutes: 45 },
      { date: "2026-05-12", minutes: 75 },
      { date: "2026-05-14", minutes: 60 },
      { date: "2026-05-17", minutes: 90 },
      { date: "2026-05-18", minutes: 60 },
    ],
    ranges: [],
  },
  {
    id: 3,
    kind: "progetto",
    name: "Tesi triennale",
    color: "#8E44AD",
    icon: "feather",
    passed: false,
    appelli: [],
    studyDays: [],
    ranges: [
      { start: "2026-05-11", end: "2026-06-08" },
    ],
  },
  {
    id: 4,
    kind: "esame",
    name: "Storia Antica",
    color: "#27AE60",
    icon: "landmark",
    passed: false,
    appelli: [
      { date: "2026-06-03" },
    ],
    studyDays: [
      { date: "2026-05-02", minutes: 60 },
      { date: "2026-05-09", minutes: 45 },
      { date: "2026-05-16", minutes: 90 },
    ],
    ranges: [],
  },
  {
    id: 5,
    kind: "progetto",
    name: "Lab. Fisica II",
    color: "#F39C12",
    icon: "beaker",
    passed: false,
    appelli: [],
    studyDays: [],
    ranges: [
      { start: "2026-05-04", end: "2026-05-22" },
    ],
  },
  {
    id: 6,
    kind: "esame",
    name: "Filosofia del Diritto",
    color: "#16A0A0",
    icon: "scale",
    passed: true,
    appelli: [
      { date: "2026-03-12" },
    ],
    studyDays: [
      { date: "2026-02-15", minutes: 60 },
      { date: "2026-02-20", minutes: 90 },
      { date: "2026-03-01", minutes: 120 },
      { date: "2026-03-05", minutes: 90 },
      { date: "2026-03-10", minutes: 60 },
    ],
    ranges: [],
  },
  {
    id: 7,
    kind: "esame",
    name: "Diritto Internazionale",
    color: "#D81B7A",
    icon: "globe",
    passed: false,
    appelli: [
      { date: "2026-06-15" },
      { date: "2026-07-08" },
    ],
    studyDays: [
      { date: "2026-05-08", minutes: 45 },
      { date: "2026-05-15", minutes: 60 },
    ],
    ranges: [],
  },
];

Object.assign(window, {
  TODAY, TODAY_DATE, ymdAdd, rangeYmd,
  EXAM_ICONS, EXAM_PALETTE_DEFAULT, EXAM_PALETTE_NEXO,
  SAMPLE_EXAMS,
});
