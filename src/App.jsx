import { useState, useEffect } from "react";
import { createClient } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { SCHEDULE_KEYS, SCHEDULE_TIMES, NOTICES_KEYS, STAR_KEYS, OFFERINGS } from './data/config.js';

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

// ── CSS ───────────────────────────────────────────────────────────────────────
const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Yatra+One&family=Noto+Serif+Malayalam:wght@400;600;700&family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--color-cream);font-family:'Noto Serif',serif;color:var(--color-text)}
    .ml{font-family:'Noto Serif Malayalam',serif}
    ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--color-deep-cream)}::-webkit-scrollbar-thumb{background:var(--color-gold);border-radius:3px}

    /* NAV */
    .nav{position:sticky;top:0;z-index:100;background:var(--color-dark-maroon);border-bottom:3px solid var(--color-gold);box-shadow:0 4px 20px rgba(0,0,0,.5)}
    .nav-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:0 1rem;gap:.5rem;flex-wrap:wrap}
    .nav-logo{display:flex;align-items:center;gap:.7rem;padding:.7rem 0;text-decoration:none;flex-shrink:0}
    .nav-logo-icon{font-size:2rem}
    .nav-logo-name{color:var(--color-light-gold);font-family:'Yatra One',cursive;font-size:.9rem;line-height:1.2}
    .nav-logo-sub{color:var(--color-gold);font-size:.65rem;opacity:.8}
    .nav-right{display:flex;align-items:center;gap:.5rem}
    
    .theme-toggle{background:none;border:1px solid rgba(200,151,58,.3);color:var(--color-gold);border-radius:20px;padding:4px 10px;cursor:pointer;font-size:.8rem;transition:all .2s;display:flex;align-items:center;gap:5px;}
    .theme-toggle:hover{background:rgba(255,255,255,.1)}

    .lang-toggle{display:flex;background:rgba(255,255,255,.08);border-radius:20px;padding:3px;border:1px solid rgba(200,151,58,.3)}
    .lang-btn{background:none;border:none;cursor:pointer;color:var(--color-gold);font-size:.75rem;font-weight:700;padding:.22rem .65rem;border-radius:16px;transition:all .2s;white-space:nowrap;line-height:1.4}
    .lang-btn.active{background:var(--color-gold);color:var(--color-dark-maroon)}
    .hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;padding:.5rem}
    .hamburger span{display:block;width:24px;height:2px;background:var(--color-gold);border-radius:2px}
    .nav-links{display:flex;gap:.2rem;list-style:none}
    .nav-links button{background:none;border:none;cursor:pointer;color:var(--color-light-gold);font-size:.87rem;padding:.5rem .75rem;border-radius:4px;transition:background .2s,color .2s;white-space:nowrap}
    .nav-links button:hover,.nav-links button.active{background:var(--color-gold);color:var(--color-dark-maroon);font-weight:700}
    @media(max-width:768px){
      .hamburger{display:flex}
      .nav-links{display:none;flex-direction:column;gap:0;position:absolute;top:100%;left:0;right:0;background:var(--color-dark-maroon);border-bottom:3px solid var(--color-gold);padding:.5rem 0}
      .nav-links.open{display:flex}
      .nav-links button{width:100%;text-align:left;padding:.8rem 1.5rem;border-radius:0}
    }

    /* HERO */
    .hero{background:linear-gradient(160deg,var(--color-dark-maroon) 0%,var(--color-maroon) 40%,var(--color-orange) 100%);position:relative;overflow:hidden;text-align:center;padding:4rem 1.5rem 5rem}
    .hero::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 30px,rgba(200,151,58,.05) 30px,rgba(200,151,58,.05) 31px)}
    .hero-diya{font-size:3.5rem;animation:flicker 2s ease-in-out infinite alternate}
    @keyframes flicker{0%{transform:scale(1) rotate(-3deg);filter:brightness(1)}100%{transform:scale(1.08) rotate(3deg);filter:brightness(1.3)}}
    .hero h1{font-family:'Yatra One',cursive;color:var(--color-light-gold);font-size:clamp(1.6rem,5vw,3rem);text-shadow:0 2px 20px rgba(0,0,0,.6);margin:.5rem 0 .3rem}
    .hero-sub{color:var(--color-gold);font-style:italic;font-size:clamp(.85rem,2.5vw,1.1rem);opacity:.9}
    .hero-divider{width:200px;height:3px;margin:1.5rem auto;background:linear-gradient(90deg,transparent,var(--color-gold),transparent)}
    .hero-desc{color:var(--color-deep-cream);max-width:600px;margin:0 auto;line-height:1.9;font-size:.95rem}

    /* SECTION */
    .section{max-width:1100px;margin:0 auto;padding:3rem 1.5rem}
    .section-title{font-family:'Yatra One',cursive;color:var(--color-maroon);font-size:clamp(1.4rem,4vw,2rem);text-align:center;margin-bottom:.5rem}
    .section-rule{width:120px;height:3px;margin:0 auto 2.5rem;background:linear-gradient(90deg,transparent,var(--color-gold),transparent)}
    .om{text-align:center;color:var(--color-gold);font-size:1.2rem;margin:2rem 0;opacity:.6}

    /* CARDS */
    .card-grid{display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(255px,1fr))}
    .card{background:var(--color-card-bg);border:1px solid var(--color-deep-cream);border-top:4px solid var(--color-gold);border-radius:8px;padding:1.5rem;box-shadow:0 4px 16px rgba(0,0,0,.07);transition:transform .2s,box-shadow .2s}
    .card:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(107,15,26,.15)}
    .card-icon{font-size:2rem;margin-bottom:.7rem}
    .card h3{color:var(--color-maroon);font-size:1.1rem;margin-bottom:.5rem}
    .card p,.card li{color:var(--color-muted);font-size:.9rem;line-height:1.8}
    .card ul{padding-left:1rem}

    /* SCHEDULE */
    .schedule-table{width:100%;border-collapse:collapse;margin-top:1rem}
    .schedule-table th{background:var(--color-maroon);color:var(--color-light-gold);font-family:'Yatra One',cursive;font-size:1rem;padding:.8rem 1rem;text-align:left}
    .schedule-table td{padding:.75rem 1rem;border-bottom:1px solid var(--color-deep-cream);font-size:.9rem}
    .schedule-table tr:nth-child(even) td{background:var(--color-deep-cream)}
    .schedule-table tr:hover td{background:var(--color-devotee-bg)}
    .time-badge{display:inline-block;background:var(--color-maroon);color:var(--color-light-gold);border-radius:20px;padding:.15rem .7rem;font-size:.8rem;font-weight:600}

    /* NOTICE */
    .notice-card{background:var(--color-notice-bg);border-left:5px solid var(--color-gold);border-radius:6px;padding:1.2rem 1.5rem;margin-bottom:1rem;box-shadow:0 2px 8px rgba(0,0,0,.06)}
    .notice-card h4{color:var(--color-maroon);margin-bottom:.4rem}
    .notice-card p{color:var(--color-muted);font-size:.9rem;line-height:1.7}
    .notice-date{font-size:.78rem;color:var(--color-gold);font-weight:600;margin-bottom:.4rem}
    .notice-tag{display:inline-block;font-size:.72rem;padding:.1rem .6rem;border-radius:12px;margin-right:.4rem;margin-bottom:.5rem;font-weight:700}
    .tag-festival{background:#FEF3C7;color:#92400E}
    .tag-important{background:#FEE2E2;color:#991B1B}
    .tag-general{background:#DCFCE7;color:#166534}

    /* OFFERINGS PAGE */
    .devotee-block{background:var(--color-devotee-bg);border:1.5px solid var(--color-deep-cream);border-radius:12px;padding:1.5rem;margin-bottom:1.2rem;transition:box-shadow .2s}
    .devotee-block:focus-within{box-shadow:0 0 0 3px rgba(200,151,58,.2)}
    .dv-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
    .dv-title{color:var(--color-maroon);font-family:'Yatra One',cursive;font-size:1.05rem}
    .btn-rm-dv{background:none;border:1px solid var(--color-border);color:var(--color-muted);border-radius:6px;cursor:pointer;padding:.22rem .65rem;font-size:.78rem;transition:all .2s}
    .btn-rm-dv:hover{background:#FEE2E2;color:#991B1B;border-color:#FCA5A5}

    /* mini offerings checkboxes */
    .mini-grid{display:grid;gap:.5rem;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));margin-bottom:1rem}
    .mini-item{display:flex;align-items:center;gap:.5rem;padding:.45rem .7rem;border:1.5px solid var(--color-deep-cream);border-radius:8px;cursor:pointer;transition:all .2s;background:var(--color-card-bg);font-size:.84rem;user-select:none}
    .mini-item:hover{border-color:var(--color-gold)}
    .mini-item.sel{border-color:var(--color-maroon);background:var(--color-devotee-bg)}
    .mini-item input[type=checkbox]{accent-color:var(--color-maroon);width:14px;height:14px;flex-shrink:0;pointer-events:none}
    .mini-price{margin-left:auto;font-weight:700;color:var(--color-maroon);font-size:.8rem;white-space:nowrap}

    /* form */
    .form-row{display:grid;gap:1rem;margin-bottom:.5rem}
    @media(max-width:700px){.form-row{grid-template-columns:1fr!important}}
    .fg{display:flex;flex-direction:column;gap:.35rem}
    .fg label{font-size:.8rem;font-weight:600;color:var(--color-muted)}
    .fg input,.fg select{border:1.5px solid var(--color-deep-cream);border-radius:6px;padding:.55rem .85rem;font-family:'Noto Serif',serif;font-size:.9rem;color:var(--color-text);background:var(--color-card-bg);transition:border-color .2s}
    .fg input:focus,.fg select:focus{outline:none;border-color:var(--color-gold)}

    .subtotal-hint{text-align:right;font-size:.82rem;color:var(--color-muted);margin-top:.4rem}

    .btn-add-dv{width:100%;padding:.8rem;background:transparent;border:2px dashed var(--color-gold);color:var(--color-maroon);font-family:'Yatra One',cursive;font-size:1rem;border-radius:10px;cursor:pointer;margin-top:.5rem;transition:all .2s}
    .btn-add-dv:hover{background:var(--color-devotee-bg)}

    /* CART */
    .cart-box{background:var(--color-dark-maroon);border-radius:12px;padding:1.5rem;margin-top:2rem}
    .cart-box h3{color:var(--color-light-gold);font-family:'Yatra One',cursive;font-size:1.3rem;margin-bottom:1rem;border-bottom:1px solid rgba(200,151,58,.25);padding-bottom:.7rem}
    .cart-devotee{margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid rgba(200,151,58,.12)}
    .cart-dv-name{color:var(--color-gold);font-weight:700;font-size:.93rem;margin-bottom:.4rem}
    .cart-row{display:flex;justify-content:space-between;font-size:.87rem;color:var(--color-deep-cream);margin-bottom:.25rem}
    .cart-grand{display:flex;justify-content:space-between;font-size:1.2rem;font-weight:700;color:var(--color-gold);border-top:1px solid rgba(200,151,58,.3);margin-top:.8rem;padding-top:.8rem}

    .btn-pay{width:100%;margin-top:1.5rem;padding:1rem;background:linear-gradient(135deg,var(--color-gold),var(--color-orange));color:#fff;font-family:'Yatra One',cursive;font-size:1.2rem;border:none;border-radius:8px;cursor:pointer;box-shadow:0 4px 16px rgba(212,82,26,.4);transition:transform .2s,box-shadow .2s}
    .btn-pay:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(212,82,26,.5)}
    .btn-pay:disabled{opacity:.5;cursor:not-allowed;transform:none}

    /* MODAL */
    .modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:center;justify-content:center;padding:1rem}
    .modal{background:var(--color-cream);border-radius:12px;padding:2.5rem;max-width:430px;width:100%;border-top:6px solid var(--color-gold);text-align:center}
    .modal .mb{font-size:3.5rem;margin-bottom:1rem}
    .modal h3{color:var(--color-maroon);font-family:'Yatra One',cursive;font-size:1.5rem;margin-bottom:.7rem}
    .modal p{color:var(--color-muted);line-height:1.85;font-size:.9rem}
    .modal button{margin-top:1.5rem;padding:.7rem 2rem;background:var(--color-maroon);color:var(--color-light-gold);border:none;border-radius:6px;cursor:pointer;font-family:'Yatra One',cursive;font-size:1rem}

    .empty-state{text-align:center;color:var(--color-muted);padding:2rem;font-style:italic}

    /* FOOTER */
    .footer{background:var(--color-dark-maroon);color:var(--color-gold);border-top:3px solid var(--color-gold);text-align:center;padding:2rem 1.5rem;font-size:.85rem;line-height:2}
    .footer p{color:var(--color-deep-cream);opacity:.7}

    .timing-bar{background:var(--color-dark-maroon);padding:2.5rem 1.5rem;text-align:center}
  `}</style>
);

// ── Helper ────────────────────────────────────────────────────────────────────
let _uid = 1;
const newDevotee = () => ({ id: _uid++, name:'', star:'', date:'', offeringIds:[] });

// Today's date as min value for date picker
const TODAY = new Date().toISOString().split('T')[0];

// ── Pages ─────────────────────────────────────────────────────────────────────
function HomePage({ lang }) {
  const { t } = useTranslation();
  const isMl = lang === 'ml';
  const cx = isMl ? 'ml' : '';
  
  return (
    <>
      <div className="hero">
        <div className="hero-diya">🪔</div>
        <h1 className={cx}>{t('hero.title')}</h1>
        <div className="hero-sub">{t('hero.sub')}</div>
        <div className="hero-divider"/>
        <p className={`hero-desc ${cx}`}>{t('hero.desc')}</p>
      </div>
      <div className="section">
        <h2 className={`section-title ${cx}`}>{t('home.aboutTitle')}</h2>
        <div className="section-rule"/>
        <div className="card-grid">
          <div className="card"><div className="card-icon">🛕</div><h3 className={cx}>{t('home.deity.h')}</h3><p className={cx}>{t('home.deity.p')}</p></div>
          <div className="card"><div className="card-icon">📜</div><h3 className={cx}>{t('home.history.h')}</h3><p className={cx}>{t('home.history.p')}</p></div>
          <div className="card"><div className="card-icon">🌺</div><h3 className={cx}>{t('home.festivals.h')}</h3><ul>{t('home.festivals.items', { returnObjects: true }).map((x,i)=><li className={cx} key={i}>{x}</li>)}</ul></div>
          <div className="card"><div className="card-icon">📍</div><h3 className={cx}>{t('home.reach.h')}</h3><p className={cx}>{t('home.reach.p')}</p></div>
        </div>
      </div>
      <div className="timing-bar">
        <p style={{color:'var(--color-light-gold)',fontFamily:"'Yatra One',cursive",fontSize:'1.3rem',marginBottom:'.5rem'}} className={cx}>{t('hero.glance')}</p>
        <p style={{color:'var(--color-deep-cream)',opacity:.8,fontSize:'.9rem'}} className={cx}>{t('hero.timing')}</p>
        <p style={{color:'var(--color-gold)',fontSize:'.8rem',marginTop:'.5rem',opacity:.7}} className={cx}>{t('hero.timingNote')}</p>
      </div>
    </>
  );
}

function SchedulePage({ lang }) {
  const { t } = useTranslation();
  const isMl = lang === 'ml'; 
  const cx = isMl ? 'ml' : '';
  
  return (
    <div className="section">
      <h2 className={`section-title ${cx}`}>{t('schedule.title')}</h2>
      <div className="section-rule"/>
      <div style={{overflowX:'auto'}}>
        <table className="schedule-table">
          <thead><tr>{t('schedule.cols', { returnObjects: true }).map((c,i)=><th key={i} className={cx}>{c}</th>)}</tr></thead>
          <tbody>
            {SCHEDULE_KEYS.map((k,i)=>(
              <tr key={i}>
                <td style={{fontWeight:600,color:'var(--color-maroon)'}} className={cx}>{t(`scheduleData.${k}.name`)}</td>
                <td><span className="time-badge">{SCHEDULE_TIMES[k]}</span></td>
                <td className={cx}>{t(`scheduleData.${k}.desc`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="om">{t('misc.om')}</div>
      <div className="card-grid">
        <div className="card"><div className="card-icon">🕔</div><h3 className={cx}>{t('schedule.hours.h')}</h3><ul>{t('schedule.hours.items', { returnObjects: true }).map((x,i)=><li className={cx} key={i}>{x}</li>)}</ul></div>
        <div className="card"><div className="card-icon">📋</div><h3 className={cx}>{t('schedule.dress.h')}</h3><ul>{t('schedule.dress.items', { returnObjects: true }).map((x,i)=><li className={cx} key={i}>{x}</li>)}</ul></div>
      </div>
    </div>
  );
}

function NoticePage({ lang }) {
  const { t } = useTranslation();
  const isMl = lang === 'ml'; 
  const cx = isMl ? 'ml' : '';
  const tagCls = {festival:'tag-festival',important:'tag-important',general:'tag-general'};
  
  return (
    <div className="section">
      <h2 className={`section-title ${cx}`}>{t('notices.title')}</h2>
      <div className="section-rule"/>
      {NOTICES_KEYS.map((n,i)=>(
        <div className="notice-card" key={i}>
          <span className={`notice-tag ${tagCls[n.tag]}`}>{t(`notices.tags.${n.tag}`)}</span>
          <div className="notice-date">{t(`noticesData.${n.key}.date`)}</div>
          <h4 className={cx}>{t(`noticesData.${n.key}.title`)}</h4>
          <p className={cx}>{t(`noticesData.${n.key}.body`)}</p>
        </div>
      ))}
    </div>
  );
}

function OfferingsPage({ lang }) {
  const { t } = useTranslation();
  const isMl = lang === 'ml'; 
  const cx = isMl ? 'ml' : '';
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
      <h2 className={`section-title ${cx}`}>{t('offerings.title')}</h2>
      <div className="section-rule"/>
      <p style={{textAlign:'center',color:'var(--color-muted)',marginBottom:'2rem',fontStyle:'italic',fontSize:'.95rem'}} className={cx}>{t('offerings.subtitle')}</p>

      {cart.map((dev,idx)=>{
        const sub = dev.offeringIds.reduce((s,oid)=>s+(OFFERINGS.find(o=>o.id===oid)?.price||0),0);
        return (
          <div className="devotee-block" key={dev.id}>
            <div className="dv-header">
              <span className={`dv-title ${cx}`}>
                {t('offerings.devoteeTitle')} {idx+1}
                {dev.name && <span style={{color:'var(--color-muted)',fontSize:'.82rem',fontWeight:400,marginLeft:'.5rem'}}>— {dev.name}</span>}
              </span>
              {cart.length>1 &&
                <button className={`btn-rm-dv ${cx}`} onClick={()=>rmDev(dev.id)}>{t('offerings.removeDevotee')}</button>}
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
                    <span className={cx}>{t(`offeringsData.${o.key}.name`)}</span>
                    <span className="mini-price">₹{o.price.toLocaleString('en-IN')}</span>
                  </div>
                );
              })}
            </div>

            {/* Name + Star + Date */}
            <div className="form-row" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
              <div className="fg">
                <label className={cx}>{t('offerings.nameLbl')}</label>
                <input className={cx} placeholder={t('offerings.namePh')} value={dev.name}
                  onChange={e=>updDev(dev.id,'name',e.target.value)}/>
              </div>
              <div className="fg">
                <label className={cx}>{t('offerings.starLbl')}</label>
                <select className={cx} value={dev.star} onChange={e=>updDev(dev.id,'star',e.target.value)}>
                  <option value="">{t('offerings.starPh')}</option>
                  {STAR_KEYS.map(s=><option key={s} value={s}>{t(`starsData.${s}`)}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className={cx}>📅 {t('offerings.dateLbl')}</label>
                <input type="date" min={TODAY} value={dev.date||''}
                  onChange={e=>updDev(dev.id,'date',e.target.value)}/>
              </div>
            </div>
            {dev.offeringIds.length>0 &&
              <p className="subtotal-hint">{t('offerings.subtotal')}: <strong style={{color:'var(--color-maroon)'}}>₹{sub.toLocaleString('en-IN')}</strong></p>}
          </div>
        );
      })}

      <button className={`btn-add-dv ${cx}`} onClick={addDev}>{t('offerings.addDevotee')}</button>

      {/* Cart */}
      {validEntries.length>0 ? (
        <div className="cart-box">
          <h3 className={cx}>{t('offerings.cartTitle')}</h3>
          {validEntries.map(d=>{
            const items = OFFERINGS.filter(o=>d.offeringIds.includes(o.id));
            const sub   = items.reduce((s,o)=>s+o.price,0);
            return (
              <div className="cart-devotee" key={d.id}>
                <div className="cart-dv-name">
                  👤 {d.name}
                  <span style={{fontSize:'.8rem',fontWeight:400,color:'var(--color-deep-cream)',marginLeft:'.5rem'}}>
                    ({t('offerings.starLabel')}: <span className={cx}>{t(`starsData.${d.star}`)}</span>)
                  </span>
                </div>
                {items.map(o=>(
                  <div className="cart-row" key={o.id}>
                    <span>{o.icon} <span className={cx}>{t(`offeringsData.${o.key}.name`)}</span></span>
                    <span>₹{o.price.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                {d.date && (
                  <div style={{fontSize:'.78rem',color:'var(--color-light-gold)',marginTop:'.3rem',marginBottom:'.1rem'}}>
                    📅 {new Date(d.date+'T00:00:00').toLocaleDateString(isMl?'ml-IN':'en-IN',{day:'numeric',month:'long',year:'numeric'})}
                  </div>
                )}
                <div style={{textAlign:'right',fontSize:'.8rem',color:'var(--color-deep-cream)',opacity:.65,marginTop:'.25rem'}}>
                  {t('offerings.subtotal')}: ₹{sub.toLocaleString('en-IN')}
                </div>
              </div>
            );
          })}
          <div className="cart-grand">
            <span className={cx}>{t('offerings.grandTotal')}</span>
            <span>₹{grandTotal.toLocaleString('en-IN')}</span>
          </div>
          <button className={`btn-pay ${cx}`} onClick={handlePay} disabled={submitting}>
            {submitting
              ? t('offerings.submitting')
              : `${t('offerings.proceedPay')} — ₹${grandTotal.toLocaleString('en-IN')}`}
          </button>
          {submitError && (
            <p style={{color:'#EF4444',textAlign:'center',marginTop:'.7rem',fontSize:'.88rem'}} className={cx}>
              ⚠️ {submitError}
            </p>
          )}
        </div>
      ) : (
        <p className={`empty-state ${cx}`} style={{marginTop:'1.5rem'}}>{t('offerings.emptyPrompt')}</p>
      )}

      {showModal && (
        <div className="modal-ov" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="mb">🙏</div>
            <h3 className={cx}>{t('offerings.modalTitle')}</h3>
            <p className={cx}>{t('offerings.modalBody', { total: grandTotal.toLocaleString('en-IN'), names: validEntries.map(d=>d.name).join(', ') })}</p>
            {bookingId && (
              <p style={{marginTop:'1rem',fontSize:'.78rem',color:'var(--color-muted)',fontFamily:'monospace',background:'var(--color-deep-cream)',padding:'.4rem .8rem',borderRadius:'6px'}}>
                {t('offerings.bookingId')}: {bookingId}
              </p>
            )}
            <button className={cx} onClick={handleClose}>{t('offerings.modalClose')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
const PAGE_KEYS = ["Home","Schedule","Notices","Offerings"];

export default function App() {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState("en");
  const [page, setPage] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  
  const isMl = lang==='ml'; 
  const cx = isMl?'ml':'';

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang, i18n]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const NAV_LABELS = {
    Home: t('nav.home'), Schedule: t('nav.schedule'),
    Notices: t('nav.notices'), Offerings: t('nav.offerings'),
  };

  const go = p => { setPage(p); setMenuOpen(false); window.scrollTo({top:0,behavior:'smooth'}); };

  return (
    <>
      <Styles/>
      <nav className="nav">
        <div className="nav-inner">
          <a className="nav-logo" href="#" onClick={e=>{e.preventDefault();go("Home");}}>
            <span className="nav-logo-icon">🪔</span>
            <div>
              <div className={`nav-logo-name ${cx}`}>{t('templeNameShort')}</div>
              <div className="nav-logo-sub">ॐ ഭദ്രകാളി ദേവി നമഃ</div>
            </div>
          </a>

          <div className="nav-right">
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            {/* Language Toggle */}
            <div className="lang-toggle" title="Switch language / ഭാഷ മാറ്റുക">
              <button className={`lang-btn${lang==='en'?' active':''}`} onClick={()=>setLang('en')}>EN</button>
              <button className={`lang-btn${lang==='ml'?' active':''} ml`} onClick={()=>setLang('ml')}>മലയാളം</button>
            </div>
            <button className="hamburger" onClick={()=>setMenuOpen(o=>!o)} aria-label="Menu">
              <span/><span/><span/>
            </button>
          </div>

          <ul className={`nav-links${menuOpen?' open':''}`}>
            {PAGE_KEYS.map(p=>(
              <li key={p}>
                <button className={`${page===p?'active':''} ${cx}`} onClick={()=>go(p)}>
                  {NAV_LABELS[p]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {page==="Home"      && <HomePage      lang={lang}/>}
      {page==="Schedule"  && <SchedulePage  lang={lang}/>}
      {page==="Notices"   && <NoticePage    lang={lang}/>}
      {page==="Offerings" && <OfferingsPage lang={lang}/>}

      <footer className="footer">
        <p style={{fontFamily:"'Yatra One',cursive",fontSize:'1.1rem',color:'var(--color-gold)',marginBottom:'.4rem'}} className={cx}>
          🪔 {t('templeNameShort')}
        </p>
        <p className={cx}>{t('footer.contact')}</p>
        <p style={{marginTop:'.5rem'}} className={cx}>{t('footer.copy')}</p>
      </footer>
    </>
  );
}
