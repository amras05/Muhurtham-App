// ============================================================
// Gayatri Jyotirnidhi · component: panchang lookup panel
// ============================================================

// The place chosen on the Panchang page (a region, or a searched place), shared by the
// Day and Month tabs. Returns { lat, lon, tz_offset, place_name }, or null after showing why.
async function resolvePanchangPlace() {
  const regionId = el("regionSelect").value;
  if (!regionId) {
    setStatus("Pick a region first.", true);
    return null;
  }
  if (regionId === "custom") {
    const query = el("customPlaceInput").value.trim();
    if (!query) {
      setStatus("Please enter a place name to search.", true);
      return null;
    }
    setStatus("Geocoding custom location...");
    try {
      const geoRes = await fetch(`${API_BASE}/geocode?place=${encodeURIComponent(query)}`);
      if (!geoRes.ok) {
        const text = await geoRes.text();
        throw new Error(text || `Geocoding failed with HTTP ${geoRes.status}`);
      }
      const geo = await geoRes.json();
      return { lat: geo.lat, lon: geo.lon, tz_offset: geo.tz_offset, place_name: geo.label };
    } catch (e) {
      setStatus(`Geocoding error: ${e.message}`, true);
      return null;
    }
  }
  const r = allRegions.find(x => x.id === regionId);
  if (!r) {
    setStatus("Selected region not found.", true);
    return null;
  }
  return { lat: r.lat, lon: r.lon, tz_offset: r.tz_offset, place_name: r.label };
}

