import { useState, useEffect, useRef } from "react";
import { createClient } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { SCHEDULE_KEYS, SCHEDULE_TIMES, NOTICES_KEYS, STAR_KEYS, OFFERINGS, isPoojaDay } from './data/config.js';
import templeEntrance from './assets/temple-entrance.webp';

// ── Supabase client ───────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function submitBooking(validEntries, grandTotal, t) {
  // 1. Create booking row
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .insert({ grand_total: grandTotal * 100, payment_status: 'pending' })
    .select('id').single();
  if (bErr) throw new Error(bErr.message);

  // 2. Insert each devotee + their offerings
  for (const dev of validEntries) {
    const subtotal = dev.offeringIds.reduce(
      (s, oid) => s + (OFFERINGS.find(o => o.id === oid)?.price ?? 0), 0);

    const { data: devotee, error: dErr } = await supabase
      .from('devotees')
      .insert({ booking_id: booking.id, name: dev.name.trim(),
                birth_star: dev.star, preferred_date: dev.date,
                subtotal: subtotal * 100 })
      .select('id').single();
    if (dErr) throw new Error(dErr.message);

    const rows = dev.offeringIds.map(oid => {
      const o = OFFERINGS.find(x => x.id === oid);
      return { devotee_id: devotee.id, offering_id: oid,
               offering_name: t(`offeringsData.${o?.key}.name`) ?? String(oid), price: (o?.price ?? 0) * 100 };
    });
    const { error: oErr } = await supabase.from('devotee_offerings').insert(rows);
    if (oErr) throw new Error(oErr.message);
  }
  return booking.id;
}

// ── Helper ────────────────────────────────────────────────────────────────────
let _uid = 1;
const newDevotee = () => ({ id: _uid++, name:'', star:'', date:'', offeringIds:[] });

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

