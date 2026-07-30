export const SCHEDULE_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"];

export const SCHEDULE_TIMES = {
  "s1": "5:00 AM",
  "s2": "6:00 AM",
  "s3": "6:30 AM",
  "s4": "8:00 AM",
  "s5": "10:30 AM",
  "s6": "12:00 PM",
  "s7": "5:00 PM",
  "s8": "6:45 PM",
  "s9": "7:30 PM",
  "s10": "8:30 PM"
};

export const NOTICES_KEYS = [
  { key: "n1", tag: "festival" },
  { key: "n2", tag: "important" },
  { key: "n3", tag: "general" },
  { key: "n4", tag: "festival" }
];

export const STAR_KEYS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", 
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", 
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", 
  "Anuradha", "Jyeshtha", "Moola", "Purva Ashadha", "Uttara Ashadha", 
  "Shravana", "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", 
  "Uttara Bhadrapada", "Revati"
];

// ── Pooja / Nadathurappu open-days logic ─────────────────────────────────────
// The temple's nada opens for regular pooja only on Tuesdays & Fridays, plus
// Punartham (birth-star) days, Sankramam (solar transition) days, and every
// day of the 41-day Mandalapooja — per the festival Devaswom's notice.
export const TEMPLE_OPEN_WEEKDAYS = [2, 5]; // Date.getDay(): 0=Sun ... 2=Tue, 5=Fri

// Explicit special pooja dates for 2026 (Punartham, Sankramam, festival &
// observance days) extracted from the Devaswom's annual calendar.
export const SPECIAL_POOJA_DATES_2026 = [
  "2026-01-03", "2026-01-04", "2026-01-31",
  "2026-02-13", "2026-02-15", "2026-02-28",
  "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09",
  "2026-03-15", "2026-03-27",
  "2026-04-14", "2026-04-15", "2026-04-23",
  "2026-05-15", "2026-05-20",
  "2026-06-15", "2026-06-17",
  "2026-07-14", "2026-07-16",
  "2026-08-11", "2026-08-12", "2026-08-17", "2026-08-26",
  "2026-09-04", "2026-09-07", "2026-09-14", "2026-09-17",
  "2026-10-04", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-31",
  "2026-11-02", "2026-11-08", "2026-11-16", "2026-11-28",
  "2026-12-24", "2026-12-25"
];

// 41-day Mandalapooja vratham — nada opens daily throughout this period.
export const MANDALAPOOJA_RANGE_2026 = { start: "2026-11-17", end: "2026-12-27" };

const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function expandRange(startISO, endISO) {
  const dates = [];
  let d = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  while (d <= end) {
    dates.push(isoOf(d));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return dates;
}

export const ALL_SPECIAL_POOJA_DATES = Array.from(new Set([
  ...SPECIAL_POOJA_DATES_2026,
  ...expandRange(MANDALAPOOJA_RANGE_2026.start, MANDALAPOOJA_RANGE_2026.end)
]));

// Returns true if the given "YYYY-MM-DD" date string is a day the temple
// holds regular pooja (weekly Tue/Fri, or one of the special dates above).
export function isPoojaDay(dateStr) {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  if (TEMPLE_OPEN_WEEKDAYS.includes(d.getDay())) return true;
  return ALL_SPECIAL_POOJA_DATES.includes(dateStr);
}

export const OFFERINGS = [
  { id: 1, icon: "🌾", price: 70, key: "o1" },
  { id: 2, icon: "🍚", price: 70, key: "o2" },
  { id: 3, icon: "🥣", price: 70, key: "o3" },
  { id: 4, icon: "🌼", price: 70, key: "o4" },
  { id: 5, icon: "🌱", price: 200, key: "o5" },
  { id: 6, icon: "💛", price: 200, key: "o6" },
  { id: 7, icon: "🍯", price: 200, key: "o7" },
  { id: 8, icon: "🪙", price: 100, key: "o8" },
  { id: 9, icon: "👨‍👩‍👧‍👦", price: 500, key: "o9" }
];
