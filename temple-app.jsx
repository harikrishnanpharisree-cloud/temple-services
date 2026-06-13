import { useState } from "react";
import { createClient } from '@supabase/supabase-js';

// ── Supabase client ───────────────────────────────────────────────────────────
// Replace these two values with your own from:
// Supabase Dashboard → Project Settings → API
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function submitBooking(validEntries, grandTotal) {
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
               offering_name: o?.en ?? String(oid), price: (o?.price ?? 0) * 100 };
    });
    const { error: oErr } = await supabase.from('devotee_offerings').insert(rows);
    if (oErr) throw new Error(oErr.message);
  }
  return booking.id;
}


// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  maroon:    "#6B0F1A",
  darkMaroon:"#4A0910",
  gold:      "#C8973A",
  lightGold: "#E8BC6A",
  cream:     "#FDF6E3",
  deepCream: "#F5E9C8",
  orange:    "#D4521A",
  text:      "#2C1A00",
  muted:     "#7A5C3A",
};

// ── i18n strings ──────────────────────────────────────────────────────────────
const T = {
  en: {
    templeNameShort: "Panackal Bhadrakali Devi Temple",
    nav: { home:"Home", schedule:"Schedule", notices:"Notice Board", offerings:"Offerings" },
    hero: {
      title: "Panackal Bhadrakali Devi Temple",
      sub: "ॐ ഭദ്രകാളി ദേവീ നമഃ",
      desc: "A sacred abode of Maa Bhadrakali, the supreme form of Shakti — fierce yet compassionate, destroyer of evil, protector of the devoted. Nestled in Kerala's sacred landscape, this temple has blessed generations of devotees with grace and divine protection.",
      timing: "Morning: 5:00 AM – 1:00 PM  |  Evening: 5:30 PM – 9:00 PM",
      timingNote: "Special poojas may alter timings on festival days.",
      glance: "Temple Timings at a Glance",
    },
    home: {
      aboutTitle: "About the Temple",
      deity:    { h:"The Deity",    p:"Bhadrakali — the benevolent aspect of Kali — is worshipped here in the traditional Kerala Tantric tradition. She is depicted with eight arms, each holding a sacred weapon, standing upon the asura Darika." },
      history:  { h:"History & Origin", p:"The temple traces its origins over five centuries ago, consecrated by the Panackal family in accordance with Tantric rites of the Kalari tradition. The main idol is swayambhu — self-manifested." },
      festivals:{ h:"Festivals", items:["Meena Bharani (Grand Annual Festival)","Karkidaka Vavu — Ancestral offerings","Navarathri — Nine nights of worship","Mahashivarathri — All-night vigil"] },
      reach:    { h:"How to Reach", p:"Located in Kerala. Nearest bus stop: Panackal Junction (0.3 km). Nearest railway: Ernakulam (42 km). Parking available on the eastern side of the temple complex." },
    },
    schedule: {
      title: "Daily Pooja Schedule",
      cols: ["Pooja / Ritual","Time","Description"],
      hours:{ h:"Temple Open Hours",   items:["Morning: 5:00 AM – 1:00 PM","Evening: 5:30 PM – 9:00 PM","Festival Days: Open throughout"] },
      dress:{ h:"Dress Code",          items:["Men: Mundu (dhoti) preferred","Women: Saree or churidar with dupatta","No shorts or sleeveless attire inside the sanctum"] },
    },
    notices: {
      title: "Notice Board",
      tags: { festival:"🎉 Festival", important:"⚠️ Important", general:"ℹ️ General" },
    },
    offerings: {
      title: "Vazhipadu — Divine Offerings",
      subtitle: "Select the offerings you wish to dedicate to Maa Bhadrakali. Your name and birth star will be announced during the pooja.",
      devoteeTitle: "Devotee",
      nameLbl: "Full Name *", namePh: "e.g. Priya Krishnan",
      starLbl: "Birth Star (Nakshatra) *", starPh: "— Select Birth Star —",
      removeDevotee: "Remove",
      addDevotee: "+ Add Another Devotee",
      subtotal: "Subtotal",
      cartTitle: "🛕 Your Cart",
      starLabel: "Birth Star",
      dateLbl: "Preferred Date",
      grandTotal: "Grand Total",
      proceedPay: "🙏 Proceed to Pay",
      emptyPrompt: "☝️ Select offerings for a devotee to get started.",
      modalTitle: "May the Goddess Bless You!",
      modalBody: (total, names) => `Your offerings totalling ₹${total.toLocaleString('en-IN')} for ${names} have been received. In a production app, you would now be redirected to a secure payment gateway. Each offering will be performed on your chosen date.`,
      modalClose: "✓ Close",
    },
    footer: {
      contact: "For inquiries: templeinfo@panackaldevi.in  |  +91 98470 XXXXX",
      copy: "© 2026 Panackal Bhadrakali Devi Temple Trust. All rights reserved.",
    },
  },
  ml: {
    templeNameShort: "പനക്കൽ ഭദ്രകാളി ദേവി ക്ഷേത്രം",
    nav: { home:"ഹോം", schedule:"പൂജ സമയം", notices:"അറിയിപ്പ് ബോർഡ്", offerings:"വഴിപാടുകൾ" },
    hero: {
      title: "പനക്കൽ ഭദ്രകാളി ദേവി ക്ഷേത്രം",
      sub: "ॐ ഭദ്രകാളി ദേവീ നമഃ",
      desc: "ശക്തിയുടെ പരമോന്നത സ്വരൂപമായ ഭദ്രകാളി ദേവിയുടെ പരിപാവനമായ ആലയം — ദുഷ്ടനിഗ്രഹിണി, ഭക്തരക്ഷകി. കേരളത്തിന്റെ പുണ്യഭൂമിയിൽ, ഈ ക്ഷേത്രം തലമുറകളായി ഭക്തജനങ്ങൾക്ക് അനുഗ്രഹവും ദൈവിക സംരക്ഷണവും നൽകിപ്പോരുന്നു.",
      timing: "രാവിലെ: 5:00 – 1:00  |  വൈകിട്ട്: 5:30 – 9:00",
      timingNote: "ഉത്സവദിവസങ്ങളിൽ സമയം വ്യത്യാസപ്പെടാം.",
      glance: "ക്ഷേത്ര സമയ ചുരുക്കം",
    },
    home: {
      aboutTitle: "ക്ഷേത്രത്തെക്കുറിച്ച്",
      deity:    { h:"ദേവത",    p:"ഭദ്രകാളി — കാളിയുടെ ശുഭകരമായ ഭാവം — കേരളത്തിലെ തന്ത്ര പാരമ്പര്യമനുസരിച്ച് ഇവിടെ ആരാധിക്കപ്പെടുന്നു. അഷ്ടഭുജ ദേവി ദാരികനെ ചവിട്ടി നിൽക്കുന്ന രൂപത്തിലാണ് പ്രതിഷ്ഠ." },
      history:  { h:"ചരിത്രം", p:"അഞ്ച് നൂറ്റാണ്ടിലേറെ പഴക്കമുള്ള ഈ ക്ഷേത്രം പനക്കൽ കുടുംബം കളരി തന്ത്ര ആചാരങ്ങൾ അനുസരിച്ച് പ്രതിഷ്ഠ നടത്തി. മൂലബിംബം സ്വയംഭൂവാണ്." },
      festivals:{ h:"ഉത്സവങ്ങൾ", items:["മീനഭരണി (വലിയ വാർഷിക ഉത്സവം)","കർക്കടക വാവ് — പിതൃതർപ്പണം","നവരാത്രി — ഒൻപത് രാവ്","മഹാശിവരാത്രി — ഉറക്കമിളച്ച് ആരാധന"] },
      reach:    { h:"എത്തിച്ചേരാൻ", p:"കേരളത്തിൽ സ്ഥിതി ചെയ്യുന്നു. ഏറ്റവും അടുത്ത ബസ് സ്റ്റോപ്പ്: പനക്കൽ ജംഗ്ഷൻ (0.3 കി.മീ). ഏറ്റവും അടുത്ത റെയിൽവേ: എറണാകുളം (42 കി.മീ). ക്ഷേത്രത്തിന്റെ കിഴക്കുഭാഗത്ത് പാർക്കിംഗ് ഉണ്ട്." },
    },
    schedule: {
      title: "ദൈനംദിന പൂജ സമയക്രമം",
      cols: ["പൂജ / ചടങ്ങ്","സമയം","വിവരണം"],
      hours:{ h:"ക്ഷേത്ര തുറക്കൽ സമയം", items:["രാവിലെ: 5:00 – 1:00","വൈകിട്ട്: 5:30 – 9:00","ഉത്സവദിവസം: എല്ലാ സമയവും"] },
      dress:{ h:"വേഷം",                  items:["പുരുഷന്മാർ: മുണ്ട് അഭികാമ്യം","സ്ത്രീകൾ: സാരി അല്ലെങ്കിൽ ചുരിദാർ","ഉള്ളിൽ ഹാഫ് പാന്റ്സോ ബനിയനോ പാടില്ല"] },
    },
    notices: {
      title: "അറിയിപ്പ് ബോർഡ്",
      tags: { festival:"🎉 ഉത്സവം", important:"⚠️ പ്രധാനം", general:"ℹ️ പൊതു" },
    },
    offerings: {
      title: "വഴിപാടുകൾ",
      subtitle: "ഭദ്രകാളി ദേവിക്ക് സമർപ്പിക്കാൻ ആഗ്രഹിക്കുന്ന വഴിപാടുകൾ തിരഞ്ഞെടുക്കുക. പൂജ സമയത്ത് നിങ്ങളുടെ പേരും ജന്മ നക്ഷത്രവും പ്രഖ്യാപിക്കും.",
      devoteeTitle: "ഭക്തൻ",
      nameLbl: "പൂർണ്ണ നാമം *", namePh: "ഉദാ: പ്രിയ കൃഷ്ണൻ",
      starLbl: "ജന്മ നക്ഷത്രം *", starPh: "— നക്ഷത്രം തിരഞ്ഞെടുക്കുക —",
      removeDevotee: "നീക്കം ചെയ്യുക",
      addDevotee: "+ മറ്റൊരു ഭക്തനെ ചേർക്കുക",
      subtotal: "ഉപ-ആകെ",
      cartTitle: "🛕 നിങ്ങളുടെ കാർട്ട്",
      starLabel: "നക്ഷത്രം",
      dateLbl: "ആഗ്രഹിക്കുന്ന തീയതി",
      grandTotal: "ആകെ തുക",
      proceedPay: "🙏 പേയ്‌മെന്റ് തുടരുക",
      emptyPrompt: "☝️ ഒരു ഭക്തനുവേണ്ടി വഴിപാടുകൾ തിരഞ്ഞെടുക്കുക.",
      modalTitle: "ദേവി അനുഗ്രഹിക്കട്ടെ!",
      modalBody: (total, names) => `${names} എന്നിവർക്കായി ₹${total.toLocaleString('en-IN')} തുകയുടെ വഴിപാടുകൾ സ്വീകരിച്ചു. Razorpay / PhonePe / UPI വഴി പേയ്‌മെന്റ് നടക്കും.`,
      modalClose: "✓ അടയ്ക്കുക",
    },
    footer: {
      contact: "ബന്ധപ്പെടുക: templeinfo@panackaldevi.in  |  +91 98470 XXXXX",
      copy: "© 2026 പനക്കൽ ഭദ്രകാളി ദേവി ക്ഷേത്ര ട്രസ്റ്റ്. എല്ലാ അവകാശങ്ങളും നിക്ഷിപ്തം.",
    },
  },
};