// Today's Panchang page has no fields (13 Nov 2026): it uses the account's home place and today's date there.
// The Monthly Panchang page keeps the place and date fields.
const PD_TODAY_ONLY = () => !el("dateInput");
let pdHomePlace = null;
async function pdGetHomePlace() {
  if (pdHomePlace) return pdHomePlace;
  try {
    const res = await fetch(`${API_BASE}/me`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const h = (await res.json()).home || {};
    pdHomePlace = { lat: h.lat, lon: h.lon, tz_offset: h.tz, place_name: h.name || "Home" };
  } catch (e) {
    console.error("Home place could not be read; using Hyderabad.", e);
    pdHomePlace = { lat: 17.385, lon: 78.4867, tz_offset: 5.5, place_name: "Hyderabad, Telangana" };
  }
  return pdHomePlace;
}

async function getPanchang() {
  const todayOnly = PD_TODAY_ONLY();
  let date, place;
  const goBtn = el("goButton");
  if (todayOnly) {
    place = await pdGetHomePlace();
    date = pdNow(place.tz_offset).iso;
  } else {
    date = el("dateInput").value;
    if (!el("regionSelect").value || !date) {
      setStatus("Pick a region and a date first.", true);
      return;
    }
    goBtn.disabled = true;
    place = await resolvePanchangPlace();
    if (!place) {
      goBtn.disabled = false;
      return;
    }
  }
  const { lat, lon, tz_offset, place_name } = place;
  window.lastPanchangPlace = place;
  setStatus("Fetching panchang & activities…");
  el("results").style.display = "none";

  try {
    const res = await fetch(`${API_BASE}/panchang/day-summary?date=${date}&lat=${lat}&lon=${lon}&tz_offset=${tz_offset}&place_name=${encodeURIComponent(place_name)}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    const data = await res.json();
    await pdFetchNow(place, date);
    lastPanchang = data;
    render(data);
    setStatus("");
  } catch (e) {
    setStatus(`Error: ${e.message}`, true);
  } finally {
    if (goBtn) goBtn.disabled = false;
  }
}

function fmtPair(obj) {
  if (!obj) return "—";
  return `${obj.start} – ${obj.end}`;
}

// ============================================================
// Day view (Vedic Sanctuary redesign, 13 Nov 2026). Every part is built from the API's day summary;
// nothing on this page is invented. Times come as "HH:MM:SS" with " (+1)" / " (-1)" for the next or
// previous day.
// ============================================================
const PD_MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  te: ["జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్", "జూలై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్"],
};
// Weekday lord, its Navagraha stotram verse (Vyasa) and its grain (navadhanya) for the shloka card.
const PD_VAARA = {
  Sunday:    { lord: ["the Sun", "సూర్యుడు"], grain: ["wheat", "గోధుమలు"],
               verse: "జపాకుసుమ సంకాశం<br>కాశ్యపేయం మహాద్యుతిమ్ |<br>తమోఽరిం సర్వపాపఘ్నం<br>ప్రణతోఽస్మి దివాకరమ్ ||",
               mean: ["I bow to the Sun, red as the hibiscus, the radiant son of Kashyapa, the enemy of darkness who removes every sin.",
                      "మందార పువ్వు వంటి కాంతి కలవాడు, కశ్యప పుత్రుడు, మహాతేజస్సు కలవాడు, చీకటికి శత్రువు, సర్వ పాపాలను పోగొట్టే సూర్యునికి నమస్కారం."] },
  Monday:    { lord: ["the Moon", "చంద్రుడు"], grain: ["rice", "బియ్యం"],
               verse: "దధిశంఖ తుషారాభం<br>క్షీరోదార్ణవ సంభవమ్ |<br>నమామి శశినం సోమం<br>శంభోర్మకుట భూషణమ్ ||",
               mean: ["I bow to the Moon, white as curd, conch and snow, born of the ocean of milk, the jewel on Shiva's crown.",
                      "పెరుగు, శంఖం, మంచు వంటి తెల్లని కాంతి కలవాడు, పాలసముద్రంలో పుట్టినవాడు, శివుని శిరోభూషణమైన చంద్రునికి నమస్కారం."] },
  Tuesday:   { lord: ["Mars", "కుజుడు"], grain: ["red gram", "కందులు"],
               verse: "ధరణీగర్భ సంభూతం<br>విద్యుత్కాంతి సమప్రభమ్ |<br>కుమారం శక్తిహస్తం తం<br>మంగళం ప్రణమామ్యహమ్ ||",
               mean: ["I bow to Mars, born of the earth, bright as lightning, the youth who holds the spear.",
                      "భూదేవి గర్భంలో పుట్టినవాడు, మెరుపు వంటి కాంతి కలవాడు, శక్తి ఆయుధం ధరించిన కుమారుడైన మంగళునికి నమస్కారం."] },
  Wednesday: { lord: ["Mercury", "బుధుడు"], grain: ["green gram", "పెసలు"],
               verse: "ప్రియంగు కలికాశ్యామం<br>రూపేణాప్రతిమం బుధమ్ |<br>సౌమ్యం సౌమ్యగుణోపేతం<br>తం బుధం ప్రణమామ్యహమ్ ||",
               mean: ["I bow to Mercury, dark as the priyangu bud, of matchless form, gentle and of gentle nature.",
                      "ప్రియంగు మొగ్గ వంటి శ్యామ వర్ణం కలవాడు, సాటిలేని రూపం కలవాడు, సౌమ్య గుణాలు కలిగిన బుధునికి నమస్కారం."] },
  Thursday:  { lord: ["Jupiter", "గురుడు"], grain: ["Bengal gram", "శనగలు"],
               verse: "దేవానాం చ ఋషీణాం చ<br>గురుం కాంచన సన్నిభమ్ |<br>బుద్ధిభూతం త్రిలోకేశం<br>తం నమామి బృహస్పతిమ్ ||",
               mean: ["I bow to Brihaspati, teacher of the gods and sages, golden in colour, wisdom itself, lord of the three worlds.",
                      "దేవతలకు, ఋషులకు గురువు, బంగారు వర్ణం కలవాడు, జ్ఞాన స్వరూపుడు, త్రిలోకాధిపతి అయిన బృహస్పతికి నమస్కారం."] },
  Friday:    { lord: ["Venus", "శుక్రుడు"], grain: ["cowpeas", "బొబ్బర్లు"],
               verse: "హిమకుంద మృణాలాభం<br>దైత్యానాం పరమం గురుమ్ |<br>సర్వశాస్త్ర ప్రవక్తారం<br>భార్గవం ప్రణమామ్యహమ్ ||",
               mean: ["I bow to Venus, white as snow, jasmine and lotus stalk, the great teacher of the daityas, who expounds all the shastras.",
                      "మంచు, మల్లె, తామర తూడు వంటి తెల్లని కాంతి కలవాడు, దైత్య గురువు, సర్వ శాస్త్రాలు బోధించే భార్గవునికి నమస్కారం."] },
  Saturday:  { lord: ["Saturn", "శని"], grain: ["sesame", "నువ్వులు"],
               verse: "నీలాంజన సమాభాసం<br>రవిపుత్రం యమాగ్రజమ్ |<br>ఛాయామార్తాండ సంభూతం<br>తం నమామి శనైశ్చరమ్ ||",
               mean: ["I bow to Saturn, dark as blue collyrium, son of the Sun and elder brother of Yama, born of Chhaya and the Sun.",
                      "నీలి కాటుక వంటి కాంతి కలవాడు, సూర్యపుత్రుడు, యముని అన్న, ఛాయా సూర్యులకు జన్మించిన శనైశ్చరునికి నమస్కారం."] },
};
// The nine traditionally inauspicious yogas, by index (1 = Vishkambha … 27 = Vaidhriti).
const PD_BAD_YOGAS = new Set([1, 6, 9, 10, 13, 15, 17, 19, 27]);
// Chandrabalam by the Moon's house from a rashi: the same rule as compute_chandrabalam on the server.
const PD_CB = { good: [1, 3, 6, 7, 10, 11], moderate: [2, 5, 9], ashtama: [8] };
// Traditional result of the Moon's transit through each house (gochara phala).
const PD_GOCHARA = [null,
  ["Comfort and good food", "ఆహార సౌఖ్యం, సుఖం"], ["Expense of money", "ధన వ్యయం"],
  ["Success and gain", "కార్య జయం, లాభం"], ["Fear and quarrels", "భయం, కలహాలు"],
  ["Worry and obstacles", "మనస్తాపం, కార్య విఘ్నాలు"], ["Victory over enemies, good health", "శత్రు జయం, ఆరోగ్యం"],
  ["Comforts and happiness at home", "సౌఖ్యం, దాంపత్య సుఖం"], ["Danger and ill health (chandrashtama)", "ఆపదలు, అనారోగ్యం (చంద్రాష్టమం)"],
  ["Illness and hindrances", "అనారోగ్యం, ఆటంకాలు"], ["Success in work, honour", "కార్యసిద్ధి, గౌరవం"],
  ["Gains and happiness", "లాభం, సంతోషం"], ["Expenses and loss", "వ్యయం, నష్టం"]];
let pdSelectedRasi = null;

const T = (en, teText) => (currentLang === "te" ? teText : en);

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// "HH:MM:SS (+1)" → minutes from the selected date's midnight (next day adds 1440), or null.
function pdMins(str) {
  if (!str) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*\(([+-]\d+)\))?/.exec(String(str).trim());
  if (!m) return null;
  return (+m[4] || 0) * 1440 + (+m[1]) * 60 + (+m[2]) + (+(m[3] || 0)) / 60;
}

// "06:24 AM", with a note when the time is on the next / previous day.
function pdTime(str) {
  const v = pdMins(str);
  if (v == null) return "—";
  const day = Math.floor(v / 1440), within = v - day * 1440;
  const h = Math.floor(within / 60), mi = Math.floor(within % 60);
  const h12 = ((h + 11) % 12) + 1;
  const txt = `${String(h12).padStart(2, "0")}:${String(mi).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  if (day > 0) return `${txt} ${T("(next day)", "(మరుసటి రోజు)")}`;
  if (day < 0) return `${txt} ${T("(previous day)", "(ముందు రోజు)")}`;
  return txt;
}

function pdRange(o) {
  return o && o.start ? `${pdTime(o.start)} – ${pdTime(o.end)}` : "—";
}

// The selected place's current date and minute, from its time-zone offset.
function pdNow(tz) {
  const d = new Date(Date.now() + (Number(tz) || 0) * 3600e3);
  return { iso: d.toISOString().slice(0, 10), mins: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

// Is "now" (minutes) inside a {start, end} period?
function pdIn(o, mins) {
  if (!o || !o.start) return false;
  const a = pdMins(o.start), b = pdMins(o.end);
  return a != null && b != null && a <= mins && mins < b;
}

function pdClock(mins) {
  return pdTime(`${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(Math.floor(mins % 60)).padStart(2, "0")}`);
}

// The panchang at this minute, for the live view of today (13 Nov 2026 fix: angas were the 6 a.m. ones).
let pdNowP = null, pdNextDayP = null;
async function pdFetchNow(place, date) {
  pdNowP = null;
  const now = pdNow(place.tz_offset);
  if (now.iso !== date) return;
  pdFetchNextDay(place, date);
  try {
    const q = `date=${date}&lat=${place.lat}&lon=${place.lon}&tz_offset=${place.tz_offset}` +
              `&place_name=${encodeURIComponent(place.place_name)}&hour=${Math.floor(now.mins / 60)}&minute=${now.mins % 60}`;
    const res = await fetch(`${API_BASE}/panchang/?${q}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pdNowP = await res.json();
  } catch (e) {
    console.error("Live panchang failed; showing the sunrise angas instead.", e);
  }
}

// Tomorrow's panchang (at sunrise), used when today has no good or bad period left.
async function pdFetchNextDay(place, date) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const next = d.toISOString().slice(0, 10);
  if (pdNextDayP && pdNextDayP.date === next) return;
  pdNextDayP = null;
  try {
    const q = `date=${next}&lat=${place.lat}&lon=${place.lon}&tz_offset=${place.tz_offset}` +
              `&place_name=${encodeURIComponent(place.place_name)}&hour=6&minute=0`;
    const res = await fetch(`${API_BASE}/panchang/?${q}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pdNextDayP = await res.json();
    if (lastPanchang) render(lastPanchang);
  } catch (e) {
    console.error("Next day's panchang failed; the good/bad tiles will say 'No more today'.", e);
  }
}

// A period of the next day, written as times of today plus one day ("06:24:00 (+1)").
function pdShiftDay(o) {
  if (!o || !o.start) return o;
  const f = (v) => {
    const m = pdMins(v);
    if (m == null) return null;
    const t = m + 1440, d = Math.floor(t / 1440), w = t - d * 1440;
    return `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(Math.floor(w % 60)).padStart(2, "0")}:00${d ? ` (+${d})` : ""}`;
  };
  return { start: f(o.start), end: f(o.end) };
}

// "Now" strip in the hero: the clock, the running angas, the lagna and every period running now.
function pdLiveStrip({ p, nowMins, cur, lagnaNow }) {
  const periods = [
    [T("Rahu kalam", "రాహుకాలం"), [p.rahu_kalam], "bad"], [T("Yamagandam", "యమగండం"), [p.yamagandam], "bad"],
    [T("Gulika kalam", "గుళిక కాలం"), [p.gulika_kalam], "bad"], [T("Durmuhurtam", "దుర్ముహూర్తం"), p.durmuhurtam || [], "bad"],
    [T("Varjyam", "వర్జ్యం"), (p.varjyam_all || [p.varjyam]), "bad"], [T("Abhijit muhurtam", "అభిజిత్ ముహూర్తం"), [p.abhijit_muhurta], "good"],
    [T("Amrit kalam", "అమృత కాలం"), p.amrit_kalam || [], "good"], [T("Brahma muhurtam", "బ్రాహ్మీ ముహూర్తం"), [p.brahma_muhurta], "good"],
    [T("Godhuli muhurtam", "గోధూళి ముహూర్తం"), [p.godhuli_muhurta], "good"],
  ].filter(([, arr]) => arr.some(o => pdIn(o, nowMins)));
  const tags = periods.map(([label, , mod]) => `<span class="pd-chip pd-chip--${mod}">${label}</span>`).join(" ");
  const parts = [
    `${esc(te(cur.tithi.name, TITHI_NAMES_TE))} ${T("tithi", "తిథి")}`,
    `${esc(te(cur.nakshatra.name, NAKSHATRA_NAMES_TE))} ${T(`pada ${cur.nakshatra.pada}`, `${cur.nakshatra.pada}వ పాదం`)}`,
    `${esc(te(cur.yoga.name, YOGA_NAMES_TE))} ${T("yoga", "యోగం")}`,
    `${esc(te(cur.karana.name, KARANA_NAMES_TE))} ${T("karana", "కరణం")}`,
    lagnaNow ? `${esc(T(lagnaNow.lagna_name, lagnaNow.lagna_name_te))} ${T("lagna", "లగ్నం")}` : null,
  ].filter(Boolean);
  return `
    <div class="pd-live" role="status">
      <span class="pd-live__clock"><span class="pd-live__pulse"></span>${T("Now", "ఇప్పుడు")} ${pdClock(nowMins)}</span>
      <span class="pd-live__angas">${parts.join('<span class="pd-ribbon__sep">•</span>')}</span>
      <span class="pd-live__tags">${tags || `<span class="pd-chip pd-chip--neutral">${T("No special period running", "ప్రత్యేక కాలం ఏదీ లేదు")}</span>`}</span>
    </div>`;
}

function pdCtxNow() {
  const data = lastPanchang, p = data.panchang || data;
  const place = window.lastPanchangPlace || {};
  const now = pdNow(place.tz_offset != null ? place.tz_offset : 5.5);
  const isToday = now.iso === p.date;
  const live = isToday && pdNowP && pdNowP.date === p.date ? pdNowP : null;
  return { p, data, isToday, nowMins: now.mins, cur: live || p, live };
}

// Every 30 seconds while today is shown: redraw with the new minute; fetch the angas again when one of the
// running ones has ended; move to the new date after midnight.
let pdTicker = null, pdTickBusy = false;
function pdStartTicker() {
  if (pdTicker) return;
  pdTicker = setInterval(async () => {
    if (pdTickBusy || !lastPanchang || document.hidden) return;
    const c = pdCtxNow(), place = window.lastPanchangPlace;
    if (!place) return;
    const nowIso = pdNow(place.tz_offset).iso;
    if (!c.isToday) {
      if (c.p.date < nowIso && (PD_TODAY_ONLY() || (pdNowP && pdNowP.date === c.p.date))) {   // midnight passed
        if (!PD_TODAY_ONLY()) el("dateInput").value = nowIso;
        getPanchang();
      }
      return;
    }
    const ended = c.live && ["tithi", "nakshatra", "yoga", "karana"].some(k => {
      const e = pdMins(c.live[k] && c.live[k].end_time);
      return e != null && e <= c.nowMins;
    });
    if (ended) {
      pdTickBusy = true;
      try { await pdFetchNow(place, c.p.date); } finally { pdTickBusy = false; }
    }
    render(lastPanchang);
  }, pdRefreshMs());
}

function pdRasiName(idx) {
  return idx ? (RASI_NAMES[currentLang] || RASI_NAMES.en)[idx - 1] : "—";
}

function render(data) {
  const p = data.panchang || data;
  el("results").style.display = "block";
  const place = window.lastPanchangPlace || {};
  const now = pdNow(place.tz_offset != null ? place.tz_offset : 5.5);
  const isToday = now.iso === p.date;
  // For today the angas are the ones running at this minute (fetched by pdFetchNow); for other days, at sunrise.
  const live = isToday && pdNowP && pdNowP.date === p.date ? pdNowP : null;
  const cur = live || p;
  const ctx = { p, data, isToday, nowMins: now.mins, cur, live };
  pdStartTicker();

  el("pdHero").innerHTML = pdHero(ctx);
  el("pdAngas").innerHTML = pdAngas(ctx);
  el("pdLuminaries").innerHTML = pdLuminaries(ctx);
  el("pdTimes").innerHTML = pdTimes(ctx);
  el("pdChandrabalam").innerHTML = pdChandrabalam(ctx);
  el("pdLagnas").innerHTML = pdLagnas(ctx);
  el("pdDos").innerHTML = pdDos(ctx);
  el("pdShloka").innerHTML = pdShloka(ctx);
  el("pdCta").innerHTML = pdCta(ctx);

  // Older detail sections, kept under "More details".
  renderPanchakaRahitam(p);
  renderKalaVibhajana(p);
  if (p.abhijit_kala_muhurtham) {
    const isClean = p.abhijit_kala_muhurtham.status === "auspicious";
    el("vAbhijitKala").textContent = T(p.abhijit_kala_muhurtham.msg_en, p.abhijit_kala_muhurtham.msg_te);
    el("vAbhijitKala").style.color = isClean ? "var(--color-success)" : "var(--color-danger)";
  } else {
    el("vAbhijitKala").textContent = "—";
    el("vAbhijitKala").style.color = "inherit";
  }
  renderFavorableActivities(data);
  renderAvoidActivities(data);
  pdApplySections();
}

// Sections the super admin switched off on the Settings page (plan D5). Hidden, not removed, so they come
// back as soon as the setting changes.
function pdApplySections() {
  const sec = (window.SiteConfig && SiteConfig.data && SiteConfig.data.panchang && SiteConfig.data.panchang.sections) || {};
  const on = (k) => sec[k] !== false;
  const show = (node, yes) => { if (node) node.hidden = !yes; };
  show(document.querySelector("#pdHero .pd-tiles"), on("live"));
  show(document.querySelector("#pdTimes .pd-timeline"), on("timeline"));
  show(document.querySelector("#pdTimes .pd-times"), on("times"));
  show(document.querySelector("#pdTimes .pd-minis"), on("yogas_panchaka"));
  show(el("pdChandrabalam"), on("chandrabalam"));
  show(el("pdLagnas"), on("lagnas"));
  show(el("pdDos"), on("dos"));
  show(el("pdShloka"), on("shloka"));
  show(el("pdCta"), on("cta"));
  show(document.querySelector("#results .pd-more"), on("more"));
  const timesCard = el("pdTimes");
  if (timesCard) timesCard.hidden = !(on("timeline") || on("times") || on("yogas_panchaka"));
}
if (window.SiteConfig) SiteConfig.onChange(() => { if (lastPanchang) pdApplySections(); });

// How often the live view redraws (Settings › Panchang, 15–300 seconds; 30 by default).
function pdRefreshMs() {
  const s = window.SiteConfig && SiteConfig.data && SiteConfig.data.panchang && Number(SiteConfig.data.panchang.refresh_seconds);
  return (s >= 15 && s <= 300 ? s : 30) * 1000;
}

function pdHero({ p, isToday, nowMins, cur, live }) {
  const [y, m, d] = (p.date || "").split("-").map(Number);
  const cm = p.chandramana || {};
  const vaara = T(p.vaara, (VAARA_NAMES.te || {})[p.vaara] || p.vaara);
  const tithi = te(cur.tithi.name, TITHI_NAMES_TE);
  const nak = te(cur.nakshatra.name, NAKSHATRA_NAMES_TE);
  const paksha = PAKSHA_NAMES[currentLang][cur.tithi.paksha] || cur.tithi.paksha;
  const masa = te(cm.month_name, MONTH_NAMES_TE) || "";
  const months = PD_MONTHS[currentLang] || PD_MONTHS.en;
  const ribbon = [
    cm.samvatsara_name ? T(`${cm.samvatsara_name} nama samvatsara`, `శ్రీ ${cm.samvatsara_telugu || cm.samvatsara_name} నామ సంవత్సరం`) : null,
    T(cm.ayanam_en, cm.ayanam_te), T(cm.ruthu_en, cm.ruthu_te),
    masa ? masa + (cm.is_adhika_masa ? ` (${T("Adhika", "అధిక")})` : "") : null,
    T(cm.paksha_en ? `${cm.paksha_en} paksha` : "", cm.paksha_te),
  ].filter(Boolean);

  // Lagna tile: the lagna running now (today) or at sunrise (any other day).
  const ls = p.lagna_schedule || [];
  let lagna = ls[0], lagnaLabel = T("Lagna at sunrise", "సూర్యోదయ లగ్నం");
  if (isToday) {
    const cur = ls.find(l => pdMins(l.start_time) <= nowMins && nowMins < pdMins(l.end_time));
    if (cur) { lagna = cur; lagnaLabel = T("Current lagna", "ప్రస్తుత లగ్నం"); }
  }
  const lagnaText = lagna ? `${T(lagna.lagna_name, lagna.lagna_name_te)} (${pdTime(lagna.start_time)} – ${pdTime(lagna.end_time)})` : "—";
  const amrit = (p.amrit_kalam || [])[0];
  const abh = p.abhijit_kala_muhurtham;
  const abhClean = abh && abh.status === "auspicious";

  const running = (o) => isToday && pdIn(o, nowMins);
  const nowChip = `<span class="pd-chip pd-chip--live">${T("Now", "ఇప్పుడు")}</span>`;
  const tile = (icon, mod, label, chip, value, isNow) => `
    <div class="pd-tile pd-tile--${mod}${isNow ? " pd-tile--now" : ""}">
      <span class="pd-tile__icon">${Icon(icon)}</span>
      <div class="pd-tile__body">
        <div class="pd-tile__label">${label}${chip ? ` <span class="pd-chip pd-chip--${mod}">${chip}</span>` : ""}${isNow ? " " + nowChip : ""}</div>
        <div class="pd-tile__value">${value}</div>
      </div>
    </div>`;

  return `
    <div class="pd-hero__top">
      <div class="pd-hero__title">
        <div class="pd-hero__badges">
          <span class="pd-badge">${isToday ? T("Today's Drik panchangam", "నేటి దృక్సిద్ధాంత పంచాంగం") : T("Drik panchangam", "దృక్సిద్ధాంత పంచాంగం")}</span>
          <span class="pd-hero__meta">${Icon("pin")} ${esc(p.place || "")}${PD_TODAY_ONLY()
            ? ` · <a href="account.html#home">${T("Change place", "ప్రదేశం మార్చండి")}</a>` : ""}</span>
        </div>
        <h1>${d} ${months[(m || 1) - 1]} ${y}, ${esc(vaara)}</h1>
        <p class="pd-hero__sub">${esc(masa)} ${esc(paksha)} ${esc(tithi)} <span class="pd-dot"></span> ${esc(nak)} ${T("nakshatra", "నక్షత్రం")}</p>
      </div>
      ${PD_TODAY_ONLY() ? "" : `<div class="pd-datenav no-print" role="group" aria-label="${T("Change date", "తేదీ మార్చండి")}">
        <button type="button" class="pd-datenav__btn" data-pd-shift="-1" aria-label="${T("Previous day", "ముందు రోజు")}">‹ <span>${T("Previous", "ముందు రోజు")}</span></button>
        <button type="button" class="pd-datenav__today" data-pd-today ${isToday ? 'aria-current="date"' : ""}>${Icon("calendar")} ${T("Today", "నేడు")}</button>
        <button type="button" class="pd-datenav__btn" data-pd-shift="1" aria-label="${T("Next day", "మరుసటి రోజు")}"><span>${T("Next", "మరుసటి రోజు")}</span> ›</button>
      </div>`}
    </div>
    <div class="pd-ribbon">${ribbon.map(esc).join('<span class="pd-ribbon__sep">•</span>')}</div>
    ${isToday ? pdLiveStrip({ p, nowMins, cur, live, lagnaNow: lagna }) : ""}
    <div class="pd-tiles">
      ${isToday ? pdLiveTiles({ p, nowMins, cur, lagna, lagnaLabel, lagnaText, tile }) : `
      ${tile("sparkle", "good", lagnaLabel, "", esc(lagnaText), false)}
      ${tile("alert", "bad", T("Rahu kalam", "రాహుకాలం"), T("avoid", "వర్జ్యం"), pdRange(p.rahu_kalam), running(p.rahu_kalam))}
      ${tile("star", abhClean ? "gold" : "warn", T("Abhijit muhurtam", "అభిజిత్ ముహూర్తం"),
             abhClean ? T("clean", "శుభం") : T("check", "పరిశీలించండి"), pdRange(p.abhijit_muhurta), running(p.abhijit_muhurta))}
      ${tile("leaf", "good", T("Amrit kalam", "అమృత కాలం"), "", amrit ? pdRange(amrit) : "—", (p.amrit_kalam || []).some(running))}`}
    </div>`;
}

// "1 h 5 min" / "1 గం. 5 నిమి."
function pdDur(mins) {
  const m = Math.max(0, Math.round(mins)), h = Math.floor(m / 60), r = m % 60;
  return h ? T(`${h} h ${r} min`, `${h} గం. ${r} నిమి.`) : T(`${r} min`, `${r} నిమి.`);
}

// The period running now from a list, else the next one still to come today.
function pdRunningOrNext(rows, nowMins) {
  const all = [];
  rows.forEach(([label, arr]) => (arr || []).forEach(o => {
    const a = pdMins(o && o.start), b = pdMins(o && o.end);
    if (a != null && b != null && b > a) all.push({ label, o, a, b });
  }));
  const now = all.filter(x => x.a <= nowMins && nowMins < x.b).sort((x, y) => x.b - y.b)[0];
  if (now) return { state: "now", ...now, others: all.filter(x => x !== now && x.a <= nowMins && nowMins < x.b) };
  const next = all.filter(x => x.a > nowMins).sort((x, y) => x.a - y.a)[0];
  return next ? { state: "next", ...next } : { state: "none" };
}

// Today's three tiles, all live: the lagna now, the bad period now (or next), the good period now (or next).
// (The fourth "next change" tile was removed at the user's request, 13 Nov 2026.)
function pdLiveTiles({ p, nowMins, cur, lagna, lagnaLabel, lagnaText, tile }) {
  const live = `<span class="pd-chip pd-chip--live">${T("Now", "ఇప్పుడు")}</span>`;
  const lagnaLeft = lagna ? pdMins(lagna.end_time) - nowMins : null;
  const out = [tile("sparkle", "good", lagnaLabel, "", `${esc(lagnaText)}${lagnaLeft > 0 ? `<small class="pd-tile__sub">${T(`${pdDur(lagnaLeft)} left`, `ఇంకా ${pdDur(lagnaLeft)}`)}</small>` : ""}`, false)];

  const card = (r, icon, mod, title) => {
    if (r.state === "none") return tile(icon, "neutral", title, "", T("No more today", "ఈ రోజు ఇక లేవు"), false);
    const extra = (r.others || []).map(x => x.label).join(", ");
    const sub = r.state === "now"
      ? T(`${pdDur(r.b - nowMins)} left`, `ఇంకా ${pdDur(r.b - nowMins)}`) + (extra ? ` · ${T("also", "అలాగే")} ${esc(extra)}` : "")
      : T(`starts in ${pdDur(r.a - nowMins)}`, `${pdDur(r.a - nowMins)}లో మొదలు`);
    const label = `${r.state === "now" ? title : T(`Next: ${title}`, `తదుపరి ${title}`)}`;
    return tile(icon, r.state === "now" ? mod : "neutral", label, "",
      `${esc(r.label)}<br><span class="pd-tile__time">${pdRange(r.o)}</span><small class="pd-tile__sub">${sub}</small>`, r.state === "now");
  };
  const badRows = (P, sh) => [
    [T("Rahu kalam", "రాహుకాలం"), [P.rahu_kalam].map(sh)], [T("Yamagandam", "యమగండం"), [P.yamagandam].map(sh)],
    [T("Gulika kalam", "గుళిక కాలం"), [P.gulika_kalam].map(sh)], [T("Durmuhurtam", "దుర్ముహూర్తం"), (P.durmuhurtam || []).map(sh)],
    [T("Varjyam", "వర్జ్యం"), (P.varjyam_all || [P.varjyam]).map(sh)]];
  const goodRows = (P, sh) => [
    [T("Abhijit muhurtam", "అభిజిత్ ముహూర్తం"), [P.abhijit_muhurta].map(sh)], [T("Amrit kalam", "అమృత కాలం"), (P.amrit_kalam || []).map(sh)],
    [T("Brahma muhurtam", "బ్రాహ్మీ ముహూర్తం"), [P.brahma_muhurta].map(sh)], [T("Godhuli muhurtam", "గోధూళి ముహూర్తం"), [P.godhuli_muhurta].map(sh)]];
  const same = (o) => o;
  // Tomorrow's periods count only after today's (they are shifted by a day), so today's always come first.
  const tomorrow = pdNextDayP && pdNextDayP.date > p.date ? pdNextDayP : null;
  const bad = pdRunningOrNext(badRows(p, same).concat(tomorrow ? badRows(tomorrow, pdShiftDay) : []), nowMins);
  const good = pdRunningOrNext(goodRows(p, same).concat(tomorrow ? goodRows(tomorrow, pdShiftDay) : []), nowMins);
  out.push(card(bad, "alert", "bad", T("Bad time", "అశుభ కాలం")));
  out.push(card(good, "star", "gold", T("Good time", "శుభ కాలం")));

  // A blinking "Live" badge on each of today's tiles.
  const badge = `<span class="pd-livedot" aria-label="${T("Live", "ప్రత్యక్షం")}"><span class="pd-livedot__dot"></span>${T("LIVE", "లైవ్")}</span>`;
  return out.map(h => h.replace(/(<div class="pd-tile [^"]*">)/, `$1${badge}`)).join("");
}

function pdAngas({ p, isToday, nowMins, cur, live }) {
  const t = cur.tithi, n = cur.nakshatra, y = cur.yoga, k = cur.karana;
  const paksha = PAKSHA_NAMES[currentLang][t.paksha] || t.paksha;
  const ends = (str) => `${T("until", "వరకు")} <strong>${pdTime(str)}</strong>`;

  // How much of the tithi has passed (today only).
  let bar = "";
  const ts = pdMins(t.start_time), tend = pdMins(t.end_time);
  if (isToday && ts != null && tend != null && tend > ts) {
    const left = Math.max(0, Math.min(100, Math.round(100 * (tend - nowMins) / (tend - ts))));
    bar = `<div class="pd-progress" role="img" aria-label="${T(`${left}% of the tithi left`, `తిథి ${left}% మిగిలింది`)}"><span style="width:${100 - left}%"></span></div>
           <div class="pd-progress__legend"><span>${T("Began", "ప్రారంభం")}: ${pdTime(t.start_time)}</span><span>${T("Left", "మిగిలినది")}: ${left}%</span></div>`;
  }

  const padas = (n.padas || []).map(pd => {
    const s = pdMins(pd.start_time), e = pdMins(pd.end_time);
    const state = isToday && e != null && e <= nowMins ? "past" : (isToday && s != null && s <= nowMins && nowMins < e ? "now" : "");
    return `<div class="pd-pada ${state ? "pd-pada--" + state : ""}">
      <strong>${T(`Pada ${pd.pada}`, `${pd.pada}వ పాదం`)}</strong>
      <small>${state === "now" ? T("now", "ప్రస్తుతం") : state === "past" ? T("over", "ముగిసింది") : pdTime(pd.start_time)}</small></div>`;
  }).join("");

  const yogaBad = PD_BAD_YOGAS.has(Number(y.index));
  const kName = String(k.name || "");
  const kKind = /vishti|bhadra/i.test(kName) ? ["bad", T("Vishti (Bhadra): avoid", "విష్టి (భద్ర): వర్జ్యం")]
    : /shakuni|chatushpada|naga|kimstughna/i.test(kName) ? ["neutral", T("Sthira karana", "స్థిర కరణం")]
    : ["neutral", T("Chara karana", "చర కరణం")];
  const lord = (PD_VAARA[p.vaara] || {}).lord || ["", ""];

  const row = (num, icon, label, chip, chipMod, title, body) => `
    <div class="pd-anga">
      <div class="pd-anga__head"><span class="pd-anga__label">${Icon(icon)} ${num}. ${label}</span>${chip ? `<span class="pd-chip pd-chip--${chipMod}">${chip}</span>` : ""}</div>
      <h3>${title}</h3>
      ${body}
    </div>`;

  return `
    <header class="pd-angas__head">
      <div><h2>${T("The five angas", "పంచాంగ ప్రధానాంగాలు")}</h2><p>${live
        ? T(`Running now (${pdClock(nowMins)})`, `ఇప్పుడు నడుస్తున్నవి (${pdClock(nowMins)})`)
        : T("At sunrise", "సూర్యోదయ సమయానికి")}</p></div>
      <span class="pd-angas__tag">${T("Drik", "దృగ్గణితం")}</span>
    </header>
    <div class="pd-angas__list">
      ${row(1, "moon", T("Tithi", "తిథి"), esc(paksha), "gold", esc(te(t.name, TITHI_NAMES_TE)),
            `<p>${ends(t.end_time)}</p>${bar}`)}
      ${row(2, "sparkle", T("Nakshatra", "నక్షత్రం"), T(`Pada ${n.pada}`, `${n.pada}వ పాదం`), "neutral", esc(te(n.name, NAKSHATRA_NAMES_TE)),
            `<p>${ends(n.end_time)}</p>${padas ? `<div class="pd-padas">${padas}</div>` : ""}`)}
      ${row(3, "calendar", T("Vara", "వారం"), "", "", esc(T(p.vaara, (VAARA_NAMES.te || {})[p.vaara] || p.vaara)),
            `<p>${T("Lord of the day", "వారాధిపతి")}: <strong>${T(lord[0], lord[1])}</strong></p>`)}
      ${row(4, "wheel", T("Yoga", "నిత్య యోగం"), yogaBad ? T("Inauspicious", "అశుభ యోగం") : T("Auspicious", "శుభ యోగం"),
            yogaBad ? "bad" : "good", esc(te(y.name, YOGA_NAMES_TE)), `<p>${ends(y.end_time)}</p>`)}
      ${row(5, "hourglass", T("Karana", "కరణం"), kKind[1], kKind[0], esc(te(k.name, KARANA_NAMES_TE)), `<p>${ends(k.end_time)}</p>`)}
    </div>`;
}

function pdLuminaries({ p }) {
  const L = p.luminaries || {};
  const sr = pdMins(p.sunrise), ss = pdMins(p.sunset);
  const dayLen = sr != null && ss != null ? ss - sr : null;
  const dayTxt = dayLen != null ? T(`${Math.floor(dayLen / 60)} h ${Math.round(dayLen % 60)} min`, `${Math.floor(dayLen / 60)} గం. ${Math.round(dayLen % 60)} నిమి.`) : "—";
  const moonNext = L.moon_rasi_end_time
    ? T(`Enters ${pdRasiName(L.next_moon_rasi_index)} at ${pdTime(L.moon_rasi_end_time)}`,
        `${pdTime(L.moon_rasi_end_time)} కి ${pdRasiName(L.next_moon_rasi_index)}లోకి`)
    : T("In this rashi all day", "రోజంతా ఈ రాశిలోనే");
  const card = (icon, name, rasi, rows, foot) => `
    <div class="pd-lum">
      <div class="pd-lum__head"><span>${Icon(icon)} ${name}</span><small>${rasi}</small></div>
      ${rows.map(([k, v]) => `<div class="pd-lum__row"><span>${k}</span><strong>${v}</strong></div>`).join("")}
      <div class="pd-lum__foot">${foot}</div>
    </div>`;
  return `
    <h2 class="pd-card__title">${Icon("sunrise")} ${T("Sun and Moon", "సూర్య, చంద్ర సంచారాలు")}</h2>
    <div class="pd-lum-grid">
      ${card("sun", T("Sun", "రవి"), `${pdRasiName(L.sun_rasi_index)} ${T("rashi", "రాశి")}`,
             [[T("Sunrise", "సూర్యోదయం"), pdTime(p.sunrise)], [T("Sunset", "సూర్యాస్తమయం"), pdTime(p.sunset)]],
             `${T("Day length", "పగటి ప్రమాణం")}: ${dayTxt}`)}
      ${card("moon", T("Moon", "చంద్రుడు"), `${pdRasiName(L.moon_rasi_index)} ${T("rashi", "రాశి")}`,
             [[T("Moonrise", "చంద్రోదయం"), pdTime(L.moonrise)], [T("Moonset", "చంద్రాస్తమయం"), pdTime(L.moonset)]],
             moonNext)}
    </div>`;
}

function pdTimes({ p, isToday, nowMins }) {
  const good = [
    [T("Abhijit muhurtam", "అభిజిత్ ముహూర్తం"), [p.abhijit_muhurta]],
    [T("Amrit kalam", "అమృత కాలం"), p.amrit_kalam || []],
    [T("Brahma muhurtam", "బ్రాహ్మీ ముహూర్తం"), [p.brahma_muhurta]],
    [T("Godhuli muhurtam", "గోధూళి ముహూర్తం"), [p.godhuli_muhurta]],
  ];
  const bad = [
    [T("Rahu kalam", "రాహుకాలం"), [p.rahu_kalam]],
    [T("Yamagandam", "యమగండం"), [p.yamagandam]],
    [T("Gulika kalam", "గుళిక కాలం"), [p.gulika_kalam]],
    [T("Durmuhurtam", "దుర్ముహూర్తం"), p.durmuhurtam || []],
    [T("Varjyam", "వర్జ్యం"), (p.varjyam_all || [p.varjyam])],
  ];
  // One track for good times, one for bad, across this date's 24 hours.
  const seg = (o, label, mod) => {
    if (!o || !o.start) return "";
    let a = pdMins(o.start), b = pdMins(o.end);
    if (a == null || b == null) return "";
    a = Math.max(0, a); b = Math.min(1440, b);
    if (b <= a) return "";
    return `<span class="pd-seg pd-seg--${mod}" style="left:${(a / 14.4).toFixed(2)}%;width:${((b - a) / 14.4).toFixed(2)}%" title="${esc(label)}: ${pdRange(o)}"></span>`;
  };
  const track = (list, mod) => list.map(([label, arr]) => arr.map(o => seg(o, label, mod)).join("")).join("");
  const sr = pdMins(p.sunrise), ss = pdMins(p.sunset);
  const dayBand = sr != null && ss != null ? `<span class="pd-dayband" style="left:${(sr / 14.4).toFixed(2)}%;width:${((ss - sr) / 14.4).toFixed(2)}%"></span>` : "";
  const nowMark = isToday ? `<span class="pd-now" style="left:${(nowMins / 14.4).toFixed(2)}%" title="${T("Now", "ఇప్పుడు")}"></span>` : "";
  const list = (rows, mod) => rows.map(([label, arr]) => {
    const real = arr.filter(o => o && o.start);
    const isNow = isToday && real.some(o => pdIn(o, nowMins));
    const vals = real.map(pdRange);
    return `<div class="pd-time pd-time--${mod}${isNow ? " pd-time--now" : ""}">
      <span>${label}${isNow ? ` <span class="pd-chip pd-chip--live">${T("Now", "ఇప్పుడు")}</span>` : ""}</span>
      <strong>${vals.length ? vals.join("<br>") : "—"}</strong></div>`;
  }).join("");

  const yogas = (p.special_yogas || []).map(y =>
    `<li class="pd-yoga pd-yoga--${y.type === "bad" ? "bad" : y.type === "info" ? "info" : "good"}">${esc(T(y.name_en, y.name_te))}</li>`).join("");
  const pan = p.panchaka_rahitam;
  const panTile = pan ? `
    <div class="pd-mini pd-mini--${pan.is_pass ? "good" : "bad"}">
      <div class="pd-mini__head"><span>${Icon("shield")} ${T("Panchaka rahitam", "పంచక రహిత పరిశీలన")}</span>
        <span class="pd-chip pd-chip--${pan.is_pass ? "good" : "bad"}">${pan.is_pass ? T("No dosha ✓", "దోష రహితం ✓") : T("Dosha", "దోషం")}</span></div>
      <p><strong>${T("Remainder", "శేషం")}: ${esc(pan.remainder)}</strong> · ${esc(T(pan.name_en, pan.name_te))}</p>
      <p class="pd-mini__note" title="${esc(pan.formula || "")}">${T("At sunrise, with the sunrise lagna.", "సూర్యోదయ సమయం, సూర్యోదయ లగ్నంతో.")}</p>
    </div>` : "";

  return `
    <div class="pd-card__titlerow">
      <div><h2 class="pd-card__title">${Icon("clock")} ${T("The day's timings", "24 గంటల కాల చక్రం")}</h2>
        <p class="pd-card__sub">${T("Good and bad periods across the day", "నేటి శుభాశుభ సమయాల విభజన")}</p></div>
      <div class="pd-legend"><span class="pd-legend__good">${T("Good", "శుభం")}</span><span class="pd-legend__bad">${T("Avoid", "వర్జ్యం")}</span></div>
    </div>
    <div class="pd-timeline" aria-hidden="true">
      <div class="pd-track">${dayBand}${track(good, "good")}${nowMark}</div>
      <div class="pd-track">${dayBand}${track(bad, "bad")}${nowMark}</div>
      <div class="pd-axis"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>
    </div>
    <div class="pd-times">
      <div class="pd-times__col pd-times__col--good"><h3>${Icon("star")} ${T("Good times", "శుభ సమయాలు")}</h3>${list(good, "good")}</div>
      <div class="pd-times__col pd-times__col--bad"><h3>${Icon("alert")} ${T("Times to avoid", "అశుభ సమయాలు")}</h3>${list(bad, "bad")}</div>
    </div>
    <div class="pd-minis">
      <div class="pd-mini pd-mini--gold">
        <div class="pd-mini__head"><span>${Icon("sparkle")} ${T("Special yogas today", "నేటి విశేష యోగాలు")}</span></div>
        ${yogas ? `<ul class="pd-yogas">${yogas}</ul>` : `<p>${T("No special yoga today.", "ఈ రోజు విశేష యోగాలు లేవు.")}</p>`}
      </div>
      ${panTile}
    </div>`;
}

function pdChandrabalam({ p, isToday, nowMins }) {
  const L = p.luminaries || {};
  const moved = isToday && L.moon_rasi_end_time && pdMins(L.moon_rasi_end_time) <= nowMins;
  const moon = Number(moved ? L.next_moon_rasi_index : L.moon_rasi_index);
  if (!moon) return "";
  if (!pdSelectedRasi) pdSelectedRasi = moon;
  const info = (r) => {
    const house = ((moon - r + 12) % 12) + 1;
    const kind = PD_CB.good.includes(house) ? "good" : PD_CB.moderate.includes(house) ? "moderate" : PD_CB.ashtama.includes(house) ? "ashtama" : "bad";
    const chip = { good: T("Good ✓", "శుభం ✓"), moderate: T("Moderate", "మధ్యమం"), ashtama: T("8th ✕", "అష్టమం ✕"), bad: T("Weak ✕", "అశుభం ✕") }[kind];
    return { house, kind, chip };
  };
  const btns = [...Array(12)].map((_, i) => {
    const r = i + 1, inf = info(r);
    return `<button type="button" class="pd-rasi pd-rasi--${inf.kind}" data-pd-rasi="${r}" aria-pressed="${r === pdSelectedRasi}">
      <strong>${pdRasiName(r)}</strong><small>${inf.chip}</small></button>`;
  }).join("");
  const sel = info(pdSelectedRasi);
  const g = PD_GOCHARA[sel.house];
  const kindText = { good: T("Full chandrabalam", "పూర్ణ చంద్రబలం"), moderate: T("Moderate chandrabalam", "మధ్యమ చంద్రబలం"),
                     ashtama: T("Chandrashtama: avoid", "చంద్రాష్టమం: వర్జ్యం"), bad: T("Weak chandrabalam", "అశుభ చంద్రబలం") }[sel.kind];
  return `
    <div class="pd-card__titlerow">
      <div><h2 class="pd-card__title">${Icon("moon")} ${T("Chandrabalam for each rashi", "రాశి వారి చంద్రబల పరిశీలన")}</h2>
        <p class="pd-card__sub">${isToday
          ? T(`From the Moon in ${pdRasiName(moon)} now`, `ఇప్పుడు ${pdRasiName(moon)}లో ఉన్న చంద్రుని ఆధారంగా`)
          : T(`From the Moon in ${pdRasiName(moon)} at sunrise`, `సూర్యోదయ సమయ ${pdRasiName(moon)} చంద్రుని ఆధారంగా`)}</p></div>
      <span class="pd-card__hint">${T("Pick your rashi", "మీ రాశిని ఎంచుకోండి")}</span>
    </div>
    <div class="pd-rasis" role="group" aria-label="${T("Rashis", "రాశులు")}">${btns}</div>
    <div class="pd-rasi-detail pd-rasi-detail--${sel.kind}" aria-live="polite">
      <span class="pd-rasi-detail__icon">${Icon("moon")}</span>
      <div>
        <h3>${pdRasiName(pdSelectedRasi)} ${T("rashi", "రాశి")}: ${T(`Moon in the ${sel.house}${["st","nd","rd"][sel.house - 1] || "th"} house`, `${sel.house}వ స్థానంలో చంద్రుడు`)}
          <span class="pd-chip pd-chip--${sel.kind === "good" ? "good" : sel.kind === "moderate" ? "gold" : "bad"}">${kindText}</span></h3>
        <p>${T("Traditional result", "సాంప్రదాయ గోచార ఫలం")}: ${T(g[0], g[1])}.</p>
        ${L.moon_rasi_end_time && !moved ? `<p class="pd-rasi-detail__note">${T(`The Moon enters ${pdRasiName(L.next_moon_rasi_index)} at ${pdTime(L.moon_rasi_end_time)}; after that, count from there.`, `${pdTime(L.moon_rasi_end_time)} తర్వాత చంద్రుడు ${pdRasiName(L.next_moon_rasi_index)}లో ఉంటాడు; అప్పటి నుండి అక్కడి నుండి లెక్కించాలి.`)}</p>` : ""}
      </div>
    </div>`;
}

function pdLagnas({ p, isToday, nowMins }) {
  const ls = p.lagna_schedule || [];
  let curIdx = 0;
  if (isToday) {
    const i = ls.findIndex(l => pdMins(l.start_time) <= nowMins && nowMins < pdMins(l.end_time));
    if (i >= 0) curIdx = i;
  }
  const items = ls.map((l, i) => `
    <li class="pd-lagna ${i === curIdx ? "pd-lagna--current" : ""}">
      <div><strong>${i + 1}. ${esc(T(l.lagna_name, l.lagna_name_te))}</strong><small>${pdTime(l.start_time)} – ${pdTime(l.end_time)}</small></div>
      ${i === curIdx ? `<span class="pd-chip pd-chip--gold">${isToday ? T("Now", "ప్రస్తుతం") : T("At sunrise", "సూర్యోదయం")}</span>` : ""}
    </li>`).join("");
  return `
    <div class="pd-card__titlerow"><h2 class="pd-card__title">${Icon("landmark")} ${T("The 12 lagnas", "12 లగ్నాల సమయ చక్రం")}</h2>
      <span class="pd-card__hint">${T("from sunrise", "సూర్యోదయం నుండి")}</span></div>
    <ol class="pd-lagnas">${items}</ol>`;
}

function pdDos({ data }) {
  const name = a => T(a.activity_name_en || a.name_en, a.activity_name_te || a.name_te);
  const why = (arr) => esc((arr || []).join("; "));
  const fav = (data.favorable_activities || []).slice(0, 6);
  const avoid = (data.avoid_activities || []).slice(0, 6);
  const li = (a, reasons, mod) => `<li class="pd-do pd-do--${mod}" title="${why(reasons)}">${esc(name(a))}</li>`;
  return `
    <h2 class="pd-card__title">${Icon("scroll")} ${T("Good for / avoid today", "నేటి అనుకూల, వర్జ్యములు")}</h2>
    <div class="pd-dos">
      <div class="pd-dos__box pd-dos__box--good"><h3>${T("Good for", "చేయదగిన పనులు")}</h3>
        ${fav.length ? `<ul>${fav.map(a => li(a, a.reasons_favorable, "good")).join("")}</ul>` : `<p>${T("Nothing in particular.", "ప్రత్యేకంగా ఏవీ లేవు.")}</p>`}</div>
      <div class="pd-dos__box pd-dos__box--bad"><h3>${T("Avoid", "వర్జించవలసినవి")}</h3>
        ${avoid.length ? `<ul>${avoid.map(a => li(a, a.reasons_avoid, "bad")).join("")}</ul>` : `<p>${T("Nothing in particular.", "ప్రత్యేకంగా ఏవీ లేవు.")}</p>`}</div>
    </div>
    <p class="pd-card__sub">${T("Reasons for each are under \"More details\" below.", "కారణాలు కింద \"మరిన్ని వివరాలు\"లో ఉన్నాయి.")}</p>`;
}

function pdShloka({ p }) {
  const v = PD_VAARA[p.vaara];
  if (!v) return "";
  return `
    <div class="pd-shloka__head">${Icon("scroll")} ${T(`Today's shloka: ${v.lord[0]}`, `నేటి గ్రహ శ్లోకం: ${v.lord[1]}`)}</div>
    <div class="pd-shloka__body">
      <p class="pd-shloka__verse" lang="sa">"${v.verse}"</p>
      <hr>
      <p class="pd-shloka__meaning"><strong>${T("Meaning", "తాత్పర్యం")}:</strong> ${T(v.mean[0], v.mean[1])}</p>
    </div>
    <div class="pd-shloka__foot"><span>${T("Navagraha stotram (Vyasa)", "నవగ్రహ స్తోత్రం (వ్యాస కృతం)")}</span>
      <span>${T(`Grain to give: ${v.grain[0]}`, `దానం: ${v.grain[1]}`)}</span></div>`;
}

// An editable text from Settings › Texts (plan D8), or the page's own wording.
function pdText(key, en, te) {
  return window.SiteConfig ? SiteConfig.text(key, en, te) : T(en, te);
}

function pdCta() {
  return `
    <div class="pd-cta__text">
      <span class="pd-cta__icon">${Icon("calendar")}</span>
      <div><strong>${esc(pdText("today_cta_title", "Looking for a muhurta?", "శుభ ముహూర్తం కావాలా?"))}</strong>
        <span>${esc(pdText("today_cta_text", "The Muhurta Finder checks every rule of the book for your event, person and place.", "ముహూర్త శోధన మీ కార్యం, వ్యక్తి, ప్రదేశానికి గ్రంథంలోని అన్ని నియమాలు పరిశీలిస్తుంది."))}</span></div>
    </div>
    <a class="pd-cta__btn" href="muhurta-finder.html">★ ${T("Find a muhurta", "ముహూర్త శోధన ప్రారంభించండి")} ›</a>`;
}

// Date buttons and rashi buttons (one listener for the whole Day view).
document.addEventListener("click", (ev) => {
  const shift = ev.target.closest("[data-pd-shift]");
  const today = ev.target.closest("[data-pd-today]");
  const rasi = ev.target.closest("[data-pd-rasi]");
  if ((shift || today) && el("dateInput")) {
    const input = el("dateInput");
    if (today) {
      input.valueAsDate = new Date();
    } else {
      const d = new Date(`${input.value}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + Number(shift.getAttribute("data-pd-shift")));
      input.value = d.toISOString().slice(0, 10);
    }
    getPanchang();
  } else if (rasi && lastPanchang) {
    pdSelectedRasi = Number(rasi.getAttribute("data-pd-rasi"));
    el("pdChandrabalam").innerHTML = pdChandrabalam(pdCtxNow());
  }
});

// ---- Extracted rendering sub-functions ----

function renderPanchakaRahitam(p) {
  const panDiv = el("vPanchakaSection");
  const pan = p.panchaka_rahitam;
  if (pan && panDiv) {
    const panName = currentLang === "te" ? pan.name_te : pan.name_en;
    const panEffect = currentLang === "te" ? pan.effect_te : pan.effect_en;
    const panPariharam = currentLang === "te" ? pan.pariharam_te : pan.pariharam_en;
    const isPass = pan.is_pass;
    const mod = isPass ? "pass" : "fail";

    panDiv.innerHTML = `
      <div class="panchaka-box panchaka-box--${mod}">
        <div class="panchaka-box__header">
          <h4 class="panchaka-box__title panchaka-box__title--${mod}">
            ${Icon("wheel")} ${currentLang === "te" ? "పంచక రహిత విశ్లేషణ (Panchaka Rahitam)" : "Panchaka Rahitam Analysis"}
          </h4>
          <span class="panchaka-box__badge panchaka-box__badge--${mod}">
            ${isPass ? (currentLang === "te" ? "శుభ పంచకం (దోష రహితం)" : "Subha (Clean)") : (currentLang === "te" ? "అశుభ పంచకం" : "Dosha")}
          </span>
        </div>
        <div class="panchaka-box__body">
          <div><strong>${currentLang === "te" ? "పంచక నిర్ణయ సూత్రం:" : "Formula:"}</strong> <code>${pan.formula || `(తిథి + వారం + నక్షత్రం + లగ్నం) % 9 = శేషం ${pan.remainder}`}</code></div>
          <div class="panchaka-box__classification"><strong>${currentLang === "te" ? "పంచక ఫలితం:" : "Classification:"}</strong> <span class="panchaka-box__classification-name--${mod}">${panName}</span> — <em>${panEffect}</em></div>
          ${panPariharam && !isPass ? `
            <div class="panchaka-box__remedy">
              <strong>${Icon("leaf")} ${currentLang === "te" ? "శాస్త్రోక్త పరిహారం:" : "Classical Remedy:"}</strong> ${panPariharam}
            </div>
          ` : ''}
        </div>
      </div>`;
  } else if (panDiv) {
    panDiv.innerHTML = "";
  }
}

function renderKalaVibhajana(p) {
  const kvDiv = el("vKalaVibhajanaSection");
  const kv = p.kala_vibhajana;
  if (kv && kvDiv) {
    kvDiv.innerHTML = `
      <div class="kv-section">
        <h4 class="kv-header">
          <span>${Icon("hourglass")} ${currentLang === "te" ? "రోజు మొత్తంలో కాల విభజన (పంచధా కాల విభజన)" : "Daily 5-Fold Time Division (Kala Vibhajana)"}</span>
          <span class="kv-header__sub">${currentLang === "te" ? "పగలు 5 భాగాలు + రాత్రి పవిత్ర కాలాలు" : "5 Day divisions + Night Sacred Periods"}</span>
        </h4>
        <div class="kv-grid">
          <div class="kv-card">
            <div class="kv-card__name kv-card__name--pratah">${Icon("sunrise")} ${currentLang === "te" ? kv.pratah_kalam?.name_te : kv.pratah_kalam?.name_en}</div>
            <div class="kv-card__time">${kv.pratah_kalam?.start} – ${kv.pratah_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.pratah_kalam?.desc_te : kv.pratah_kalam?.desc_en}</div>
          </div>
          <div class="kv-card">
            <div class="kv-card__name kv-card__name--sangava">${Icon("sun")} ${currentLang === "te" ? kv.sangava_kalam?.name_te : kv.sangava_kalam?.name_en}</div>
            <div class="kv-card__time">${kv.sangava_kalam?.start} – ${kv.sangava_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.sangava_kalam?.desc_te : kv.sangava_kalam?.desc_en}</div>
          </div>
          <div class="kv-card kv-card--highlight">
            <div class="kv-card__name kv-card__name--madhya">${Icon("sun")} ${currentLang === "te" ? kv.madhyahnika_kalam?.name_te : kv.madhyahnika_kalam?.name_en} <span class="kv-tag">అభిజిత్</span></div>
            <div class="kv-card__time">${kv.madhyahnika_kalam?.start} – ${kv.madhyahnika_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.madhyahnika_kalam?.desc_te : kv.madhyahnika_kalam?.desc_en}</div>
          </div>
          <div class="kv-card">
            <div class="kv-card__name kv-card__name--aparahna">${Icon("cloud-sun")} ${currentLang === "te" ? kv.aparahna_kalam?.name_te : kv.aparahna_kalam?.name_en}</div>
            <div class="kv-card__time">${kv.aparahna_kalam?.start} – ${kv.aparahna_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.aparahna_kalam?.desc_te : kv.aparahna_kalam?.desc_en}</div>
          </div>
          <div class="kv-card">
            <div class="kv-card__name kv-card__name--sayahna">${Icon("sunset")} ${currentLang === "te" ? kv.sayahna_kalam?.name_te : kv.sayahna_kalam?.name_en}</div>
            <div class="kv-card__time">${kv.sayahna_kalam?.start} – ${kv.sayahna_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.sayahna_kalam?.desc_te : kv.sayahna_kalam?.desc_en}</div>
          </div>
          <div class="kv-card kv-card--sacred">
            <div class="kv-card__name kv-card__name--sacred">${Icon("moon")} ${currentLang === "te" ? "రాత్రి విశేష కాలములు" : "Night Sacred Timings"}</div>
            <div class="kv-card__sacred-times">
              <strong>${currentLang === "te" ? "ప్రదోషం:" : "Pradosha:"}</strong> ${kv.pradosha_kalam?.start} – ${kv.pradosha_kalam?.end}<br>
              <strong>${currentLang === "te" ? "నిశీథ కాలం:" : "Nisitha:"}</strong> ${kv.nisitha_kalam?.start} – ${kv.nisitha_kalam?.end}<br>
              <strong>${currentLang === "te" ? "బ్రాహ్మీ ముహూర్తం:" : "Brahma:"}</strong> ${kv.brahma_muhurtham?.start} – ${kv.brahma_muhurtham?.end}
            </div>
          </div>
        </div>
      </div>`;
  } else if (kvDiv) {
    kvDiv.innerHTML = "";
  }
}

function renderFavorableActivities(data) {
  const favDiv = el("vFavorableActivities");
  favDiv.innerHTML = "";
  if (data.favorable_activities && data.favorable_activities.length > 0) {
    data.favorable_activities.forEach(act => {
      const name = currentLang === "te" ? (act.activity_name_te || act.name_te) : (act.activity_name_en || act.name_en);
      const reasonsList = (act.reasons_favorable || []).map(r => `<li>${r}</li>`).join("");
      favDiv.innerHTML += `
    <div class="activity-item favorable">
      <div class="activity-name">
        <span>${name}</span>
        <span class="activity-verdict-badge favorable">${currentLang === "te" ? "అనుకూలం" : "Favorable"}</span>
      </div>
      <ul class="activity-reasons">${reasonsList || `<li>${currentLang === "te" ? "ఈ పని చేయడానికి ఈ రోజు అనుకూలంగా ఉంది" : "Favorable conditions met."}</li>`}</ul>
    </div>
  `;
    });
  } else {
    favDiv.innerHTML = `<div class="empty-msg">${currentLang === "te" ? "అనుకూలమైన ముహూర్తాలు ఏవీ లేవు" : "No favorable activities found for this date."}</div>`;
  }
}

function renderAvoidActivities(data) {
  const avoidDiv = el("vAvoidActivities");
  avoidDiv.innerHTML = "";
  const avoidList = (data.avoid_activities || []).concat(data.mixed_activities || []);
  if (avoidList.length > 0) {
    avoidList.forEach(act => {
      const name = currentLang === "te" ? (act.activity_name_te || act.name_te) : (act.activity_name_en || act.name_en);
      const isMixed = act.verdict === "mixed";
      const badgeClass = isMixed ? "mixed" : "avoid";
      const badgeText = currentLang === "te" ? (isMixed ? "మిశ్రమం" : "వర్జ్యం / నిషిద్ధం") : (isMixed ? "Mixed" : "Avoid");
      const reasonsList = (act.reasons_avoid || []).map(r => `<li>${r}</li>`).join("");
      avoidDiv.innerHTML += `
    <div class="activity-item ${badgeClass}">
      <div class="activity-name">
        <span>${name}</span>
        <span class="activity-verdict-badge ${badgeClass}">${badgeText}</span>
      </div>
      <ul class="activity-reasons">${reasonsList || `<li>${currentLang === "te" ? "వ్యతిరేక పరిస్థితులు ఉన్నందున ఈ రోజు అనుకూలం కాదు" : "Unfavorable conditions met."}</li>`}</ul>
    </div>
  `;
    });
  } else {
    avoidDiv.innerHTML = `<div class="empty-msg">${currentLang === "te" ? "నిషిద్ధ పనులు ఏవీ లేవు" : "No activities to avoid."}</div>`;
  }
}
