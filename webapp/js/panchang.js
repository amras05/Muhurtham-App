// ============================================================
// Gayathri Jyothirnidhe · component: panchang lookup panel
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
  te: ["జనవరి", "మార్చి", "మే", "జూలై", "సెప్టెంబర్", "నవంబర్"],
};
// Weekday lord, its Navagraha stotram verse (Vyasa) and its grain (navadhanya) for the shloka card.
const PD_VAARA = {
  Sunday:    { lord: ["the Sun"], grain: ["wheat"],
               verse: "జపాకుసుమ సంకాశం<br>కాశ్యపేయం మహాద్యుతిమ్ |<br>తమోఽరిం సర్వపాపఘ్నం<br>ప్రణతోఽస్మి దివాకరమ్ ||",
               mean: ["I bow to the Sun, red as the hibiscus, the radiant son of Kashyapa, the enemy of darkness who removes every sin."] },
  Monday:    { lord: ["the Moon"], grain: ["rice"],
               verse: "దధిశంఖ తుషారాభం<br>క్షీరోదార్ణవ సంభవమ్ |<br>నమామి శశినం సోమం<br>శంభోర్మకుట భూషణమ్ ||",
               mean: ["I bow to the Moon, white as curd, conch and snow, born of the ocean of milk, the jewel on Shiva's crown."] },
  Tuesday:   { lord: ["Mars"], grain: ["red gram"],
               verse: "ధరణీగర్భ సంభూతం<br>విద్యుత్కాంతి సమప్రభమ్ |<br>కుమారం శక్తిహస్తం తం<br>మంగళం ప్రణమామ్యహమ్ ||",
               mean: ["I bow to Mars, born of the earth, bright as lightning, the youth who holds the spear."] },
  Wednesday: { lord: ["Mercury"], grain: ["green gram"],
               verse: "ప్రియంగు కలికాశ్యామం<br>రూపేణాప్రతిమం బుధమ్ |<br>సౌమ్యం సౌమ్యగుణోపేతం<br>తం బుధం ప్రణమామ్యహమ్ ||",
               mean: ["I bow to Mercury, dark as the priyangu bud, of matchless form, gentle and of gentle nature."] },
  Thursday:  { lord: ["Jupiter"], grain: ["Bengal gram"],
               verse: "దేవానాం చ ఋషీణాం చ<br>గురుం కాంచన సన్నిభమ్ |<br>బుద్ధిభూతం త్రిలోకేశం<br>తం నమామి బృహస్పతిమ్ ||",
               mean: ["I bow to Brihaspati, teacher of the gods and sages, golden in colour, wisdom itself, lord of the three worlds."] },
  Friday:    { lord: ["Venus"], grain: ["cowpeas"],
               verse: "హిమకుంద మృణాలాభం<br>దైత్యానాం పరమం గురుమ్ |<br>సర్వశాస్త్ర ప్రవక్తారం<br>భార్గవం ప్రణమామ్యహమ్ ||",
               mean: ["I bow to Venus, white as snow, jasmine and lotus stalk, the great teacher of the daityas, who expounds all the shastras."] },
  Saturday:  { lord: ["Saturn"], grain: ["sesame"],
               verse: "నీలాంజన సమాభాసం<br>రవిపుత్రం యమాగ్రజమ్ |<br>ఛాయామార్తాండ సంభూతం<br>తం నమామి శనైశ్చరమ్ ||",
               mean: ["I bow to Saturn, dark as blue collyrium, son of the Sun and elder brother of Yama, born of Chhaya and the Sun."] },
};
// The nine traditionally inauspicious yogas, by index (1 = Vishkambha … 27 = Vaidhriti).
// Lord of each sign, Mesha first (for "lagna lord" on the lagna card).
const PD_SIGN_LORD = [["Mars"], ["Venus"], ["Mercury"], ["Moon"], ["Sun"], ["Mercury"],
  ["Venus"], ["Mars"], ["Jupiter"], ["Saturn"], ["Saturn"], ["Jupiter"]];