// ── Static data ───────────────────────────────────────────────────────────────
const SCHEDULE_DATA = [
  { en:"Nirmalya Darshanam", ml:"നിർമ്മാല്യ ദർശനം", time:"5:00 AM",  descEn:"Morning cleansing ritual",   descMl:"പ്രഭാത ശുദ്ധീകരണ ചടങ്ങ്" },
  { en:"Usha Pooja",         ml:"ഉഷഃ പൂജ",           time:"6:00 AM",  descEn:"Dawn worship with lamps",    descMl:"വിളക്ക് കൊളുത്തി ഉഷഃ പൂജ" },
  { en:"Pantheeradi Pooja",  ml:"പന്തീരടി പൂജ",      time:"12:00 PM", descEn:"Midday offering",             descMl:"ഉച്ചയ്ക്കുള്ള പൂജ" },
  { en:"Uchapooja",          ml:"ഉച്ചപ്പൂജ",          time:"12:30 PM", descEn:"Main noon ritual",            descMl:"പ്രധാന ഉച്ചപ്പൂജ" },
  { en:"Deeparadhana",       ml:"ദീപാരാധന",           time:"6:00 PM",  descEn:"Evening lamp offering",       descMl:"സന്ധ്യദീപം" },
  { en:"Athazhapooja",       ml:"അത്താഴ പൂജ",         time:"8:00 PM",  descEn:"Night worship",               descMl:"രാത്രി പൂജ" },
  { en:"Thrippuka",          ml:"തൃപ്പുക",             time:"8:45 PM",  descEn:"Final closing ritual",        descMl:"അവസാന ചടങ്ങ്" },
];

