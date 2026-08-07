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

// Why each special date is a pooja day, extracted from the Devaswom's annual
// calendar — one or more occasion descriptors per date. A descriptor is either
// a plain string key (looked up as t(`schedule.occasions.${key}`)) or, for
// Sankramam days, {key:"sankramam", month} so one translated template string
// ("{{month}} Sankramam") covers every month instead of a key per month.
export const SPECIAL_POOJA_OCCASIONS_2026 = {
  "2026-01-03": ["thiruvathira"],
  "2026-01-04": ["punartham"],
  "2026-01-31": ["prathishta", "punartham"],
  "2026-02-13": [{ key: "sankramam", month: "kumbham" }],
  "2026-02-15": ["sivarathri"],
  "2026-02-28": ["punartham"],
  "2026-03-03": ["utsavam1"],
  "2026-03-04": ["utsavam2"],
  "2026-03-05": ["utsavam3"],
  "2026-03-06": ["utsavam4"],
  "2026-03-07": ["utsavam5"],
  "2026-03-08": ["utsavam6"],
  "2026-03-09": ["utsavam7"],
  "2026-03-15": ["ezhampooja"],
  "2026-03-27": ["punartham"],
  "2026-04-14": [{ key: "sankramam", month: "medam" }],
  "2026-04-15": ["vishu"],
  "2026-04-23": ["pathamudayam", "punartham"],
  "2026-05-15": [{ key: "sankramam", month: "edavam" }],
  "2026-05-20": ["punartham"],
  "2026-06-15": [{ key: "sankramam", month: "mithunam" }],
  "2026-06-17": ["punartham"],
  "2026-07-14": ["punartham"],
  "2026-07-16": [{ key: "sankramam", month: "karkidakam" }],
  "2026-08-11": ["punartham"],
  "2026-08-12": ["karkidakaVavu"],
  "2026-08-17": [{ key: "sankramam", month: "chingam" }],
  "2026-08-26": ["thiruvonam"],
  "2026-09-04": ["krishnaJayanthi"],
  "2026-09-07": ["punartham"],
  "2026-09-14": ["vinayakaChaturthi"],
  "2026-09-17": [{ key: "sankramam", month: "kanni" }],
  "2026-10-04": ["punartham"],
  "2026-10-17": [{ key: "sankramam", month: "thulam" }],
  "2026-10-18": ["navaratri1"],
  "2026-10-19": ["navaratri2"],
  "2026-10-20": ["navaratri3"],
  "2026-10-21": ["navaratri4"],
  "2026-10-31": ["punartham"],
  "2026-11-02": ["ayilyam"],
  "2026-11-08": ["deepavali"],
  "2026-11-16": [{ key: "sankramam", month: "vrischikam" }],
  "2026-11-28": ["punartham"],
  "2026-12-24": ["thiruvathira"],
  "2026-12-25": ["punartham"]
};

export const SPECIAL_POOJA_DATES_2026 = Object.keys(SPECIAL_POOJA_OCCASIONS_2026);

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

function isInMandalapooja2026(dateStr) {
  return dateStr >= MANDALAPOOJA_RANGE_2026.start && dateStr <= MANDALAPOOJA_RANGE_2026.end;
}

// Returns true if the given "YYYY-MM-DD" date string is a day the temple
// holds regular pooja (weekly Tue/Fri, or one of the special dates above).
export function isPoojaDay(dateStr) {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  if (TEMPLE_OPEN_WEEKDAYS.includes(d.getDay())) return true;
  return ALL_SPECIAL_POOJA_DATES.includes(dateStr);
}

// Returns the list of occasion descriptors explaining *why* dateStr is a
// pooja day — for the Schedule page's "why is this day open" detail panel.
export function getDayOccasions(dateStr) {
  if (SPECIAL_POOJA_OCCASIONS_2026[dateStr]) return SPECIAL_POOJA_OCCASIONS_2026[dateStr];
  if (isInMandalapooja2026(dateStr)) return ["mandalapooja"];
  const weekday = new Date(`${dateStr}T00:00:00`).getDay();
  if (weekday === 2) return ["weeklyTue"];
  if (weekday === 5) return ["weeklyFri"];
  return [];
}

// ── Malayalam (Kollavarsham) calendar — month + day, for display only ───────
// Malayalam months are bounded by Sankranti (solar sidereal transition) days.
// 9 of these 12 anchors are the temple's own printed 2026 Sankramam dates
// (already used above for occasions); the other 3 — Dhanu x2 and Makaram,
// Meenam — aren't in the source booklet, so they're arithmetic estimates
// (~30–31 days after the previous anchor, matching the spacing the temple's
// own 9 dates already show). Cross-checked against the one ground-truth data
// point the booklet gives directly ("2026 മാർച്ച് 03 = 1201 കുംഭം 19"): Kumbha
// Sankramam Feb 13 + 18 days = Mar 3 = Kumbham day 19 ✓. Good for 2026 only —
// Sankranti dates drift by about a day every 70-ish years, so this table
// would need updating (not just re-dating) for other years.
const MALAYALAM_MONTH_ANCHORS_2026 = [
  { date: "2025-12-16", month: "dhanu" },     // estimated
  { date: "2026-01-14", month: "makaram" },   // estimated
  { date: "2026-02-13", month: "kumbham" },   // from temple calendar, verified above
  { date: "2026-03-14", month: "meenam" },    // estimated
  { date: "2026-04-14", month: "medam" },     // from temple calendar
  { date: "2026-05-15", month: "edavam" },    // from temple calendar
  { date: "2026-06-15", month: "mithunam" },  // from temple calendar
  { date: "2026-07-16", month: "karkidakam" },// from temple calendar
  { date: "2026-08-17", month: "chingam" },   // from temple calendar — also the Malayalam Era new-year rollover
  { date: "2026-09-17", month: "kanni" },     // from temple calendar
  { date: "2026-10-17", month: "thulam" },    // from temple calendar
  { date: "2026-11-16", month: "vrischikam" },// from temple calendar
  { date: "2026-12-16", month: "dhanu" }      // estimated
];

// Malayalam Era (ME) year rolls over at Chingam 1, not Jan 1.
const ME_YEAR_BEFORE_CHINGAM_2026 = 1201;
const CHINGAM_START_2026 = "2026-08-17";

function daysBetween(startISO, endISO) {
  const a = new Date(`${startISO}T00:00:00`);
  const b = new Date(`${endISO}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

// Returns { monthKey, day, meYear } for a 2026 date, or null outside that
// range. day is 1-based, counted inclusively from the anchor's Sankranti date.
export function getMalayalamDate(dateStr) {
  if (!dateStr || dateStr < "2025-12-16" || dateStr > "2026-12-31") return null;
  let anchor = null;
  for (const a of MALAYALAM_MONTH_ANCHORS_2026) {
    if (a.date <= dateStr) anchor = a; else break;
  }
  if (!anchor) return null;
  const day = daysBetween(anchor.date, dateStr) + 1;
  const meYear = dateStr < CHINGAM_START_2026 ? ME_YEAR_BEFORE_CHINGAM_2026 : ME_YEAR_BEFORE_CHINGAM_2026 + 1;
  return { monthKey: anchor.month, day, meYear };
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