const PD_BAD_YOGAS = new Set([1, 6, 9, 10, 13, 15, 17, 19, 27]);
// Chandrabalam by the Moon's house from a rashi: the same rule as compute_chandrabalam on the server.
const PD_CB = { good: [1, 3, 6, 7, 10, 11], moderate: [2, 5, 9], ashtama: [8] };
// Traditional result of the Moon's transit through each house (gochara phala).
const PD_GOCHARA = [null,
  ["Comfort and good food"], ["Expense of money"],
  ["Success and gain"], ["Fear and quarrels"],
  ["Worry and obstacles"], ["Victory over enemies, good health"],
  ["Comforts and happiness at home"], ["Danger and ill health (chandrashtama)"],
  ["Illness and hindrances"], ["Success in work, honour"],
  ["Gains and happiness"], ["Expenses and loss"]];
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
  if (day > 0) return `${txt} ${t("(next day)")}`;
  if (day < 0) return `${txt} ${t("(previous day)")}`;
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
    [t("Rahu kalam"), [p.rahu_kalam], "bad"], [t("Yamagandam"), [p.yamagandam], "bad"],
    [t("Gulika kalam"), [p.gulika_kalam], "bad"], [t("Durmuhurtam"), p.durmuhurtam || [], "bad"],
    [t("Varjyam"), (p.varjyam_all || [p.varjyam]), "bad"], [t("Abhijit muhurtam"), [p.abhijit_muhurta], "good"],
    [t("Amrit kalam"), p.amrit_kalam || [], "good"], [t("Brahma muhurtam"), [p.brahma_muhurta], "good"],
    [t("Godhuli muhurtam"), [p.godhuli_muhurta], "good"],
  ].filter(([, arr]) => arr.some(o => pdIn(o, nowMins)));
  const tags = periods.map(([label, , mod]) => `<span class="pd-chip pd-chip--${mod}">${label}</span>`).join(" ");
  const parts = [
    `${esc(te(cur.tithi.name, TITHI_NAMES_TE))} ${t("tithi")}`,
    `${esc(te(cur.nakshatra.name, NAKSHATRA_NAMES_TE))} ${t("pada {pada}", { pada: cur.nakshatra.pada })}`,
    `${esc(te(cur.yoga.name, YOGA_NAMES_TE))} ${t("yoga")}`,
    `${esc(te(cur.karana.name, KARANA_NAMES_TE))} ${t("karana")}`,
    lagnaNow ? `${esc(T(lagnaNow.lagna_name, lagnaNow.lagna_name_te))} ${t("lagna")}` : null,
  ].filter(Boolean);
  return `
    <div class="pd-live" role="status">
      <span class="pd-live__clock"><span class="pd-live__pulse"></span>${t("Now")} ${pdClock(nowMins)}</span>
      <span class="pd-live__angas">${parts.join('<span class="pd-ribbon__sep">•</span>')}</span>
      <span class="pd-live__tags">${tags || `<span class="pd-chip pd-chip--neutral">${t("No special period running")}</span>`}</span>
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

// 1st, 2nd, 3rd, 4th … 11th, 12th
// An ordinal for the page's language: "3rd" in English, "3వ" in Telugu (21 Nov 2026)
function pdOrdLang(n) { return currentLang === "te" ? n + "వ" : pdOrd(n); }
function pdOrd(n) {
  const k = n % 100;
  return n + (k >= 11 && k <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"));
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
  if (el("pdPanchaka")) el("pdPanchaka").innerHTML = pdPanchaka(ctx);
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
  show(el("pdPanchaka"), on("yogas_panchaka"));
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
    cm.samvatsara_name ? t("{name} nama samvatsara", { name: currentLang === "te" ? (cm.samvatsara_telugu || cm.samvatsara_name) : cm.samvatsara_name }) : null,
    T(cm.ayanam_en, cm.ayanam_te), T(cm.ruthu_en, cm.ruthu_te),
    masa ? masa + (cm.is_adhika_masa ? ` (${t("Adhika")})` : "") : null,
  ].filter(Boolean);

  // Lagna card: the lagna running now (today) or at sunrise (any other day).
  const ls = p.lagna_schedule || [];
  let lagna = ls[0], lagnaLabel = t("Lagna at sunrise");
  if (isToday) {
    const now = ls.find(l => pdMins(l.start_time) <= nowMins && nowMins < pdMins(l.end_time));
    if (now) { lagna = now; lagnaLabel = t("Current lagna"); }
  }
  const amrit = (p.amrit_kalam || [])[0];
  const abh = p.abhijit_kala_muhurtham;
  const abhClean = abh && abh.status === "auspicious";
  const running = (o) => isToday && pdIn(o, nowMins);

  // One status card (Stitch design): label with a dot and an icon on top, the big value, lines, a chip.
  const tile = (icon, mod, label, big, lines, chip, isNow) => `
    <div class="pd-tile pd-tile--${mod}${isNow ? " pd-tile--now" : ""}">
      <div class="pd-tile__top"><span class="pd-tile__label"><span class="pd-tile__dot"></span>${label}</span><span class="pd-tile__icon">${Icon(icon)}</span></div>
      <div class="pd-tile__big">${big}</div>
      ${lines ? `<div class="pd-tile__lines">${lines}</div>` : ""}
      ${chip || isNow ? `<div class="pd-tile__chips">${isNow ? `<span class="pd-chip pd-chip--live">${t("Now")}</span>` : ""}${chip ? `<span class="pd-chip pd-chip--${mod === "bad" ? "bad" : mod === "gold" ? "gold" : "good"}">${chip}</span>` : ""}</div>` : ""}
    </div>`;
  const lagnaLord = lagna ? PD_SIGN_LORD[(lagna.lagna_index || lagna.rasi_index || 1) - 1] : null;
  const lagnaCard = lagna ? tile("sparkle", "good", lagnaLabel, esc(T(lagna.lagna_name, lagna.lagna_name_te)),
    `<span>${pdTime(lagna.start_time)} – ${pdTime(lagna.end_time)}</span>` +
    (lagnaLord ? `<small>${t("Lagna lord")}: ${t(lagnaLord)}</small>` : ""), "", false) : "";

  const place = esc(p.place || "");
  return `
    <div class="pd-head">
      <div class="pd-head__left">
        <div class="pd-head__line">
          <span class="pd-badge">${isToday ? t("Today") : t("Panchangam")}</span>
          <h1>${d} ${months[(m || 1) - 1]} ${y} <span>${esc(vaara)}</span></h1>
          <span class="pd-ribbon">${Icon("sparkle")} ${ribbon.map(esc).join(" · ")}</span>
        </div>
        <p class="pd-head__sub">${esc(masa)} ${esc(paksha)} ${esc(tithi)} · ${esc(nak)}
          <span class="pd-head__place">${Icon("pin")} ${place}${PD_TODAY_ONLY() ? ` · <a href="family.html#home">${t("Change place")}</a>` : ""}</span></p>
      </div>
      <div class="pd-head__right no-print">
        ${PD_TODAY_ONLY()
          ? `<span class="pd-datenav"><span class="pd-datenav__today" aria-current="date">${Icon("calendar")} ${t("Today@@panchang")}</span></span>
             <a class="pd-head__cal" href="panchang-month.html">${Icon("calendar")} ${t("Month view")}</a>`
          : `<span class="pd-datenav" role="group" aria-label="${t("Change date")}">
               <button type="button" class="pd-datenav__btn" data-pd-shift="-1" aria-label="${t("Previous day")}">‹</button>
               <button type="button" class="pd-datenav__today" data-pd-today ${isToday ? 'aria-current="date"' : ""}>${t("Today@@panchang")}</button>
               <button type="button" class="pd-datenav__btn" data-pd-shift="1" aria-label="${t("Next day")}">›</button>
             </span>`}
      </div>
    </div>
    ${isToday ? pdLiveStrip({ p, nowMins, cur, live, lagnaNow: lagna }) : ""}
    <div class="pd-tiles">
      ${isToday ? pdLiveTiles({ p, nowMins, cur, lagnaCard, tile }) : `
      ${lagnaCard}
      ${tile("alert", "bad", t("Rahu kalam"), pdRange(p.rahu_kalam), "", t("Avoid@@panchang"), running(p.rahu_kalam))}
      ${tile("star", abhClean ? "gold" : "warn", t("Abhijit muhurtam"), pdRange(p.abhijit_muhurta), "",
             abhClean ? t("Clean@@panchang") : t("Check"), running(p.abhijit_muhurta))}
      ${tile("leaf", "good", t("Amrit kalam"), amrit ? pdRange(amrit) : "—", "", "", (p.amrit_kalam || []).some(running))}`}
    </div>`;
}

// "1 h 5 min" / "1 గం. 5 నిమి."
function pdDur(mins) {
  const m = Math.max(0, Math.round(mins)), h = Math.floor(m / 60), r = m % 60;
  return h ? t("{h} h {r} min", { h: h, r: r }) : t("{r} min", { r: r });
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
function pdLiveTiles({ p, nowMins, cur, lagnaCard, tile }) {
  const card = (r, icon, mod, title) => {
    if (r.state === "none") return tile(icon, "neutral", title, t("No more today"), "", "", false);
    const extra = (r.others || []).map(x => x.label).join(", ");
    const sub = r.state === "now"
      ? t("{nowMins} left", { nowMins: pdDur(r.b - nowMins) }) + (extra ? ` · ${t("also")} ${esc(extra)}` : "")
      : t("starts in {nowMins}", { nowMins: pdDur(r.a - nowMins) });
    const label = r.state === "now" ? title : t("Next: {title}", { title: title });
    return tile(icon, r.state === "now" ? mod : "neutral", label, pdRange(r.o), `<span>${esc(r.label)}</span><small>${sub}</small>`, "", r.state === "now");
  };
  const badRows = (P, sh) => [
    [t("Rahu kalam"), [P.rahu_kalam].map(sh)], [t("Yamagandam"), [P.yamagandam].map(sh)],
    [t("Gulika kalam"), [P.gulika_kalam].map(sh)], [t("Durmuhurtam"), (P.durmuhurtam || []).map(sh)],
    [t("Varjyam"), (P.varjyam_all || [P.varjyam]).map(sh)]];
  const goodRows = (P, sh) => [
    [t("Abhijit muhurtam"), [P.abhijit_muhurta].map(sh)], [t("Amrit kalam"), (P.amrit_kalam || []).map(sh)],
    [t("Brahma muhurtam"), [P.brahma_muhurta].map(sh)], [t("Godhuli muhurtam"), [P.godhuli_muhurta].map(sh)]];
  const same = (o) => o;
  // Tomorrow's periods count only after today's (they are shifted by a day), so today's always come first.
  const tomorrow = pdNextDayP && pdNextDayP.date > p.date ? pdNextDayP : null;
  const bad = pdRunningOrNext(badRows(p, same).concat(tomorrow ? badRows(tomorrow, pdShiftDay) : []), nowMins);
  const good = pdRunningOrNext(goodRows(p, same).concat(tomorrow ? goodRows(tomorrow, pdShiftDay) : []), nowMins);
  const out = [lagnaCard, card(bad, "alert", "bad", t("Bad time")), card(good, "star", "gold", t("Good time"))];

  // A blinking "Live" badge on each of today's cards.
  const badge = `<span class="pd-livedot" aria-label="${t("Live")}"><span class="pd-livedot__dot"></span>${t("LIVE")}</span>`;
  return out.filter(Boolean).map(h => h.replace(/(<div class="pd-tile [^"]*">)/, `$1${badge}`)).join("");
}

function pdAngas({ p, isToday, nowMins, cur, live }) {
  const tv = cur.tithi, n = cur.nakshatra, y = cur.yoga, k = cur.karana;
  const paksha = PAKSHA_NAMES[currentLang][tv.paksha] || tv.paksha;
  const until = (str) => t("{time}@@until", { time: pdTime(str) });

  let bar = "";
  const ts = pdMins(tv.start_time), tend = pdMins(tv.end_time);
  if (isToday && ts != null && tend != null && tend > ts) {
    const left = Math.max(0, Math.min(100, Math.round(100 * (tend - nowMins) / (tend - ts))));
    bar = `<div class="pd-progress" role="img" aria-label="${t("{left}% of the tithi left", { left: left })}"><span style="width:${100 - left}%"></span></div>
           <div class="pd-anga__sub">${t("Began")}: ${pdTime(tv.start_time)} · ${t("Left")}: ${left}%</div>`;
  }

  // Each pada with its navamsa rashi (nakshatra n, pada k → navamsa ((n-1)*4 + k - 1) mod 12 + 1).
  const nakIdx = Number(n.index) || 0;
  const padas = (n.padas || []).map(pd => {
    const s = pdMins(pd.start_time), e = pdMins(pd.end_time);
    const state = isToday && e != null && e <= nowMins ? "past" : (isToday && s != null && s <= nowMins && nowMins < e ? "now" : "");
    const nav = nakIdx ? (((nakIdx - 1) * 4 + Number(pd.pada) - 1) % 12) + 1 : null;
    return `<div class="pd-pada ${state ? "pd-pada--" + state : ""}">
      <strong>${t("Pada {pada}", { pada: pd.pada })}</strong>${nav ? `<span>${pdRasiName(nav)}</span>` : ""}
      <small>${state === "now" ? t("now") : state === "past" ? t("over") : t("to come")}</small></div>`;
  }).join("");
  const next = n.next ? `<div class="pd-anga__sub">${t("Next: {name} from {time}", { name: currentLang === "te" ? te(n.next.name, NAKSHATRA_NAMES_TE) : n.next.name, time: pdTime(n.next.start_time) })}</div>` : "";

  const yogaBad = PD_BAD_YOGAS.has(Number(y.index));
  const kName = String(k.name || "");
  const kKind = /vishti|bhadra/i.test(kName) ? ["bad", t("Vishti (Bhadra): avoid")]
    : /shakuni|chatushpada|naga|kimstughna/i.test(kName) ? ["neutral", t("Sthira karana")]
    : ["neutral", t("Chara karana")];
  const lord = (PD_VAARA[p.vaara] || {}).lord || ["", ""];

  const row = (num, label, chip, chipMod, title, right, body) => `
    <div class="pd-anga">
      <div class="pd-anga__head"><span class="pd-anga__label">${num}. ${label}</span>${chip ? `<span class="pd-chip pd-chip--${chipMod}">${chip}</span>` : ""}</div>
      <div class="pd-anga__main"><h3>${title}</h3>${right ? `<span class="pd-anga__until">${right}</span>` : ""}</div>
      ${body || ""}
    </div>`;

  return `
    <div class="pd-card__titlerow">
      <h2 class="pd-card__title"><span class="pd-square"></span> ${t("The five angas")}</h2>
      <span class="pd-chip pd-chip--neutral">${live ? t("Now · {nowMins}", { nowMins: pdClock(nowMins) }) : t("At sunrise")}</span>
    </div>
    <div class="pd-angas__list">
      ${row(1, t("Tithi@@panchang"), esc(paksha), "gold", esc(te(tv.name, TITHI_NAMES_TE)), until(tv.end_time), bar)}
      ${row(2, t("Nakshatra@@panchang"), t("Pada {pada}", { pada: n.pada }), "gold", esc(te(n.name, NAKSHATRA_NAMES_TE)), until(n.end_time),
            (padas ? `<div class="pd-padas">${padas}</div>` : "") + next)}
      ${row(3, t("Vara"), "", "", esc(T(p.vaara, (VAARA_NAMES.te || {})[p.vaara] || p.vaara)), "",
            `<div class="pd-anga__sub">${t("Lord of the day")}: ${t(lord)}</div>`)}
      ${row(4, t("Yoga@@panchang"), yogaBad ? t("Inauspicious") : t("Auspicious"),
            yogaBad ? "bad" : "good", esc(te(y.name, YOGA_NAMES_TE)), until(y.end_time), "")}
      ${row(5, t("Karana"), kKind[1], kKind[0], esc(te(k.name, KARANA_NAMES_TE)), until(k.end_time), "")}
    </div>`;
}

function pdLuminaries({ p }) {
  const L = p.luminaries || {};
  const sr = pdMins(p.sunrise), ss = pdMins(p.sunset);
  const dayLen = sr != null && ss != null ? ss - sr : null;
  const hm = (v) => t("{v} h {v2} min", { v: Math.floor(v / 60), v2: Math.round(v % 60) });
  const moonNext = L.moon_rasi_end_time
    ? t("enters {next_moon_rasi_index} at {moon_rasi_end_time}", { next_moon_rasi_index: pdRasiName(L.next_moon_rasi_index), moon_rasi_end_time: pdTime(L.moon_rasi_end_time) })
    : t("in this rashi all day");
  const box = (icon, label, time, line) => `
    <div class="pd-lum"><span class="pd-lum__label">${Icon(icon)} ${label}</span><strong>${time}</strong><small>${line}</small></div>`;
  return `
    <div class="pd-card__titlerow"><h2 class="pd-card__title">${t("Sun and Moon")}</h2><span class="pd-card__icon">${Icon("sun")}</span></div>
    <div class="pd-lum-grid">
      ${box("sunrise", t("Sunrise"), pdTime(p.sunrise), `${pdRasiName(L.sun_rasi_index)} ${t("rashi")}`)}
      ${box("sunset", t("Sunset"), pdTime(p.sunset), t("Sun sets"))}
      ${box("moon", t("Moonrise"), pdTime(L.moonrise), `${pdRasiName(L.moon_rasi_index)} ${t("rashi")}`)}
      ${box("moon", t("Moonset"), pdTime(L.moonset), moonNext)}
    </div>
    ${dayLen != null ? `<div class="pd-lum__foot"><span>${t("Day")}: ${hm(dayLen)}</span><span>${t("Night (about)")}: ${hm(1440 - dayLen)}</span></div>` : ""}`;
}

function pdTimes({ p, isToday, nowMins }) {
  const good = [
    [t("Abhijit muhurtam"), [p.abhijit_muhurta]],
    [t("Amrit kalam"), p.amrit_kalam || []],
    [t("Brahma muhurtam"), [p.brahma_muhurta]],
    [t("Godhuli muhurtam"), [p.godhuli_muhurta]],
  ];
  const bad = [
    [t("Rahu kalam"), [p.rahu_kalam]],
    [t("Yamagandam"), [p.yamagandam]],
    [t("Gulika kalam"), [p.gulika_kalam]],
    [t("Durmuhurtam"), p.durmuhurtam || []],
    [t("Varjyam"), (p.varjyam_all || [p.varjyam])],
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
  const nowMark = isToday ? `<span class="pd-now" style="left:${(nowMins / 14.4).toFixed(2)}%" title="${t("Now")}"></span>` : "";
  const list = (rows, mod) => rows.map(([label, arr]) => {
    const real = arr.filter(o => o && o.start);
    const isNow = isToday && real.some(o => pdIn(o, nowMins));
    const vals = real.map(pdRange);
    return `<div class="pd-time pd-time--${mod}${isNow ? " pd-time--now" : ""}">
      <span>${label}${isNow ? ` <span class="pd-chip pd-chip--live">${t("Now")}</span>` : ""}</span>
      <strong>${vals.length ? vals.join("<br>") : "—"}</strong></div>`;
  }).join("");

  const yogas = (p.special_yogas || []).map(y =>
    `<li class="pd-yoga pd-yoga--${y.type === "bad" ? "bad" : y.type === "info" ? "info" : "good"}">${esc(T(y.name_en, y.name_te))}</li>`).join("");

  return `
    <div class="pd-card__titlerow">
      <h2 class="pd-card__title"><span class="pd-square"></span> ${t("The day's timings")}</h2>
      <div class="pd-legend"><span class="pd-legend__good">${t("Good")}</span><span class="pd-legend__bad">${t("Avoid@@panchang")}</span></div>
    </div>
    <div class="pd-timeline" aria-hidden="true">
      <div class="pd-track">${dayBand}${track(good, "good")}${nowMark}</div>
      <div class="pd-track">${dayBand}${track(bad, "bad")}${nowMark}</div>
      <div class="pd-axis"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>
    </div>
    <div class="pd-times">
      <div class="pd-times__col pd-times__col--good"><h3>${Icon("star")} ${t("Auspicious@@panchang")}</h3>${list(good, "good")}</div>
      <div class="pd-times__col pd-times__col--bad"><h3>${Icon("alert")} ${t("Inauspicious@@panchang")}</h3>${list(bad, "bad")}</div>
    </div>
    <div class="pd-minis">
      <div class="pd-mini pd-mini--gold">
        <div class="pd-mini__head"><span>${Icon("sparkle")} ${t("Special yogas today")}</span></div>
        ${yogas ? `<ul class="pd-yogas">${yogas}</ul>` : `<p>${t("No special yoga today.")}</p>`}
      </div>
    </div>`;
}

// Panchaka rahitam (Stitch design): the five named panchakas, the one that applies marked. Remainders
// 1 mrityu, 2 agni, 4 raja, 6 chora, 8 roga; any other remainder is panchaka-free.
function pdPanchaka({ p }) {
  const pan = p.panchaka_rahitam;
  if (!pan) return "";
  const kinds = [[1, "Mrityu"], [2, "Agni"], [4, "Raja"], [6, "Chora"], [8, "Roga"]];
  const rem = Number(pan.remainder);
  return `
    <div class="pd-card__titlerow">
      <h2 class="pd-card__title">${t("Panchaka rahitam@@panchang")}</h2>
      <span class="pd-chip pd-chip--${pan.is_pass ? "good" : "bad"}">${pan.is_pass ? t("No dosha (remainder {rem})", { rem: rem }) : esc(T(pan.name_en, pan.name_te))}</span>
    </div>
    <p class="pd-card__sub" title="${esc(pan.formula || "")}">${t("From today's tithi, weekday, nakshatra and the sunrise lagna.")}</p>
    <div class="pd-pan">${kinds.map(([r, en, teName]) => `
      <div class="pd-pan__box ${rem === r ? "is-hit" : ""}"><span>${T(`${en} panchakam`, teName)}</span>
        <strong>${rem === r ? "✕ " + t("Present") : "✓ " + t("Free")}</strong></div>`).join("")}
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
    const chip = { good: t("Good ✓"), moderate: t("Moderate"), ashtama: t("8th ✕"), bad: t("Weak ✕") }[kind];
    return { house, kind, chip };
  };
  const btns = [...Array(12)].map((_, i) => {
    const r = i + 1, inf = info(r);
    const pos = inf.house === 1 ? t("Janma (1st)") : inf.house === 8 ? t("8th: ashtama") : t("{ord} Moon", { ord: pdOrdLang(inf.house) });
    return `<button type="button" class="pd-rasi pd-rasi--${inf.kind}" data-pd-rasi="${r}" aria-pressed="${r === pdSelectedRasi}">
      <strong>${pdRasiName(r)}</strong><span class="pd-rasi__pos">${pos}</span><small>${inf.chip}</small></button>`;
  }).join("");
  const sel = info(pdSelectedRasi);
  const g = PD_GOCHARA[sel.house];
  const kindText = { good: t("Full chandrabalam"), moderate: t("Moderate chandrabalam"),
                     ashtama: t("Chandrashtama: avoid"), bad: t("Weak chandrabalam") }[sel.kind];
  return `
    <div class="pd-card__titlerow">
      <div><h2 class="pd-card__title">${t("Chandrabalam for the 12 rashis")}</h2>
        <p class="pd-card__sub">${isToday
          ? t("From the Moon in {moon} now", { moon: pdRasiName(moon) })
          : t("From the Moon in {moon} at sunrise", { moon: pdRasiName(moon) })}</p></div>
      <span class="pd-card__hint">${t("Pick your rashi")}</span>
    </div>
    <div class="pd-rasis" role="group" aria-label="${t("Rashis")}">${btns}</div>
    <div class="pd-rasi-detail pd-rasi-detail--${sel.kind}" aria-live="polite">
      <span class="pd-rasi-detail__icon">${Icon("moon")}</span>
      <div>
        <h3>${pdRasiName(pdSelectedRasi)} ${t("rashi")}: ${t("Moon in the {ord} house", { ord: pdOrdLang(sel.house) })}
          <span class="pd-chip pd-chip--${sel.kind === "good" ? "good" : sel.kind === "moderate" ? "gold" : "bad"}">${kindText}</span></h3>
        <p>${t("Traditional result")}: ${t(g)}.</p>
        ${L.moon_rasi_end_time && !moved ? `<p class="pd-rasi-detail__note">${t("The Moon enters {next_moon_rasi_index} at {moon_rasi_end_time}; after that, count from there.", { next_moon_rasi_index: pdRasiName(L.next_moon_rasi_index), moon_rasi_end_time: pdTime(L.moon_rasi_end_time) })}</p>` : ""}
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
      <strong>${esc(t("{name} lagna", { name: currentLang === "te" ? l.lagna_name_te : l.lagna_name }))}</strong>
      <span>${pdTime(l.start_time)} – ${pdTime(l.end_time)}${i === curIdx ? ` ${Icon("star", { filled: true })}` : ""}</span>
    </li>`).join("");
  return `
    <div class="pd-card__titlerow"><h2 class="pd-card__title">${t("The 12 lagnas")}</h2>
      <span class="pd-card__hint">${t("24 hours")}</span></div>
    <p class="pd-card__sub">${esc(p.place || "")} · ${t("from sunrise")}</p>
    <ol class="pd-lagnas">${items}</ol>`;
}