const NOTICES = [
  { date:"Feb 20, 2026", dateMl:"2026 ഫെബ്രുവരി 20", tag:"festival",
    en:{ title:"Sivarathri Special Pooja – Feb 26", body:"Special Mahashivarathri celebrations will be held on Feb 26. Ashtayamam from 6 AM through midnight. Devotees are welcome to participate in all eight sessions." },
    ml:{ title:"ശിവരാത്രി വിശേഷ പൂജ – ഫെബ്. 26", body:"ഫെബ്. 26-ന് മഹാശിവരാത്രി ആഘോഷം. രാവിലെ 6 മുതൽ അർദ്ധരാത്രി വരെ അഷ്ടയാമം. ഭക്തർക്ക് എല്ലാ ഘട്ടങ്ങളിലും പങ്കെടുക്കാം." } },
  { date:"Feb 18, 2026", dateMl:"2026 ഫെബ്രുവരി 18", tag:"important",
    en:{ title:"Temple Renovation – North Entrance Closed", body:"The north entrance of the temple will be closed from Feb 22 to March 10 due to ongoing renovation work. Kindly use the east entrance during this period." },
    ml:{ title:"ക്ഷേത്ര നവീകരണം – വടക്കേ കവാടം അടഞ്ഞിരിക്കും", body:"നവീകരണ പ്രവൃത്തി കാരണം ഫെബ്. 22 മുതൽ മാർ. 10 വരെ വടക്കേ കവാടം അടഞ്ഞിരിക്കും. ഈ കാലഘട്ടത്തിൽ കിഴക്കേ കവാടം ഉപയോഗിക്കുക." } },
  { date:"Feb 15, 2026", dateMl:"2026 ഫെബ്രുവരി 15", tag:"general",
    en:{ title:"Online Offerings Now Available", body:"Devotees can now book and pay for Vazhipadu (offerings) online. Your name and birth star will be announced during the pooja." },
    ml:{ title:"ഓൺലൈൻ വഴിപാട് ഇനി ലഭ്യം", body:"ഭക്തർക്ക് ഇനി ഓൺലൈനായി വഴിപാട് ബുക്ക് ചെയ്ത് പണം അടക്കാം. പൂജ സമയത്ത് പേരും നക്ഷത്രവും പ്രഖ്യാപിക്കും." } },
  { date:"Feb 10, 2026", dateMl:"2026 ഫെബ്രുവരി 10", tag:"festival",
    en:{ title:"Meena Bharani Festival – March 14", body:"The annual Meena Bharani festival — the grandest celebration — will be held on March 14. Special poojas from 4 AM. Prasadam distribution at noon." },
    ml:{ title:"മീനഭരണി ഉത്സവം – മാർ. 14", body:"വർഷംതോറും നടക്കുന്ന മഹോത്സവം — മീനഭരണി — മാർ. 14-ന്. രാവിലെ 4 മുതൽ പ്രത്യേക പൂജകൾ. ഉച്ചക്ക് പ്രസാദ വിതരണം." } },
];

