import { useState, useEffect, useRef } from "react";
import { Routes, Route, Link, NavLink, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { SCHEDULE_KEYS, SCHEDULE_TIMES, NOTICES_KEYS, STAR_KEYS, OFFERINGS, isPoojaDay, getDayOccasions, getMalayalamDate } from './data/config.js';
import templeEntrance from './assets/temple-entrance.webp';

// ── Supabase client ───────────────────────────────────────────────────────────
// createClient() throws synchronously (crashing the whole app, not just
// whatever calls Supabase) if the URL is falsy — these placeholder fallbacks
// keep the site loadable with no .env present; real calls to Supabase just
// fail at request time instead, same as before .env support was added.
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_PUBLIC_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// Row ids are generated here rather than read back from the insert (no
// .select().single()) because the devotee-facing booking form runs as the
// anon (not signed-in) role, which only has INSERT access on these tables —
// PostgREST can't return the inserted row without a matching SELECT grant,
// and that grant is intentionally reserved for signed-in admins (see
// supabase/migrations/002_admin_read_access.sql).
async function submitBooking(validEntries, grandTotal, t) {
  const bookingId = crypto.randomUUID();
  const { error: bErr } = await supabase
    .from('bookings')
    .insert({ id: bookingId, grand_total: grandTotal * 100, payment_status: 'pending' });
  if (bErr) throw new Error(bErr.message);

  // 2. Insert each devotee + their offerings
  for (const dev of validEntries) {
    const subtotal = dev.offeringIds.reduce(
      (s, oid) => s + (OFFERINGS.find(o => o.id === oid)?.price ?? 0), 0);

    const devoteeId = crypto.randomUUID();
    const { error: dErr } = await supabase
      .from('devotees')
      .insert({ id: devoteeId, booking_id: bookingId, name: dev.name.trim(),
                birth_star: dev.star, preferred_date: dev.date,
                subtotal: subtotal * 100 });
    if (dErr) throw new Error(dErr.message);

    const rows = dev.offeringIds.map(oid => {
      const o = OFFERINGS.find(x => x.id === oid);
      return { devotee_id: devoteeId, offering_id: oid,
               offering_name: t(`offeringsData.${o?.key}.name`) ?? String(oid), price: (o?.price ?? 0) * 100 };
    });
    const { error: oErr } = await supabase.from('devotee_offerings').insert(rows);
    if (oErr) throw new Error(oErr.message);
  }
  return bookingId;
}

// ── Helper ────────────────────────────────────────────────────────────────────
let _cartUid = 1;

// Local-timezone-safe "YYYY-MM-DD" formatter (avoids the UTC-shift bug of toISOString()).
const pad2 = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Today's date, used as the floor for the pooja-day calendar.
const TODAY = toISO(new Date());

// Builds a 7-wide grid of calendar cells (with leading/trailing days from
// neighbouring months to fill whole weeks) for the given year/month.
function buildMonthMatrix(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = startWeekday; i > 0; i--) cells.push({ date: new Date(year, month, 1 - i), inMonth: false });
  for (let day = 1; day <= daysInMonth; day++) cells.push({ date: new Date(year, month, day), inMonth: true });
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
  }
  return cells;
}