function pdDos({ data }) {
  const name = a => T(a.activity_name_en || a.name_en, a.activity_name_te || a.name_te);
  const why = (arr) => esc((arr || []).join("; "));
  const fav = (data.favorable_activities || []).slice(0, 6);
  const avoid = (data.avoid_activities || []).slice(0, 6);
  const li = (a, reasons, mod) => `<li class="pd-do pd-do--${mod}" title="${why(reasons)}">${esc(name(a))}</li>`;
  return `
    <div class="pd-card__titlerow"><h2 class="pd-card__title">${t("Good for / avoid today")}</h2><span class="pd-card__icon">${Icon("scroll")}</span></div>
    <div class="pd-dos">
      <div class="pd-dos__box pd-dos__box--good"><h3>${t("Good for (do's)")}</h3>
        ${fav.length ? `<ul>${fav.map(a => li(a, a.reasons_favorable, "good")).join("")}</ul>` : `<p>${t("Nothing in particular.")}</p>`}</div>
      <div class="pd-dos__box pd-dos__box--bad"><h3>${t("Avoid (don'ts)")}</h3>
        ${avoid.length ? `<ul>${avoid.map(a => li(a, a.reasons_avoid, "bad")).join("")}</ul>` : `<p>${t("Nothing in particular.")}</p>`}</div>
    </div>
    <p class="pd-card__sub">${t("Reasons for each are under \"More details\" below.")}</p>`;
}