const STAR_NAMES = [
  {en:"Ashwini",ml:"അശ്വതി"},{en:"Bharani",ml:"ഭരണി"},{en:"Krittika",ml:"കാർത്തിക"},
  {en:"Rohini",ml:"രോഹിണി"},{en:"Mrigashira",ml:"മകയിരം"},{en:"Ardra",ml:"തിരുവാതിര"},
  {en:"Punarvasu",ml:"പുനർതം"},{en:"Pushya",ml:"പൂയം"},{en:"Ashlesha",ml:"ആയില്യം"},
  {en:"Magha",ml:"മകം"},{en:"Purva Phalguni",ml:"പൂരം"},{en:"Uttara Phalguni",ml:"ഉത്രം"},
  {en:"Hasta",ml:"അത്തം"},{en:"Chitra",ml:"ചിത്തിര"},{en:"Swati",ml:"ചോതി"},
  {en:"Vishakha",ml:"വിശാഖം"},{en:"Anuradha",ml:"അനിഴം"},{en:"Jyeshtha",ml:"തൃക്കേട്ട"},
  {en:"Moola",ml:"മൂലം"},{en:"Purva Ashadha",ml:"പൂരാടം"},{en:"Uttara Ashadha",ml:"ഉത്രാടം"},
  {en:"Shravana",ml:"തിരുവോണം"},{en:"Dhanishtha",ml:"അവിട്ടം"},{en:"Shatabhisha",ml:"ചതയം"},
  {en:"Purva Bhadrapada",ml:"പൂരൂരുട്ടാതി"},{en:"Uttara Bhadrapada",ml:"ഉത്തൃട്ടാതി"},{en:"Revati",ml:"രേവതി"},
];

