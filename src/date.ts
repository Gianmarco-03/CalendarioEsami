export const MONTHS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export const WEEKDAYS_IT_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmd(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function inRange(key: string, start: string, end: string): boolean {
  return key >= start && key <= end;
}

export function tint(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface MonthGridDay {
  key: string;
  day: number;
  isToday: boolean;
  col: number; // 0..6, Monday=0
}

export interface MonthGrid {
  year: number;
  month: number; // 0..11
  leadingBlanks: number;
  days: MonthGridDay[];
}

export function buildMonthGrid(year: number, month: number): MonthGrid {
  const first = new Date(year, month, 1);
  const leadingBlanks = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = ymd(new Date());
  const days: MonthGridDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    days.push({
      key: ymd(date),
      day: d,
      isToday: ymd(date) === todayKey,
      col: (leadingBlanks + d - 1) % 7,
    });
  }
  return { year, month, leadingBlanks, days };
}