// Shared calendar grid — month header + weekday row + day buttons, restricted
// to real pooja days (Tuesdays, Fridays, Punartham/Sankramam, festival days,
// Mandalapooja). Used both inside the popover date-picker (below) and inline,
// always-visible, on the Schedule page.
function PoojaCalendarGrid({ viewDate, onPrevMonth, onNextMonth, selectedValue, onSelectDay, lang, markedDates }) {
  const locale = lang === 'ml' ? 'ml-IN' : 'en-IN';
  const monthLabel = viewDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(2023, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' }));
  const cells = buildMonthMatrix(viewDate.getFullYear(), viewDate.getMonth());

  return (
    <>
      <div className="pdp-head">
        <button type="button" onClick={onPrevMonth} aria-label="Previous month">‹</button>
        <span>{monthLabel}</span>
        <button type="button" onClick={onNextMonth} aria-label="Next month">›</button>
      </div>
      <div className="pdp-grid pdp-weekdays">
        {weekdayLabels.map((w, i) => <span key={i}>{w}</span>)}
      </div>
      <div className="pdp-grid">
        {cells.map((c, i) => {
          const iso = toISO(c.date);
          const disabled = !c.inMonth || iso < TODAY || !isPoojaDay(iso);
          const cls = ['pdp-day'];
          if (iso === selectedValue) cls.push('sel');
          if (iso === TODAY) cls.push('today');
          if (!c.inMonth) cls.push('out');
          if (markedDates && markedDates.has(iso)) cls.push('has-items');
          return (
            <button type="button" key={i} disabled={disabled} className={cls.join(' ')}
              data-date={iso} onClick={() => onSelectDay(iso)}>
              {c.date.getDate()}
            </button>
          );
        })}
      </div>
    </>
  );
}

// Shared day-details pane — shown beside the calendar once a day is picked.
// Special days (Punartham, Sankramam, festivals…) get a badge + the reason;
// plain weekly Tue/Fri days just show the date, since the reason is implied.
// onBookDay is only passed on the Schedule page, which needs a CTA into
// Offerings; the Offerings page itself omits it since picking a day there
// unlocks the booking form directly below.
function DayDetailsPanel({ selectedDay, lang, onBookDay }) {
  const { t } = useTranslation();

  if (!selectedDay) {
    return <p className="day-details-prompt">{t('schedule.dayDetails.prompt')}</p>;
  }

  const locale = lang === 'ml' ? 'ml-IN' : 'en-IN';
  const dayLabel = new Date(`${selectedDay}T00:00:00`).toLocaleDateString(locale,
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const md = getMalayalamDate(selectedDay);
  const malayalamLabel = md
    ? t('schedule.dayDetails.malayalamDate', { month: t(`schedule.malayalamMonths.${md.monthKey}`), day: md.day, year: md.meYear })
    : null;

  const occasions = getDayOccasions(selectedDay);
  const isSpecial = !(occasions.length === 1 && (occasions[0] === 'weeklyTue' || occasions[0] === 'weeklyFri'));

  const renderOccasion = (occ) => typeof occ === 'string'
    ? t(`schedule.occasions.${occ}`)
    : t(`schedule.occasions.${occ.key}`, { month: t(`schedule.malayalamMonths.${occ.month}`) });

  return (
    <>
      <div className="day-details-date">📅 {dayLabel}</div>
      {malayalamLabel && <div className="day-details-malayalam">{malayalamLabel}</div>}
      {isSpecial && (
        <>
          <span className="day-details-badge">{t('schedule.dayDetails.specialBadge')}</span>
          <ul className="day-details-list">
            {occasions.map((occ, i) => <li key={i}>{renderOccasion(occ)}</li>)}
          </ul>
        </>
      )}
      {onBookDay && (
        <button className="btn-cta" onClick={() => onBookDay(selectedDay)}>
          {t('schedule.dayDetails.bookCta')}
        </button>
      )}
    </>
  );
}

// react-router doesn't scroll to top on navigation by default — this restores
// the same "jump to top on page change" behaviour the old setState-based nav had.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
  return null;
}

// ── Pages ─────────────────────────────────────────────────────────────────────
function HomePage() {
  const { t } = useTranslation();

  return (
    <>
      <div className="hero">
        <div className="hero-inner">
          <div>
            <div className="hero-diya">🪔</div>
            <h1>{t('hero.title')}</h1>
            <div className="hero-sub">{t('hero.sub')}</div>
            <div className="hero-divider"/>
            <p className="hero-desc">{t('hero.desc')}</p>
          </div>
          <div className="hero-frame">
            <img src={templeEntrance} alt={t('hero.photoCaption')}/>
            <div className="hero-frame-cap">{t('hero.photoCaption')}</div>
          </div>
        </div>
      </div>
      <div className="section intro-section">
        <p className="intro-text">{t('home.intro')}</p>
        <div className="cta-center">
          <Link className="btn-cta" to="/about">{t('home.aboutCta')}</Link>
        </div>
      </div>
      <div className="timing-bar">
        <p className="timing-label">{t('hero.glance')}</p>
        <p className="timing-value">{t('hero.timing')}</p>
        <p className="timing-note">{t('hero.timingNote')}</p>
      </div>
      <div className="section reach-section">
        <h2 className="section-title">📍 {t('home.reach.h')}</h2>
        <div className="section-rule"/>
        <p className="reach-text">{t('home.reach.p')}</p>
        <div className="map-embed">
          <iframe
            title={t('home.reach.mapTitle')}
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d125794.9747298453!2d76.35680768416793!3d9.842559498911607!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3b087716e8a334c9%3A0xee55366e7d41f554!2sPanackal%20Devi%20Kshethram!5e0!3m2!1sen!2sin!4v1785380702481!5m2!1sen!2sin"
            className="map-iframe" loading="lazy"
            referrerPolicy="no-referrer-when-downgrade" allowFullScreen
          />
        </div>
      </div>
    </>
  );
}

const ABOUT_SECTIONS = ['deity', 'history', 'subDeities', 'festivals', 'rituals', 'darshan', 'committee'];
const ABOUT_ICONS = { deity: '🛕', history: '📜', subDeities: '🕉️', festivals: '🌺', rituals: '🔥', darshan: '🚶', committee: '🏛️' };

function AboutPage() {
  const { t } = useTranslation();

  const subDeities = t('about.subDeities.items', { returnObjects: true });
  const festivals  = t('about.festivals.items', { returnObjects: true });
  const rituals    = t('about.rituals.items', { returnObjects: true });
  const darshan    = t('about.darshan.steps', { returnObjects: true });
  const committee  = t('about.committee.members', { returnObjects: true });

  const [active, setActive] = useState(ABOUT_SECTIONS[0]);
  const sectionRefs = useRef({});

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActive(entry.target.dataset.section);
      });
    }, { rootMargin: '-110px 0px -65% 0px', threshold: 0 });
    ABOUT_SECTIONS.forEach(id => {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const jumpTo = (e, id) => {
    e.preventDefault();
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="section about-page">
      <h2 className="section-title">{t('about.title')}</h2>
      <div className="section-rule"/>

      <div className="about-layout">
        <aside className="about-side-nav">
          {ABOUT_SECTIONS.map(id => (
            <a key={id} href={`#about-${id}`} className={active===id ? 'active' : ''}
              onClick={(e)=>jumpTo(e, id)}>
              {ABOUT_ICONS[id]} {t(`about.${id}.h`)}
            </a>
          ))}
        </aside>

        <div className="about-content">
          <div className="about-block" id="about-deity" data-section="deity" ref={el=>sectionRefs.current.deity=el}>
            <h3 className="about-h">🛕 {t('about.deity.h')}</h3>
            <p>{t('about.deity.p')}</p>
            <div className="verse-card">
              <div className="verse-row">
                <span className="verse-label">{t('about.deity.verse.labels.devanagari')}</span>
                <p className="verse-text-dev dev">{t('about.deity.verse.devanagari')}</p>
              </div>
              <div className="verse-row">
                <span className="verse-label">{t('about.deity.verse.labels.malayalam')}</span>
                <p className="verse-text-ml">{t('about.deity.verse.malayalam')}</p>
              </div>
              <div className="verse-row">
                <span className="verse-label">{t('about.deity.verse.labels.transliteration')}</span>
                <p className="verse-text-translit">{t('about.deity.verse.transliteration')}</p>
              </div>
              <div className="verse-row verse-meaning-row">
                <span className="verse-label">{t('about.deity.verse.labels.meaning')}</span>
                <p className="verse-text-meaning">{t('about.deity.verse.meaning')}</p>
              </div>
            </div>
          </div>

          <div className="about-block" id="about-history" data-section="history" ref={el=>sectionRefs.current.history=el}>
            <h3 className="about-h">📜 {t('about.history.h')}</h3>
            <p>{t('about.history.p')}</p>
          </div>

          <div className="about-block" id="about-subDeities" data-section="subDeities" ref={el=>sectionRefs.current.subDeities=el}>
            <h3 className="about-h">🕉️ {t('about.subDeities.h')}</h3>
            <div className="card-grid">
              {subDeities.map((d,i)=>(
                <div className="card" key={i}>
                  <div className="card-icon">{d.icon}</div>
                  <h3>{d.name}</h3>
                  <p>{d.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="about-block" id="about-festivals" data-section="festivals" ref={el=>sectionRefs.current.festivals=el}>
            <h3 className="about-h">🌺 {t('about.festivals.h')}</h3>
            <div className="card-grid">
              {festivals.map((f,i)=>(
                <div className="card" key={i}>
                  <div className="card-icon">{f.icon}</div>
                  <h3>{f.name}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="about-block" id="about-rituals" data-section="rituals" ref={el=>sectionRefs.current.rituals=el}>
            <h3 className="about-h">🔥 {t('about.rituals.h')}</h3>
            <div className="ritual-list">
              {rituals.map((r,i)=>(
                <div className="ritual-card" key={i}>
                  <h4>{r.name}</h4>
                  <p>{r.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="about-block" id="about-darshan" data-section="darshan" ref={el=>sectionRefs.current.darshan=el}>
            <h3 className="about-h">🚶 {t('about.darshan.h')}</h3>
            <ol className="darshan-steps">
              {darshan.map((s,i)=><li key={i}>{s}</li>)}
            </ol>
          </div>

          <div className="about-block" id="about-committee" data-section="committee" ref={el=>sectionRefs.current.committee=el}>
            <h3 className="about-h">🏛️ {t('about.committee.h')}</h3>
            <p>{t('about.committee.intro')}</p>
            <div className="committee-table">
              {committee.map((m,i)=>(
                <div className="committee-row" key={i}>
                  <span>{m.name}</span>
                  <span className="committee-role">{m.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SchedulePage({ lang }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [calView, setCalView] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const onBookDay = iso => navigate(`/offerings?date=${iso}`);

  return (
    <div className="section">
      <h2 className="section-title">{t('schedule.title')}</h2>
      <div className="section-rule"/>

      <div className="schedule-layout">
        <div className="schedule-main">
          <div className="table-scroll">
            <table className="schedule-table">
              <thead><tr>{t('schedule.cols', { returnObjects: true }).map((c,i)=><th key={i}>{c}</th>)}</tr></thead>
              <tbody>
                {SCHEDULE_KEYS.map((k,i)=>(
                  <tr key={i}>
                    <td className="schedule-name">{t(`scheduleData.${k}.name`)}</td>
                    <td><span className="time-badge">{SCHEDULE_TIMES[k]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="om">{t('misc.om')}</div>

          <div className="cal-block">
            <h3 className="about-h">🗓️ {t('schedule.calendar.h')}</h3>
            <p className="offerings-subtitle">{t('schedule.calendar.hint')}</p>

            <div className="cal-and-details">
              <div className="inline-cal">
                <PoojaCalendarGrid
                  viewDate={calView}
                  onPrevMonth={() => setCalView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
                  onNextMonth={() => setCalView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
                  selectedValue={selectedDay}
                  onSelectDay={setSelectedDay}
                  lang={lang}
                />
              </div>

              <div className="day-details">
                <DayDetailsPanel selectedDay={selectedDay} lang={lang} onBookDay={onBookDay}/>
              </div>
            </div>
          </div>
        </div>

        <aside className="schedule-sidebar">
          <div className="card"><div className="card-icon">🗓️</div><h3>{t('schedule.openDays.h')}</h3><ul>{t('schedule.openDays.items', { returnObjects: true }).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
          <div className="card"><div className="card-icon">🕔</div><h3>{t('schedule.hours.h')}</h3><ul>{t('schedule.hours.items', { returnObjects: true }).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
          <div className="card"><div className="card-icon">📋</div><h3>{t('schedule.dress.h')}</h3><ul>{t('schedule.dress.items', { returnObjects: true }).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
        </aside>
      </div>
    </div>
  );
}

function NoticePage() {
  const { t } = useTranslation();
  const tagCls = {festival:'tag-festival',important:'tag-important',general:'tag-general'};

  return (
    <div className="section">
      <h2 className="section-title">{t('notices.title')}</h2>
      <div className="section-rule"/>
      {NOTICES_KEYS.map((n,i)=>(
        <div className="notice-card" key={i}>
          <span className={`notice-tag ${tagCls[n.tag]}`}>{t(`notices.tags.${n.tag}`)}</span>
          <div className="notice-date">{t(`noticesData.${n.key}.date`)}</div>
          <h4>{t(`noticesData.${n.key}.title`)}</h4>
          <p>{t(`noticesData.${n.key}.body`)}</p>
        </div>
      ))}
    </div>
  );
}

// Internal committee tool, not linked from the public nav — kept English-only
// on purpose rather than wired into the i18n locale files. Auth is Supabase
// Auth (email + password, no public sign-up — accounts are created directly
// in the Supabase dashboard); what actually keeps devotee data private is the
// RLS policy in supabase/migrations/002_admin_read_access.sql restricting
// SELECT to signed-in users, not this page's login form by itself.
function AdminPage() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [rows, setRows] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [chartData, setChartData] = useState(null);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Overview chart — independent of the date search below, so it fetches
  // once on login rather than on every date-picker change.
  useEffect(() => {
    if (!session) return;
    (async () => {
      const today = new Date(`${TODAY}T00:00:00`);
      const addDays = n => toISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
      const start = addDays(-7);
      const end = addDays(7);
      const { data, error } = await supabase
        .from('devotees')
        .select('preferred_date')
        .gte('preferred_date', start)
        .lte('preferred_date', end);
      if (error) return;
      const counts = {};
      data.forEach(d => { counts[d.preferred_date] = (counts[d.preferred_date] || 0) + 1; });
      const days = [];
      for (let i = -7; i <= 7; i++) {
        const iso = addDays(i);
        days.push({ date: iso, count: counts[iso] || 0 });
      }
      setChartData(days);
    })();
  }, [session]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setSigningIn(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setSigningIn(false);
  };

  const handleLogout = () => supabase.auth.signOut();

  // Shared by the date <input> and clicking a chart bar — resets the name
  // filter too, so a filter left over from a previous date doesn't quietly
  // hide everything on the new one.
  const changeDate = (iso) => {
    setFilterText('');
    setSelectedDate(iso);
  };

  const runSearch = async (dateStr) => {
    setSearching(true);
    setSearchError('');
    const { data, error } = await supabase
      .from('devotees')
      .select('id, name, birth_star, subtotal, bookings(payment_status), devotee_offerings(offering_name, price)')
      .eq('preferred_date', dateStr)
      .order('name');
    if (error) setSearchError(error.message);
    else setRows(data);
    setSearching(false);
  };

  // Re-runs whenever the date picker changes, not just on login — otherwise
  // picking a new date updates the input but leaves the previous date's
  // results on screen until "Search" is clicked separately. The Search
  // button stays too, for re-fetching the same date (e.g. a booking just
  // came in) without having to change the date and back.
  useEffect(() => {
    if (session) runSearch(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, selectedDate]);

  if (session === undefined) {
    return <div className="section"><p className="admin-loading">Loading…</p></div>;
  }

  if (!session) {
    return (
      <div className="section admin-section">
        <h2 className="section-title">Admin Login</h2>
        <div className="section-rule"/>
        <form className="admin-login-form" onSubmit={handleLogin}>
          <div className="fg">
            <label>Email</label>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/>
          </div>
          <div className="fg">
            <label>Password</label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/>
          </div>
          {authError && <p className="error-msg">⚠️ {authError}</p>}
          <button type="submit" className="btn-cta" disabled={signingIn}>
            {signingIn ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    );
  }

  const filterQuery = filterText.trim().toLowerCase();
  const filteredRows = (rows || []).filter(d => !filterQuery
    || d.name.toLowerCase().includes(filterQuery)
    || (d.birth_star || '').toLowerCase().includes(filterQuery));

  const grandTotal = filteredRows.reduce((s, d) => s + (d.subtotal || 0), 0) / 100;
  const maxChartCount = chartData ? Math.max(1, ...chartData.map(d => d.count)) : 1;

  // Offerings grouped by name across the filtered devotees — a quick "what
  // needs to be prepared today" breakdown, rather than repeating the same
  // per-devotee list already in the table below.
  const offeringsSummary = {};
  filteredRows.forEach(d => {
    (d.devotee_offerings || []).forEach(o => {
      const entry = offeringsSummary[o.offering_name] || { count: 0, total: 0 };
      entry.count += 1;
      entry.total += o.price || 0;
      offeringsSummary[o.offering_name] = entry;
    });
  });
  const offeringsSummaryList = Object.entries(offeringsSummary).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="section admin-section">
      <div className="admin-header">
        <h2 className="section-title">Bookings by Date</h2>
        <div className="admin-account">
          <span>{session.user.email}</span>
          <button type="button" className="admin-logout" onClick={handleLogout}>Log Out</button>
        </div>
      </div>
      <div className="section-rule"/>

      {chartData && (
        <div className="admin-chart">
          <h3 className="admin-chart-title">Bookings — past 7 days, today, next 7 days</h3>
          <div className="admin-chart-bars">
            {chartData.map(d => {
              const isToday = d.date === TODAY;
              const isSelected = d.date === selectedDate;
              const pct = (d.count / maxChartCount) * 100;
              const label = new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
              const full = new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
              return (
                <button type="button" className="admin-chart-col" key={d.date}
                  onClick={() => changeDate(d.date)}
                  aria-pressed={isSelected}
                  title={`${full}: ${d.count} booking${d.count === 1 ? '' : 's'}`}>
                  <span className="admin-chart-value">{d.count}</span>
                  <div className={`admin-chart-bar${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                    style={{ height: `${pct}%` }}/>
                  <span className={`admin-chart-label${isToday ? ' today' : ''}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="admin-search-row">
        <div className="fg">
          <label>Date</label>
          <input type="date" value={selectedDate}
            onChange={e=>changeDate(e.target.value)}/>
        </div>
        <button type="button" className="btn-cta" onClick={()=>runSearch(selectedDate)} disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {searchError && <p className="error-msg">⚠️ {searchError}</p>}

      {!searching && rows && (
        rows.length > 0 ? (
          <div className="admin-results">
            <input type="text" className="admin-filter-input"
              placeholder="Filter by name or birth star…"
              value={filterText} onChange={e=>setFilterText(e.target.value)}/>

            {filteredRows.length > 0 ? (
              <>
                <div className="table-scroll">
                  <table className="schedule-table admin-table">
                    <thead>
                      <tr><th>Name</th><th>Birth Star</th><th>Offerings</th><th>Subtotal</th><th>Payment</th></tr>
                    </thead>
                    <tbody>
                      {filteredRows.map(d => (
                        <tr key={d.id}>
                          <td>{d.name}</td>
                          <td>{d.birth_star}</td>
                          <td>{(d.devotee_offerings || []).map(o=>o.offering_name).join(', ')}</td>
                          <td>₹{((d.subtotal||0)/100).toLocaleString('en-IN')}</td>
                          <td>{d.bookings?.payment_status ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="admin-offerings-summary">
                  <h4>Offerings breakdown</h4>
                  <ul>
                    {offeringsSummaryList.map(([name, o]) => (
                      <li key={name}>
                        <span className="admin-offering-name">{name}</span>
                        <span className="admin-offering-count">×{o.count}</span>
                        <span className="admin-offering-total">₹{(o.total / 100).toLocaleString('en-IN')}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="admin-total">Total: ₹{grandTotal.toLocaleString('en-IN')} across {filteredRows.length} {filteredRows.length===1?'devotee':'devotees'}</p>
              </>
            ) : (
              <p className="empty-state">No devotees match "{filterText}".</p>
            )}
          </div>
        ) : (
          <p className="empty-state">No bookings found for this date.</p>
        )
      )}
    </div>
  );
}

function OfferingsPage({ lang }) {
  const { t } = useTranslation();
  const isMl = lang === 'ml';
  const [searchParams] = useSearchParams();
  const presetDate = searchParams.get('date') || '';
  const [calView, setCalView] = useState(() => {
    const base = presetDate ? new Date(`${presetDate}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(presetDate || '');
  const [form, setForm] = useState({ name: '', star: '', offeringIds: [] });
  const [justAdded, setJustAdded] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookingId, setBookingId] = useState(null);

  const toggleOffering = (ofId) =>
    setForm(f => ({
      ...f,
      offeringIds: f.offeringIds.includes(ofId)
        ? f.offeringIds.filter(x => x !== ofId)
        : [...f.offeringIds, ofId]
    }));

  const formSubtotal = form.offeringIds.reduce((s, oid) => s + (OFFERINGS.find(o => o.id === oid)?.price || 0), 0);
  const canAdd = !!(selectedDate && form.name.trim() && form.star && form.offeringIds.length > 0);

  const addToCart = () => {
    if (!canAdd) return;
    setCartItems(c => [...c, {
      id: _cartUid++, date: selectedDate,
      name: form.name.trim(), star: form.star, offeringIds: [...form.offeringIds]
    }]);
    setForm({ name: '', star: '', offeringIds: [] });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1100);
  };

  const removeItem = (id) => setCartItems(c => c.filter(i => i.id !== id));

  const markedDates = new Set(cartItems.map(i => i.date));
  const byDate = {};
  cartItems.forEach(item => { (byDate[item.date] ||= []).push(item); });
  const sortedDates = Object.keys(byDate).sort();
  const grandTotal = cartItems.reduce((s, i) =>
    s + i.offeringIds.reduce((ss, oid) => ss + (OFFERINGS.find(o => o.id === oid)?.price || 0), 0), 0);

  const handleClose = () => {
    setShowModal(false); setBookingId(null);
    setSubmitError(''); setCartItems([]); setSelectedDate('');
  };

  const handlePay = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const id = await submitBooking(cartItems, grandTotal, t);
      setBookingId(id);
      setShowModal(true);
    } catch (err) {
      setSubmitError(t('offerings.errorMsg'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="section">
      <h2 className="section-title">{t('offerings.title')}</h2>
      <div className="section-rule"/>
      <p className="offerings-subtitle">{t('offerings.subtitle')}</p>

      <div className="offerings-layout">
      <div className="cal-stack">
        <h3 className="about-h">🗓️ {t('offerings.step1')}</h3>
        <div className="cal-details-row">
          <div className="inline-cal">
            <PoojaCalendarGrid
              viewDate={calView}
              onPrevMonth={() => setCalView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
              onNextMonth={() => setCalView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
              selectedValue={selectedDate}
              onSelectDay={setSelectedDate}
              lang={lang}
              markedDates={markedDates}
            />
          </div>
          <div className="day-details">
            <DayDetailsPanel selectedDay={selectedDate} lang={lang}/>
          </div>
        </div>
      </div>

      <div className="devotee-block">
        {!selectedDate ? (
          <p className="locked-note">🔒 {t('offerings.lockedNote')}</p>
        ) : (
          <>
            <div className="selected-date-chip">
              <span className="icon">📅</span>
              <span className="txt">
                {t('offerings.dateChipPrefix')} <b>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString(isMl ? 'ml-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</b>
              </span>
            </div>

            <div className="form-row form-row-2">
              <div className="fg">
                <label>{t('offerings.nameLbl')}</label>
                <input placeholder={t('offerings.namePh')} value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
              </div>
              <div className="fg">
                <label>{t('offerings.starLbl')}</label>
                <select value={form.star} onChange={e => setForm(f => ({ ...f, star: e.target.value }))}>
                  <option value="">{t('offerings.starPh')}</option>
                  {STAR_KEYS.map(s => <option key={s} value={s}>{t(`starsData.${s}`)}</option>)}
                </select>
              </div>
            </div>

            <div className="mini-grid">
              {OFFERINGS.map(o => {
                const selected = form.offeringIds.includes(o.id);
                return (
                  <div key={o.id} className={`mini-item${selected ? ' sel' : ''}`}
                    onClick={() => toggleOffering(o.id)}>
                    <input type="checkbox" readOnly checked={selected}/>
                    <span>{o.icon}</span>
                    <span>{t(`offeringsData.${o.key}.name`)}</span>
                    <span className="mini-price">₹{o.price.toLocaleString('en-IN')}</span>
                  </div>
                );
              })}
            </div>
            {formSubtotal > 0 &&
              <p className="subtotal-hint">{t('offerings.subtotal')}: <strong className="amount-highlight">₹{formSubtotal.toLocaleString('en-IN')}</strong></p>}

            <button type="button" className={`btn-add-cart${justAdded ? ' added' : ''}`}
              disabled={!canAdd} onClick={addToCart}>
              {justAdded ? t('offerings.added') : t('offerings.addToCart')}
            </button>
          </>
        )}
      </div>

      <aside className="offerings-aside">
      {cartItems.length > 0 ? (
        <div className="cart-box">
          <h3>{t('offerings.cartTitle')}</h3>
          {sortedDates.map(date => (
            <div className="cart-date-group" key={date}>
              <div className="cart-date-header">
                📅 {new Date(`${date}T00:00:00`).toLocaleDateString(isMl ? 'ml-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              {byDate[date].map(item => {
                const items = OFFERINGS.filter(o => item.offeringIds.includes(o.id));
                const sub = items.reduce((s, o) => s + o.price, 0);
                return (
                  <div className="cart-item" key={item.id}>
                    <button type="button" className="cart-remove" title={t('offerings.removeItem')}
                      onClick={() => removeItem(item.id)}>✕</button>
                    <div className="cart-dv-name">
                      👤 {item.name}
                      <span className="cart-star-label">({t('offerings.starLabel')}: <span>{t(`starsData.${item.star}`)}</span>)</span>
                    </div>
                    {items.map(o => (
                      <div className="cart-row" key={o.id}>
                        <span>{o.icon} <span>{t(`offeringsData.${o.key}.name`)}</span></span>
                        <span>₹{o.price.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="cart-subtotal">{t('offerings.subtotal')}: ₹{sub.toLocaleString('en-IN')}</div>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="cart-grand">
            <span>{t('offerings.grandTotal')}</span>
            <span>₹{grandTotal.toLocaleString('en-IN')}</span>
          </div>
          <button className="btn-pay" onClick={handlePay} disabled={submitting}>
            {submitting
              ? t('offerings.submitting')
              : `${t('offerings.proceedPay')} — ₹${grandTotal.toLocaleString('en-IN')}`}
          </button>
          {submitError && (
            <p className="error-msg">
              ⚠️ {submitError}
            </p>
          )}
        </div>
      ) : (
        <p className="empty-state">{t('offerings.emptyPrompt')}</p>
      )}
      </aside>
      </div>

      {showModal && (
        <div className="modal-ov" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="mb">🙏</div>
            <h3>{t('offerings.modalTitle')}</h3>
            <p>{t('offerings.modalBody', { total: grandTotal.toLocaleString('en-IN'), names: cartItems.map(d=>d.name).join(', ') })}</p>
            {bookingId && (
              <p className="booking-id">
                {t('offerings.bookingId')}: {bookingId}
              </p>
            )}
            <button onClick={handleClose}>{t('offerings.modalClose')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
const PAGE_KEYS = ["Home","About","Schedule","Notices","Offerings"];
const PAGE_PATHS = { Home: "/", About: "/about", Schedule: "/schedule", Notices: "/notices", Offerings: "/offerings" };

export default function App() {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState("ml");
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang, i18n]);

  // Both .ml and data-theme are set directly in JSX on .app-shell below —
  // computed during render, not via an effect reaching into the document —
  // so descendants get the swapped font/color variables through normal CSS
  // inheritance with no extra tick of delay (and no flash on first paint).
  const THEMES = ["light", "dark", "classic", "serene"];
  const THEME_ICONS = { light: '☀️', dark: '🌙', classic: '🪔', serene: '🌊' };
  const changeTheme = (next) => {
    setTheme(next);
    localStorage.setItem('theme', next);
  };

  const NAV_LABELS = {
    Home: t('nav.home'), About: t('nav.about'), Schedule: t('nav.schedule'),
    Notices: t('nav.notices'), Offerings: t('nav.offerings'),
  };

  return (
    <div className={`app-shell${lang==='ml' ? ' ml' : ''}`} data-theme={theme}>
      <ScrollToTop/>
      <nav className="nav">
        <div className="nav-inner">
          <Link className="nav-logo" to="/">
            <span className="nav-logo-icon">🪔</span>
            <div>
              <div className="nav-logo-name">{t('templeNameShort')}</div>
              <div className="nav-logo-sub">അമ്മേ നാരായണ ദേവീ നാരായണ</div>
            </div>
          </Link>

          <div className="nav-right">
            <button className="hamburger" onClick={()=>setMenuOpen(o=>!o)} aria-label="Menu">
              <span/><span/><span/>
            </button>
          </div>

          <ul className={`nav-links${menuOpen?' open':''}`}>
            {PAGE_KEYS.map(p=>(
              <li key={p}>
                <NavLink to={PAGE_PATHS[p]} end className={({isActive})=>isActive?'active':''}
                  onClick={()=>setMenuOpen(false)}>
                  {NAV_LABELS[p]}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage/>}/>
        <Route path="/about" element={<AboutPage/>}/>
        <Route path="/schedule" element={<SchedulePage lang={lang}/>}/>
        <Route path="/notices" element={<NoticePage/>}/>
        <Route path="/offerings" element={<OfferingsPage lang={lang}/>}/>
        {/* Not in PAGE_KEYS/nav on purpose — an internal committee tool, not a public page. */}
        <Route path="/admin" element={<AdminPage/>}/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>

      <footer className="footer">
        <p className="footer-brand">
          🪔 {t('templeNameShort')}
        </p>
        <p>{t('footer.contact')}</p>

        <div className="footer-controls">
          <div className="theme-select" title="Choose theme">
            {THEMES.map(th => (
              <button key={th} className={`theme-btn${theme===th?' active':''}`}
                onClick={()=>changeTheme(th)} aria-label={`${th} theme`}>
                {THEME_ICONS[th]}
              </button>
            ))}
          </div>
          <div className="lang-toggle" title="Switch language / ഭാഷ മാറ്റുക">
            <button className={`lang-btn${lang==='en'?' active':''}`} onClick={()=>setLang('en')}>EN</button>
            <button className={`lang-btn${lang==='ml'?' active':''} ml`} onClick={()=>setLang('ml')}>മലയാളം</button>
          </div>
        </div>

        <p className="footer-copy">{t('footer.copy')}</p>
      </footer>
    </div>
  );
}