const OFFERINGS = [
  {id:1,icon:"🌺",en:"Pushpanjali",            ml:"പുഷ്പാഞ്ജലി",               price:51,   descEn:"Flower offering with chanting of sacred mantras.",                    descMl:"മന്ത്രോച്ചാരണത്തോടെ പൂർണ്ണ പുഷ്പാഞ്ജലി."},
  {id:2,icon:"🕯️",en:"Nilavilakku Pooja",      ml:"നിലവിളക്ക് പൂജ",            price:101,  descEn:"Brass lamp offering symbolising Bhadrakali's divine light.",           descMl:"ഭദ്രകാളിയുടെ ദൈവിക പ്രകാശം പ്രതിനിധീകരിക്കുന്ന നിലവിളക്ക് പൂജ."},
  {id:3,icon:"🍚",en:"Nivedyam (Aval & Sharkkara)",ml:"നിവേദ്യം (അവൽ & ശർക്കര)",price:151,descEn:"Traditional offering of flattened rice with jaggery.",               descMl:"ദേവിക്ക് ഏറ്റവും ഇഷ്ടമായ അവൽ നിവേദ്യം."},
  {id:4,icon:"🌿",en:"Manjal Thettiyathu",      ml:"മഞ്ഞൾ തേട്ടിയതു",          price:201,  descEn:"Turmeric-soaked threads for protection and prosperity.",               descMl:"സംരക്ഷണത്തിനും ഐശ്വര്യത്തിനുമായി മഞ്ഞൾ ചരട് സമർപ്പണം."},
  {id:5,icon:"🔥",en:"Deepa Pooja (101 Diyas)", ml:"ദീപ പൂജ (101 ദീപം)",       price:501,  descEn:"Lighting of 101 earthen lamps encircling the sanctum.",                descMl:"ശ്രീകോവിലിനു ചുറ്റും 101 മൺദീപം കൊളുത്തൽ."},
  {id:6,icon:"🐓",en:"Kuruthikala (Symbolic)",  ml:"കുരുതി കള (പ്രതീകം)",      price:751,  descEn:"Symbolic traditional blood offering; fully sanctioned.",              descMl:"പരമ്പരാഗത കുരുതി വഴിപാടിന്റെ പ്രതീകം; പൂർണ്ണമായി അനുവദിക്കപ്പെട്ടത്."},
  {id:7,icon:"🎺",en:"Thalamudiyatu (Chendamelam)",ml:"ചെണ്ടമേളം",             price:1001, descEn:"Percussion ensemble dedicated to the Goddess — classical Kerala drum.",  descMl:"ദേവിക്ക് സമർപ്പിക്കുന്ന ചെണ്ടമേളം."},
  {id:8,icon:"🌹",en:"Poomudu & Vastra Samarpanam",ml:"പൂമുടിയും വസ്ത്ര സമർപ്പണം",price:1251,descEn:"Fresh flower garlands and sacred cloth offered to the Goddess.",   descMl:"ദേവിക്ക് പൂമാല അണിയിക്കലും വസ്ത്ര സമർപ്പണവും."},
  {id:9,icon:"⭐",en:"Ashtabhuja Archana",       ml:"അഷ്ടഭുജ അർച്ചന",          price:251,  descEn:"Archana to all eight arms of Bhadrakali with 108 names.",              descMl:"108 നാമങ്ങൾ ജപിച്ചുകൊണ്ട് അഷ്ടഭുജ അർച്ചന."},
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Yatra+One&family=Noto+Serif+Malayalam:wght@400;600;700&family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:${C.cream};font-family:'Noto Serif',serif;color:${C.text}}
    .ml{font-family:'Noto Serif Malayalam',serif}
    ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${C.deepCream}}::-webkit-scrollbar-thumb{background:${C.gold};border-radius:3px}

    /* NAV */
    .nav{position:sticky;top:0;z-index:100;background:${C.darkMaroon};border-bottom:3px solid ${C.gold};box-shadow:0 4px 20px rgba(0,0,0,.5)}
    .nav-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:0 1rem;gap:.5rem;flex-wrap:wrap}
    .nav-logo{display:flex;align-items:center;gap:.7rem;padding:.7rem 0;text-decoration:none;flex-shrink:0}
    .nav-logo-icon{font-size:2rem}
    .nav-logo-name{color:${C.lightGold};font-family:'Yatra One',cursive;font-size:.9rem;line-height:1.2}
    .nav-logo-sub{color:${C.gold};font-size:.65rem;opacity:.8}
    .nav-right{display:flex;align-items:center;gap:.5rem}
    .lang-toggle{display:flex;background:rgba(255,255,255,.08);border-radius:20px;padding:3px;border:1px solid rgba(200,151,58,.3)}
    .lang-btn{background:none;border:none;cursor:pointer;color:${C.gold};font-size:.75rem;font-weight:700;padding:.22rem .65rem;border-radius:16px;transition:all .2s;white-space:nowrap;line-height:1.4}
    .lang-btn.active{background:${C.gold};color:${C.darkMaroon}}
    .hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;padding:.5rem}
    .hamburger span{display:block;width:24px;height:2px;background:${C.gold};border-radius:2px}
    .nav-links{display:flex;gap:.2rem;list-style:none}
    .nav-links button{background:none;border:none;cursor:pointer;color:${C.lightGold};font-size:.87rem;padding:.5rem .75rem;border-radius:4px;transition:background .2s,color .2s;white-space:nowrap}
    .nav-links button:hover,.nav-links button.active{background:${C.gold};color:${C.darkMaroon};font-weight:700}
    @media(max-width:768px){
      .hamburger{display:flex}
      .nav-links{display:none;flex-direction:column;gap:0;position:absolute;top:100%;left:0;right:0;background:${C.darkMaroon};border-bottom:3px solid ${C.gold};padding:.5rem 0}
      .nav-links.open{display:flex}
      .nav-links button{width:100%;text-align:left;padding:.8rem 1.5rem;border-radius:0}
    }

    /* HERO */
    .hero{background:linear-gradient(160deg,${C.darkMaroon} 0%,${C.maroon} 40%,${C.orange} 100%);position:relative;overflow:hidden;text-align:center;padding:4rem 1.5rem 5rem}
    .hero::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 30px,rgba(200,151,58,.05) 30px,rgba(200,151,58,.05) 31px)}
    .hero-diya{font-size:3.5rem;animation:flicker 2s ease-in-out infinite alternate}
    @keyframes flicker{0%{transform:scale(1) rotate(-3deg);filter:brightness(1)}100%{transform:scale(1.08) rotate(3deg);filter:brightness(1.3)}}
    .hero h1{font-family:'Yatra One',cursive;color:${C.lightGold};font-size:clamp(1.6rem,5vw,3rem);text-shadow:0 2px 20px rgba(0,0,0,.6);margin:.5rem 0 .3rem}
    .hero-sub{color:${C.gold};font-style:italic;font-size:clamp(.85rem,2.5vw,1.1rem);opacity:.9}
    .hero-divider{width:200px;height:3px;margin:1.5rem auto;background:linear-gradient(90deg,transparent,${C.gold},transparent)}
    .hero-desc{color:${C.deepCream};max-width:600px;margin:0 auto;line-height:1.9;font-size:.95rem}

    /* SECTION */
    .section{max-width:1100px;margin:0 auto;padding:3rem 1.5rem}
    .section-title{font-family:'Yatra One',cursive;color:${C.maroon};font-size:clamp(1.4rem,4vw,2rem);text-align:center;margin-bottom:.5rem}
    .section-rule{width:120px;height:3px;margin:0 auto 2.5rem;background:linear-gradient(90deg,transparent,${C.gold},transparent)}
    .om{text-align:center;color:${C.gold};font-size:1.2rem;margin:2rem 0;opacity:.6}

    /* CARDS */
    .card-grid{display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(255px,1fr))}
    .card{background:#fff;border:1px solid ${C.deepCream};border-top:4px solid ${C.gold};border-radius:8px;padding:1.5rem;box-shadow:0 4px 16px rgba(0,0,0,.07);transition:transform .2s,box-shadow .2s}
    .card:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(107,15,26,.15)}
    .card-icon{font-size:2rem;margin-bottom:.7rem}
    .card h3{color:${C.maroon};font-size:1.1rem;margin-bottom:.5rem}
    .card p,.card li{color:${C.muted};font-size:.9rem;line-height:1.8}
    .card ul{padding-left:1rem}

    /* SCHEDULE */
    .schedule-table{width:100%;border-collapse:collapse;margin-top:1rem}
    .schedule-table th{background:${C.maroon};color:${C.lightGold};font-family:'Yatra One',cursive;font-size:1rem;padding:.8rem 1rem;text-align:left}
    .schedule-table td{padding:.75rem 1rem;border-bottom:1px solid ${C.deepCream};font-size:.9rem}
    .schedule-table tr:nth-child(even) td{background:${C.deepCream}}
    .schedule-table tr:hover td{background:#FFF0D0}
    .time-badge{display:inline-block;background:${C.maroon};color:${C.lightGold};border-radius:20px;padding:.15rem .7rem;font-size:.8rem;font-weight:600}

    /* NOTICE */
    .notice-card{background:#FFFBF0;border-left:5px solid ${C.gold};border-radius:6px;padding:1.2rem 1.5rem;margin-bottom:1rem;box-shadow:0 2px 8px rgba(0,0,0,.06)}
    .notice-card h4{color:${C.maroon};margin-bottom:.4rem}
    .notice-card p{color:${C.muted};font-size:.9rem;line-height:1.7}
    .notice-date{font-size:.78rem;color:${C.gold};font-weight:600;margin-bottom:.4rem}
    .notice-tag{display:inline-block;font-size:.72rem;padding:.1rem .6rem;border-radius:12px;margin-right:.4rem;margin-bottom:.5rem;font-weight:700}
    .tag-festival{background:#FEF3C7;color:#92400E}
    .tag-important{background:#FEE2E2;color:#991B1B}
    .tag-general{background:#DCFCE7;color:#166534}

    /* OFFERINGS PAGE */
    .devotee-block{background:#FFF8ED;border:1.5px solid ${C.deepCream};border-radius:12px;padding:1.5rem;margin-bottom:1.2rem;transition:box-shadow .2s}
    .devotee-block:focus-within{box-shadow:0 0 0 3px rgba(200,151,58,.2)}
    .dv-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
    .dv-title{color:${C.maroon};font-family:'Yatra One',cursive;font-size:1.05rem}
    .btn-rm-dv{background:none;border:1px solid #ddd;color:${C.muted};border-radius:6px;cursor:pointer;padding:.22rem .65rem;font-size:.78rem;transition:all .2s}
    .btn-rm-dv:hover{background:#FEE2E2;color:#991B1B;border-color:#FCA5A5}

    /* mini offerings checkboxes */
    .mini-grid{display:grid;gap:.5rem;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));margin-bottom:1rem}
    .mini-item{display:flex;align-items:center;gap:.5rem;padding:.45rem .7rem;border:1.5px solid ${C.deepCream};border-radius:8px;cursor:pointer;transition:all .2s;background:#fff;font-size:.84rem;user-select:none}
    .mini-item:hover{border-color:${C.gold}}
    .mini-item.sel{border-color:${C.maroon};background:#FFF0E0}
    .mini-item input[type=checkbox]{accent-color:${C.maroon};width:14px;height:14px;flex-shrink:0;pointer-events:none}
    .mini-price{margin-left:auto;font-weight:700;color:${C.maroon};font-size:.8rem;white-space:nowrap}

    /* form */
    .form-row{display:grid;gap:1rem;margin-bottom:.5rem}
    @media(max-width:700px){.form-row{grid-template-columns:1fr!important}}
    .fg{display:flex;flex-direction:column;gap:.35rem}
    .fg label{font-size:.8rem;font-weight:600;color:${C.muted}}
    .fg input,.fg select{border:1.5px solid ${C.deepCream};border-radius:6px;padding:.55rem .85rem;font-family:'Noto Serif',serif;font-size:.9rem;color:${C.text};background:#fff;transition:border-color .2s}
    .fg input:focus,.fg select:focus{outline:none;border-color:${C.gold}}

    .subtotal-hint{text-align:right;font-size:.82rem;color:${C.muted};margin-top:.4rem}

    .btn-add-dv{width:100%;padding:.8rem;background:transparent;border:2px dashed ${C.gold};color:${C.maroon};font-family:'Yatra One',cursive;font-size:1rem;border-radius:10px;cursor:pointer;margin-top:.5rem;transition:all .2s}
    .btn-add-dv:hover{background:#FFF0D0}

    /* CART */
    .cart-box{background:${C.darkMaroon};border-radius:12px;padding:1.5rem;margin-top:2rem}
    .cart-box h3{color:${C.lightGold};font-family:'Yatra One',cursive;font-size:1.3rem;margin-bottom:1rem;border-bottom:1px solid rgba(200,151,58,.25);padding-bottom:.7rem}
    .cart-devotee{margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid rgba(200,151,58,.12)}
    .cart-dv-name{color:${C.gold};font-weight:700;font-size:.93rem;margin-bottom:.4rem}
    .cart-row{display:flex;justify-content:space-between;font-size:.87rem;color:${C.deepCream};margin-bottom:.25rem}
    .cart-grand{display:flex;justify-content:space-between;font-size:1.2rem;font-weight:700;color:${C.gold};border-top:1px solid rgba(200,151,58,.3);margin-top:.8rem;padding-top:.8rem}

    .btn-pay{width:100%;margin-top:1.5rem;padding:1rem;background:linear-gradient(135deg,${C.gold},${C.orange});color:#fff;font-family:'Yatra One',cursive;font-size:1.2rem;border:none;border-radius:8px;cursor:pointer;box-shadow:0 4px 16px rgba(212,82,26,.4);transition:transform .2s,box-shadow .2s}
    .btn-pay:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(212,82,26,.5)}
    .btn-pay:disabled{opacity:.5;cursor:not-allowed;transform:none}

    /* MODAL */
    .modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:center;justify-content:center;padding:1rem}
    .modal{background:${C.cream};border-radius:12px;padding:2.5rem;max-width:430px;width:100%;border-top:6px solid ${C.gold};text-align:center}
    .modal .mb{font-size:3.5rem;margin-bottom:1rem}
    .modal h3{color:${C.maroon};font-family:'Yatra One',cursive;font-size:1.5rem;margin-bottom:.7rem}
    .modal p{color:${C.muted};line-height:1.85;font-size:.9rem}
    .modal button{margin-top:1.5rem;padding:.7rem 2rem;background:${C.maroon};color:${C.lightGold};border:none;border-radius:6px;cursor:pointer;font-family:'Yatra One',cursive;font-size:1rem}

    .empty-state{text-align:center;color:${C.muted};padding:2rem;font-style:italic}

    /* FOOTER */
    .footer{background:${C.darkMaroon};color:${C.gold};border-top:3px solid ${C.gold};text-align:center;padding:2rem 1.5rem;font-size:.85rem;line-height:2}
    .footer p{color:${C.deepCream};opacity:.7}

    .timing-bar{background:${C.darkMaroon};padding:2.5rem 1.5rem;text-align:center}
  `}</style>
);

// ── Helper ────────────────────────────────────────────────────────────────────
let _uid = 1;
const newDevotee = () => ({ id: _uid++, name:'', star:'', date:'', offeringIds:[] });

// Today's date as min value for date picker
const TODAY = new Date().toISOString().split('T')[0];

// ── Pages ─────────────────────────────────────────────────────────────────────
function HomePage({ lang }) {
  const t = T[lang]; const isMl = lang==='ml';
  const cx = isMl ? 'ml' : '';
  return (
    <>
      <div className="hero">
        <div className="hero-diya">🪔</div>
        <h1 className={cx}>{t.hero.title}</h1>
        <div className="hero-sub">{t.hero.sub}</div>
        <div className="hero-divider"/>
        <p className={`hero-desc ${cx}`}>{t.hero.desc}</p>
      </div>
      <div className="section">
        <h2 className={`section-title ${cx}`}>{t.home.aboutTitle}</h2>
        <div className="section-rule"/>
        <div className="card-grid">
          <div className="card"><div className="card-icon">🛕</div><h3 className={cx}>{t.home.deity.h}</h3><p className={cx}>{t.home.deity.p}</p></div>
          <div className="card"><div className="card-icon">📜</div><h3 className={cx}>{t.home.history.h}</h3><p className={cx}>{t.home.history.p}</p></div>
          <div className="card"><div className="card-icon">🌺</div><h3 className={cx}>{t.home.festivals.h}</h3><ul>{t.home.festivals.items.map((x,i)=><li className={cx} key={i}>{x}</li>)}</ul></div>
          <div className="card"><div className="card-icon">📍</div><h3 className={cx}>{t.home.reach.h}</h3><p className={cx}>{t.home.reach.p}</p></div>
        </div>
      </div>
      <div className="timing-bar">
        <p style={{color:C.lightGold,fontFamily:"'Yatra One',cursive",fontSize:'1.3rem',marginBottom:'.5rem'}} className={cx}>{t.hero.glance}</p>
        <p style={{color:C.deepCream,opacity:.8,fontSize:'.9rem'}} className={cx}>{t.hero.timing}</p>
        <p style={{color:C.gold,fontSize:'.8rem',marginTop:'.5rem',opacity:.7}} className={cx}>{t.hero.timingNote}</p>
      </div>
    </>
  );
}

function SchedulePage({ lang }) {
  const t = T[lang]; const isMl = lang==='ml'; const cx = isMl?'ml':'';
  return (
    <div className="section">
      <h2 className={`section-title ${cx}`}>{t.schedule.title}</h2>
      <div className="section-rule"/>
      <div style={{overflowX:'auto'}}>
        <table className="schedule-table">
          <thead><tr>{t.schedule.cols.map((c,i)=><th key={i} className={cx}>{c}</th>)}</tr></thead>
          <tbody>
            {SCHEDULE_DATA.map((r,i)=>(
              <tr key={i}>
                <td style={{fontWeight:600,color:C.maroon}} className={cx}>{isMl?r.ml:r.en}</td>
                <td><span className="time-badge">{r.time}</span></td>
                <td className={cx}>{isMl?r.descMl:r.descEn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="om">ॐ &nbsp;✦&nbsp; ॐ &nbsp;✦&nbsp; ॐ</div>
      <div className="card-grid">
        <div className="card"><div className="card-icon">🕔</div><h3 className={cx}>{t.schedule.hours.h}</h3><ul>{t.schedule.hours.items.map((x,i)=><li className={cx} key={i}>{x}</li>)}</ul></div>
        <div className="card"><div className="card-icon">📋</div><h3 className={cx}>{t.schedule.dress.h}</h3><ul>{t.schedule.dress.items.map((x,i)=><li className={cx} key={i}>{x}</li>)}</ul></div>
      </div>
    </div>
  );
}

function NoticePage({ lang }) {
  const t = T[lang]; const isMl = lang==='ml'; const cx = isMl?'ml':'';
  const tagCls = {festival:'tag-festival',important:'tag-important',general:'tag-general'};
  return (
    <div className="section">
      <h2 className={`section-title ${cx}`}>{t.notices.title}</h2>
      <div className="section-rule"/>
      {NOTICES.map((n,i)=>(
        <div className="notice-card" key={i}>
          <span className={`notice-tag ${tagCls[n.tag]}`}>{t.notices.tags[n.tag]}</span>
          <div className="notice-date">{isMl?n.dateMl:n.date}</div>
          <h4 className={cx}>{n[lang].title}</h4>
          <p className={cx}>{n[lang].body}</p>
        </div>
      ))}
    </div>
  );
}

function OfferingsPage({ lang }) {
  const t = T[lang]; const isMl = lang==='ml'; const cx = isMl?'ml':'';
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
      const id = await submitBooking(validEntries, grandTotal);
      setBookingId(id);
      setShowModal(true);
      // TODO: after this, create a Razorpay order using bookingId
      // and open the Razorpay checkout. On success, your webhook
      // will mark the booking as 'confirmed' in Supabase.
    } catch (err) {
      setSubmitError(isMl
        ? 'ബുക്കിംഗ് പരാജയപ്പെട്ടു. വീണ്ടും ശ്രമിക്കുക.'
        : 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="section">
      <h2 className={`section-title ${cx}`}>{t.offerings.title}</h2>
      <div className="section-rule"/>
      <p style={{textAlign:'center',color:C.muted,marginBottom:'2rem',fontStyle:'italic',fontSize:'.95rem'}} className={cx}>{t.offerings.subtitle}</p>

      {cart.map((dev,idx)=>{
        const sub = dev.offeringIds.reduce((s,oid)=>s+(OFFERINGS.find(o=>o.id===oid)?.price||0),0);
        return (
          <div className="devotee-block" key={dev.id}>
            <div className="dv-header">
              <span className={`dv-title ${cx}`}>
                {t.offerings.devoteeTitle} {idx+1}
                {dev.name && <span style={{color:C.muted,fontSize:'.82rem',fontWeight:400,marginLeft:'.5rem'}}>— {dev.name}</span>}
              </span>
              {cart.length>1 &&
                <button className={`btn-rm-dv ${cx}`} onClick={()=>rmDev(dev.id)}>{t.offerings.removeDevotee}</button>}
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
                    <span className={cx}>{isMl?o.ml:o.en}</span>
                    <span className="mini-price">₹{o.price.toLocaleString('en-IN')}</span>
                  </div>
                );
              })}
            </div>

            {/* Name + Star + Date */}
            <div className="form-row" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
              <div className="fg">
                <label className={cx}>{t.offerings.nameLbl}</label>
                <input className={cx} placeholder={t.offerings.namePh} value={dev.name}
                  onChange={e=>updDev(dev.id,'name',e.target.value)}/>
              </div>
              <div className="fg">
                <label className={cx}>{t.offerings.starLbl}</label>
                <select className={cx} value={dev.star} onChange={e=>updDev(dev.id,'star',e.target.value)}>
                  <option value="">{t.offerings.starPh}</option>
                  {STAR_NAMES.map(s=><option key={s.en} value={s.en}>{isMl?s.ml:s.en}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className={cx}>📅 {t.offerings.dateLbl}</label>
                <input type="date" min={TODAY} value={dev.date||''}
                  onChange={e=>updDev(dev.id,'date',e.target.value)}/>
              </div>
            </div>
            {dev.offeringIds.length>0 &&
              <p className="subtotal-hint">{t.offerings.subtotal}: <strong style={{color:C.maroon}}>₹{sub.toLocaleString('en-IN')}</strong></p>}
          </div>
        );
      })}

      <button className={`btn-add-dv ${cx}`} onClick={addDev}>{t.offerings.addDevotee}</button>

      {/* Cart */}
      {validEntries.length>0 ? (
        <div className="cart-box">
          <h3 className={cx}>{t.offerings.cartTitle}</h3>
          {validEntries.map(d=>{
            const items = OFFERINGS.filter(o=>d.offeringIds.includes(o.id));
            const sub   = items.reduce((s,o)=>s+o.price,0);
            const star  = STAR_NAMES.find(s=>s.en===d.star);
            return (
              <div className="cart-devotee" key={d.id}>
                <div className="cart-dv-name">
                  👤 {d.name}
                  <span style={{fontSize:'.8rem',fontWeight:400,color:C.deepCream,marginLeft:'.5rem'}}>
                    ({t.offerings.starLabel}: <span className={cx}>{isMl&&star?star.ml:d.star}</span>)
                  </span>
                </div>
                {items.map(o=>(
                  <div className="cart-row" key={o.id}>
                    <span>{o.icon} <span className={cx}>{isMl?o.ml:o.en}</span></span>
                    <span>₹{o.price.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                {d.date && (
                  <div style={{fontSize:'.78rem',color:C.lightGold,marginTop:'.3rem',marginBottom:'.1rem'}}>
                    📅 {new Date(d.date+'T00:00:00').toLocaleDateString(isMl?'ml-IN':'en-IN',{day:'numeric',month:'long',year:'numeric'})}
                  </div>
                )}
                <div style={{textAlign:'right',fontSize:'.8rem',color:C.deepCream,opacity:.65,marginTop:'.25rem'}}>
                  {t.offerings.subtotal}: ₹{sub.toLocaleString('en-IN')}
                </div>
              </div>
            );
          })}
          <div className="cart-grand">
            <span className={cx}>{t.offerings.grandTotal}</span>
            <span>₹{grandTotal.toLocaleString('en-IN')}</span>
          </div>
          <button className={`btn-pay ${cx}`} onClick={handlePay} disabled={submitting}>
            {submitting
              ? (isMl ? '⏳ സമർപ്പിക്കുന്നു...' : '⏳ Submitting...')
              : `${t.offerings.proceedPay} — ₹${grandTotal.toLocaleString('en-IN')}`}
          </button>
          {submitError && (
            <p style={{color:'#EF4444',textAlign:'center',marginTop:'.7rem',fontSize:'.88rem'}} className={cx}>
              ⚠️ {submitError}
            </p>
          )}
        </div>
      ) : (
        <p className={`empty-state ${cx}`} style={{marginTop:'1.5rem'}}>{t.offerings.emptyPrompt}</p>
      )}

      {showModal && (
        <div className="modal-ov" onClick={()=>setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="mb">🙏</div>
            <h3 className={cx}>{t.offerings.modalTitle}</h3>
            <p className={cx}>{t.offerings.modalBody(grandTotal, validEntries.map(d=>d.name).join(', '))}</p>
            {bookingId && (
              <p style={{marginTop:'1rem',fontSize:'.78rem',color:C.muted,fontFamily:'monospace',background:C.deepCream,padding:'.4rem .8rem',borderRadius:'6px'}}>
                {isMl?'ബുക്കിംഗ് ID':'Booking ID'}: {bookingId}
              </p>
            )}
            <button className={cx} onClick={handleClose}>{t.offerings.modalClose}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
const PAGE_KEYS = ["Home","Schedule","Notices","Offerings"];

export default function App() {
  const [lang, setLang] = useState("en");
  const [page, setPage] = useState("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const isMl = lang==='ml'; const cx = isMl?'ml':'';

  const NAV_LABELS = {
    Home: T[lang].nav.home, Schedule: T[lang].nav.schedule,
    Notices: T[lang].nav.notices, Offerings: T[lang].nav.offerings,
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
              <div className={`nav-logo-name ${cx}`}>{T[lang].templeNameShort}</div>
              <div className="nav-logo-sub">ॐ ഭദ്രകാളി ദേവി നമഃ</div>
            </div>
          </a>

          <div className="nav-right">
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
        <p style={{fontFamily:"'Yatra One',cursive",fontSize:'1.1rem',color:C.gold,marginBottom:'.4rem'}} className={cx}>
          🪔 {T[lang].templeNameShort}
        </p>
        <p className={cx}>{T[lang].footer.contact}</p>
        <p style={{marginTop:'.5rem'}} className={cx}>{T[lang].footer.copy}</p>
      </footer>
    </>
  );
}