// Custom calendar date-picker: a native <input type="date"> cannot disable
// arbitrary weekdays/dates, so this restricts selection to real pooja days
// (Tuesdays, Fridays, Punartham/Sankramam days, festival days, Mandalapooja).
function PoojaDatePicker({ value, onChange, lang, placeholder }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const isMl = lang === 'ml';
  const locale = isMl ? 'ml-IN' : 'en-IN';
  const monthLabel = viewDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(2023, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' }));
  const cells = buildMonthMatrix(viewDate.getFullYear(), viewDate.getMonth());
  const displayValue = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="pooja-datepicker" ref={wrapRef}>
      <button type="button" className={`pdp-trigger${!value ? ' ph' : ''}`} onClick={() => setOpen(o => !o)}>
        📅 {displayValue || placeholder}
      </button>
      {open && (
        <div className="pdp-pop">
          <div className="pdp-head">
            <button type="button" onClick={() => setViewDate(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))}>‹</button>
            <span>{monthLabel}</span>
            <button type="button" onClick={() => setViewDate(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))}>›</button>
          </div>
          <div className="pdp-grid pdp-weekdays">
            {weekdayLabels.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div className="pdp-grid">
            {cells.map((c, i) => {
              const iso = toISO(c.date);
              const disabled = !c.inMonth || iso < TODAY || !isPoojaDay(iso);
              const cls = ['pdp-day'];
              if (iso === value) cls.push('sel');
              if (iso === TODAY) cls.push('today');
              if (!c.inMonth) cls.push('out');
              return (
                <button type="button" key={i} disabled={disabled} className={cls.join(' ')}
                  onClick={() => { onChange(iso); setOpen(false); }}>
                  {c.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pages ─────────────────────────────────────────────────────────────────────
function HomePage({ onNavigate }) {
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
          <button className="btn-cta" onClick={()=>onNavigate('About')}>{t('home.aboutCta')}</button>
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

function SchedulePage() {
  const { t } = useTranslation();

  return (
    <div className="section">
      <h2 className="section-title">{t('schedule.title')}</h2>
      <div className="section-rule"/>
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
      <div className="card-grid">
        <div className="card"><div className="card-icon">🗓️</div><h3>{t('schedule.openDays.h')}</h3><ul>{t('schedule.openDays.items', { returnObjects: true }).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
        <div className="card"><div className="card-icon">🕔</div><h3>{t('schedule.hours.h')}</h3><ul>{t('schedule.hours.items', { returnObjects: true }).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
        <div className="card"><div className="card-icon">📋</div><h3>{t('schedule.dress.h')}</h3><ul>{t('schedule.dress.items', { returnObjects: true }).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
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

function OfferingsPage({ lang }) {
  const { t } = useTranslation();
  const isMl = lang === 'ml'; 
  const [cart, setCart] = useState([newDevotee()]);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookingId, setBookingId] = useState(null);

  const updDev = (id, field, val) =>
    setCart(c => c.map(d => d.id===id ? {...d, [field]:val} : d));

  const toggleOff = (devId, ofId) =>
    setCart(c => c.map(d => {
      if (d.id!==devId) return d;
      const ids = d.offeringIds.includes(ofId)
        ? d.offeringIds.filter(x=>x!==ofId)
        : [...d.offeringIds, ofId];
      return {...d, offeringIds:ids};
    }));

  const addDev = () => setCart(c=>[...c, newDevotee()]);
  const rmDev  = (id) => setCart(c=>c.filter(d=>d.id!==id));

  const validEntries = cart.filter(d=>d.name.trim()&&d.star&&d.offeringIds.length>0);
  const grandTotal   = validEntries.reduce((s,d)=>
    s+d.offeringIds.reduce((ss,oid)=>ss+(OFFERINGS.find(o=>o.id===oid)?.price||0),0),0);

  const handleClose = () => {
    setShowModal(false); setBookingId(null);
    setSubmitError(''); setCart([newDevotee()]);
  };

  const handlePay = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const id = await submitBooking(validEntries, grandTotal, t);
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
      <p className="date-note">📅 {t('offerings.dateNote')}</p>

      <div className="offerings-layout">
      <div className="offerings-main">
      {cart.map((dev,idx)=>{
        const sub = dev.offeringIds.reduce((s,oid)=>s+(OFFERINGS.find(o=>o.id===oid)?.price||0),0);
        return (
          <div className="devotee-block" key={dev.id}>
            <div className="dv-header">
              <span className="dv-title">
                {t('offerings.devoteeTitle')} {idx+1}
                {dev.name && <span className="dv-name-tag">— {dev.name}</span>}
              </span>
              {cart.length>1 &&
                <button className="btn-rm-dv" onClick={()=>rmDev(dev.id)}>{t('offerings.removeDevotee')}</button>}
            </div>

            {/* Mini offering checkboxes */}
            <div className="mini-grid">
              {OFFERINGS.map(o=>{
                const selected = dev.offeringIds.includes(o.id);
                return (
                  <div key={o.id} className={`mini-item${selected?' sel':''}`}
                    onClick={()=>toggleOff(dev.id,o.id)}>
                    <input type="checkbox" readOnly checked={selected}/>
                    <span>{o.icon}</span>
                    <span>{t(`offeringsData.${o.key}.name`)}</span>
                    <span className="mini-price">₹{o.price.toLocaleString('en-IN')}</span>
                  </div>
                );
              })}
            </div>

            {/* Name + Star + Date */}
            <div className="form-row form-row-3">
              <div className="fg">
                <label>{t('offerings.nameLbl')}</label>
                <input placeholder={t('offerings.namePh')} value={dev.name}
                  onChange={e=>updDev(dev.id,'name',e.target.value)}/>
              </div>
              <div className="fg">
                <label>{t('offerings.starLbl')}</label>
                <select value={dev.star} onChange={e=>updDev(dev.id,'star',e.target.value)}>
                  <option value="">{t('offerings.starPh')}</option>
                  {STAR_KEYS.map(s=><option key={s} value={s}>{t(`starsData.${s}`)}</option>)}
                </select>
              </div>
              <div className="fg">
                <label>📅 {t('offerings.dateLbl')}</label>
                <PoojaDatePicker value={dev.date} lang={lang} placeholder={t('offerings.datePh')}
                  onChange={val=>updDev(dev.id,'date',val)}/>
              </div>
            </div>
            {dev.offeringIds.length>0 &&
              <p className="subtotal-hint">{t('offerings.subtotal')}: <strong className="amount-highlight">₹{sub.toLocaleString('en-IN')}</strong></p>}
          </div>
        );
      })}

      <button className="btn-add-dv" onClick={addDev}>{t('offerings.addDevotee')}</button>
      </div>

      {/* Cart */}
      <aside className="offerings-aside">
      {validEntries.length>0 ? (
        <div className="cart-box">
          <h3>{t('offerings.cartTitle')}</h3>
          {validEntries.map(d=>{
            const items = OFFERINGS.filter(o=>d.offeringIds.includes(o.id));
            const sub   = items.reduce((s,o)=>s+o.price,0);
            return (
              <div className="cart-devotee" key={d.id}>
                <div className="cart-dv-name">
                  👤 {d.name}
                  <span className="cart-star-label">
                    ({t('offerings.starLabel')}: <span>{t(`starsData.${d.star}`)}</span>)
                  </span>
                </div>
                {items.map(o=>(
                  <div className="cart-row" key={o.id}>
                    <span>{o.icon} <span>{t(`offeringsData.${o.key}.name`)}</span></span>
                    <span>₹{o.price.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                {d.date && (
                  <div className="cart-date">
                    📅 {new Date(d.date+'T00:00:00').toLocaleDateString(isMl?'ml-IN':'en-IN',{day:'numeric',month:'long',year:'numeric'})}
                  </div>
                )}
                <div className="cart-subtotal">
                  {t('offerings.subtotal')}: ₹{sub.toLocaleString('en-IN')}
                </div>
              </div>
            );
          })}
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
            <p>{t('offerings.modalBody', { total: grandTotal.toLocaleString('en-IN'), names: validEntries.map(d=>d.name).join(', ') })}</p>
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

export default function App() {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState("en");
  const [page, setPage] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang, i18n]);

  // Both .ml and data-theme are set directly in JSX on .app-shell below —
  // computed during render, not via an effect reaching into the document —
  // so descendants get the swapped font/color variables through normal CSS
  // inheritance with no extra tick of delay (and no flash on first paint).
  const THEMES = ["light", "dark", "classic"];
  const THEME_ICONS = { light: '☀️', dark: '🌙', classic: '🪔' };
  const changeTheme = (next) => {
    setTheme(next);
    localStorage.setItem('theme', next);
  };

  const NAV_LABELS = {
    Home: t('nav.home'), About: t('nav.about'), Schedule: t('nav.schedule'),
    Notices: t('nav.notices'), Offerings: t('nav.offerings'),
  };

  const go = p => { setPage(p); setMenuOpen(false); window.scrollTo({top:0,behavior:'smooth'}); };

  return (
    <div className={`app-shell${lang==='ml' ? ' ml' : ''}`} data-theme={theme}>
      <nav className="nav">
        <div className="nav-inner">
          <a className="nav-logo" href="#" onClick={e=>{e.preventDefault();go("Home");}}>
            <span className="nav-logo-icon">🪔</span>
            <div>
              <div className="nav-logo-name">{t('templeNameShort')}</div>
              <div className="nav-logo-sub">അമ്മേ നാരായണ ഭദ്രേ നാരായണ</div>
            </div>
          </a>

          <div className="nav-right">
            <button className="hamburger" onClick={()=>setMenuOpen(o=>!o)} aria-label="Menu">
              <span/><span/><span/>
            </button>
          </div>

          <ul className={`nav-links${menuOpen?' open':''}`}>
            {PAGE_KEYS.map(p=>(
              <li key={p}>
                <button className={page===p?'active':''} onClick={()=>go(p)}>
                  {NAV_LABELS[p]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {page==="Home"      && <HomePage      onNavigate={go}/>}
      {page==="About"     && <AboutPage/>}
      {page==="Schedule"  && <SchedulePage/>}
      {page==="Notices"   && <NoticePage/>}
      {page==="Offerings" && <OfferingsPage lang={lang}/>}

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