function pdShloka({ p }) {
  const v = PD_VAARA[p.vaara];
  if (!v) return "";
  return `
    <div class="pd-shloka__head">${Icon("scroll")} ${t("Today's shloka: {lord}", { lord: v.lord[currentLang === "te" ? 1 : 0] })}</div>
    <div class="pd-shloka__body">
      <p class="pd-shloka__verse" lang="sa">"${v.verse}"</p>
      <hr>
      <p class="pd-shloka__meaning"><strong>${t("Meaning")}:</strong> ${t(v.mean)}</p>
    </div>
    <div class="pd-shloka__foot"><span>${t("Navagraha stotram (Vyasa)")}</span>
      <span>${t("Grain to give: {grain}", { grain: v.grain[currentLang === "te" ? 1 : 0] })}</span></div>`;
}

// An editable text from Settings › Texts (plan D8), or the page's own wording.
function pdText(key, en) {
  return window.SiteConfig ? SiteConfig.text(key, en) : t(en);
}

function pdCta() {
  const pdf = window.SiteConfig && SiteConfig.sharingOn ? SiteConfig.sharingOn("pdf") : false;
  return `
    <div class="pd-cta__text">
      <span class="pd-cta__icon">${Icon("lamp")}</span>
      <div><strong>${esc(pdText("today_cta_title", "Looking for a muhurta?"))}</strong>
        <span>${esc(pdText("today_cta_text", "The Muhurta Finder checks every rule of the book for your event, person and place."))}</span></div>
    </div>
    <div class="pd-cta__actions">
      ${pdf ? `<button type="button" class="btn btn--outline" onclick="exportSmartPdf()">${Icon("printer")} ${t("Print panchang (PDF)")}</button>` : ""}
      <a class="pd-cta__btn" href="muhurta-finder.html">★ ${t("Find a muhurta")} →</a>
    </div>`;
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
            ${Icon("wheel")} ${t("Panchaka Rahitam Analysis")}
          </h4>
          <span class="panchaka-box__badge panchaka-box__badge--${mod}">
            ${isPass ? (t("Subha (Clean)")) : (t("Dosha@@panchang"))}
          </span>
        </div>
        <div class="panchaka-box__body">
          <div><strong>${t("Formula:@@panchang")}</strong> <code>${pan.formula || t("(tithi + vara + nakshatra + lagna) % 9 = remainder {r}", { r: pan.remainder })}</code></div>
          <div class="panchaka-box__classification"><strong>${t("Classification:")}</strong> <span class="panchaka-box__classification-name--${mod}">${panName}</span> — <em>${panEffect}</em></div>
          ${panPariharam && !isPass ? `
            <div class="panchaka-box__remedy">
              <strong>${Icon("leaf")} ${t("Classical Remedy:")}</strong> ${panPariharam}
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
          <span>${Icon("hourglass")} ${t("Daily 5-Fold Time Division (Kala Vibhajana)")}</span>
          <span class="kv-header__sub">${t("5 Day divisions + Night Sacred Periods")}</span>
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
            <div class="kv-card__name kv-card__name--sacred">${Icon("moon")} ${t("Night Sacred Timings")}</div>
            <div class="kv-card__sacred-times">
              <strong>${t("Pradosha:")}</strong> ${kv.pradosha_kalam?.start} – ${kv.pradosha_kalam?.end}<br>
              <strong>${t("Nisitha:")}</strong> ${kv.nisitha_kalam?.start} – ${kv.nisitha_kalam?.end}<br>
              <strong>${t("Brahma:")}</strong> ${kv.brahma_muhurtham?.start} – ${kv.brahma_muhurtham?.end}
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
        <span class="activity-verdict-badge favorable">${t("Favorable")}</span>
      </div>
      <ul class="activity-reasons">${reasonsList || `<li>${t("Favorable conditions met.")}</li>`}</ul>
    </div>
  `;
    });
  } else {
    favDiv.innerHTML = `<div class="empty-msg">${t("No favorable activities found for this date.")}</div>`;
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
      const badgeText = t(isMixed ? "Mixed@@badge" : "Avoid@@badge");
      const reasonsList = (act.reasons_avoid || []).map(r => `<li>${r}</li>`).join("");
      avoidDiv.innerHTML += `
    <div class="activity-item ${badgeClass}">
      <div class="activity-name">
        <span>${name}</span>
        <span class="activity-verdict-badge ${badgeClass}">${badgeText}</span>
      </div>
      <ul class="activity-reasons">${reasonsList || `<li>${t("Unfavorable conditions met.")}</li>`}</ul>
    </div>
  `;
    });
  } else {
    avoidDiv.innerHTML = `<div class="empty-msg">${t("No activities to avoid.")}</div>`;
  }
}
