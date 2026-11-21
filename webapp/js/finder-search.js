// ============================================================
// Muhurtham App · Muhurta Finder component: Searching: a year 60 days at a time, by month, compact list and ceremony chips, main search.
// Split from finder.js (21 Nov 2026). Plain script: the page loads the finder-*.js files in order
// (see muhurta-finder.html); they share one global scope, and finder-init.js runs last.
// requires: js/config.js, js/i18n.js, js/regions.js, js/stars.js
// ============================================================

// ---- One year of muhurtas, 60 days at a time (11 Nov 2026) ----
// The first search covers 60 days; when the end of the list comes into view the next 60 days load,
// up to one year from the start date. Results are listed by date so new ones always follow on.
// Search length and load size from Settings › Finder and sharing (plan D6); 366 and 60 by default.
let YEAR_DAYS = 366, CHUNK_DAYS = 60;
if (window.SiteConfig) SiteConfig.onChange((c) => {
  const f = c && c.finder;
  if (f && f.search_days >= 60 && f.search_days <= 730) YEAR_DAYS = f.search_days;
  if (f && f.chunk_days >= 15 && f.chunk_days <= 120) CHUNK_DAYS = f.chunk_days;
});
let paging = null;        // { payload, scanned, done, loading, error, rejections }
let moreObserver = null;

// Days from the start date to the end date, both included; a full search year when no end date is given.
// An end date past that year is cut to it (Settings › Finder › search days).
function searchSpanDays(startIso, endIso) {
  if (!endIso) return YEAR_DAYS;
  const days = Math.round((Date.parse(endIso + "T00:00:00Z") - Date.parse(startIso + "T00:00:00Z")) / 864e5) + 1;
  return Math.max(1, Math.min(YEAR_DAYS, days));
}

function addDaysIso(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function chunkResults(data) { return (data.candidates && data.candidates.length) ? data.candidates : (data.windows || []); }
function byDateTime(a, b) {
  return (a.date + " " + (a.window_start || a.start_time || "")).localeCompare(b.date + " " + (b.window_start || b.start_time || ""));
}
function mergeRejections(data) {
  (data.rejection_summary || []).forEach(x => { paging.rejections[x.reason] = (paging.rejections[x.reason] || 0) + x.count; });
  lastData.rejection_summary = Object.entries(paging.rejections).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));
}

function startPaging(payload, data) {
  const limit = searchSpanDays(payload.start_date, payload.date_to);
  paging = { payload, limit, scanned: payload.days_to_scan, done: payload.days_to_scan >= limit, loading: false, error: null, rejections: {} };
  data.results = chunkResults(data).slice().sort(byDateTime);
  lastData = data;
  mergeRejections(data);
  lastData.days_scanned = paging.scanned;
  renderResults(lastData);
  updateMore();
  if (!lastData.results.length && !paging.done) loadMore();      // nothing yet: keep looking through the year
}

async function loadMore() {
  if (!paging || paging.loading || paging.done || lastToolSearch) return;
  paging.loading = true; paging.error = null;
  updateMore();
  const days = Math.min(CHUNK_DAYS, paging.limit - paging.scanned);
  const body = { ...paging.payload, start_date: addDaysIso(paging.payload.start_date, paging.scanned), days_to_scan: days };
  try {
    const res = await fetch(`${API_BASE}/muhurta/find`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json().catch(() => null); throw new Error((d && typeof d.detail === "string" && d.detail) || `HTTP ${res.status}`); }
    const data = await res.json();
    lastData.results = lastData.results.concat(chunkResults(data).slice().sort(byDateTime));
    (data.notices || []).forEach(n => {           // e.g. a Godavari Pushkaralu period further into the year
      lastData.notices = lastData.notices || [];
      if (!lastData.notices.some(m => m.en === n.en)) lastData.notices.push(n);
    });
    lastData.candidates = lastData.results;
    mergeRejections(data);
    paging.scanned += days;
    paging.done = paging.scanned >= paging.limit;
    lastData.days_scanned = paging.scanned;
    renderResults(lastData);
  } catch (e) {
    paging.error = e.message;
  } finally {
    paging.loading = false;
    updateMore();
  }
  if (!paging.error && !paging.done && !lastData.results.length) loadMore();
}

function updateMore() {
  const box = el("mfMore");
  if (!box) return;
  if (!paging || lastToolSearch) { box.hidden = true; return; }
  box.hidden = false;
  const upTo = addDaysIso(paging.payload.start_date, paging.scanned - 1);
  const next = addDaysIso(paging.payload.start_date, Math.min(paging.limit, paging.scanned + CHUNK_DAYS) - 1);
  if (paging.loading) {
    box.innerHTML = `<span class="load-more__spinner" aria-hidden="true"></span> ${escapeHtml(T(`Loading muhurtas up to ${next}…`, `${next} వరకు ముహూర్తాలు లోడ్ అవుతున్నాయి…`))}`;
  } else if (paging.error) {
    box.innerHTML = `${escapeHtml(T("Couldn't load more: ", "మరిన్ని లోడ్ కాలేదు: ") + paging.error)} <button type="button" class="btn btn--sm" onclick="loadMore()">${escapeHtml(T("Try again", "మళ్ళీ ప్రయత్నించు"))}</button>`;
  } else if (paging.done) {
    box.innerHTML = escapeHtml(paging.payload.date_to
      ? T(`That's every muhurta from ${paging.payload.start_date} to ${upTo}.`, `${paging.payload.start_date} నుండి ${upTo} వరకు అన్ని ముహూర్తాలు చూపించాము.`)
      : T(`That's one year of muhurtas, up to ${upTo}.`, `${upTo} వరకు ఒక సంవత్సరం ముహూర్తాలు చూపించాము.`));
  } else {
    box.innerHTML = `<span>${escapeHtml(T(`Showing muhurtas up to ${upTo}.`, `${upTo} వరకు ముహూర్తాలు.`))}</span> <button type="button" class="btn btn--sm" onclick="loadMore()">${escapeHtml(T(`Load more, up to ${next}`, `${next} వరకు మరిన్ని చూపించు`))}</button>`;
  }
  if (!moreObserver && "IntersectionObserver" in window) {
    moreObserver = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && paging && !paging.loading && !paging.done && !paging.error) loadMore();
    }, { rootMargin: "300px" });
    moreObserver.observe(box);
  }
}

// Summary box filter: "excellent" | "medium" | "avoid" | null (all). Clicking the active box again clears it.
let bandFilter = null;
el("summaryBar")?.addEventListener("click", e => {
  const b = e.target.closest("[data-band]");
  if (!b || !lastData) return;
  const key = b.getAttribute("data-band") || null;
  bandFilter = bandFilter === key ? null : key;
  renderResults(lastData);
});

// ---- Muhurtas by month (11 Nov 2026) ----
// No personal details: the user picks an event, a Telugu year (Ugadi to Ugadi) and lunar months; each
// month is searched in turn and its muhurtas are listed under a month heading as soon as it is done.
var poolMode = false;      // var: read by populateActivityDropdown, which can run first
const POOL_SKIP_INPUTS = ["samskara_main_event", "pitru_death", "garbhadhana_period"];
// "All main ceremonies": the events Sri Bhaskara's pool tags, that this app has (book rules each).
const POOL_MAIN = ["vivaha", "upanayana", "griha_pravesha", "bhumi_puja", "business_start", "seemantonnayana", "namakarana", "annaprashana"];
function poolEligible(r) { return !r.informational && !(r.tab_inputs || []).some(k => POOL_SKIP_INPUTS.includes(k)); }

function fillPoolEvents() {
  const sel = el("mfPoolEvent");
  if (!sel) return;
  const prev = sel.value || el("mfActivitySelect")?.value;
  sel.innerHTML = "";
  const all = document.createElement("option");
  all.value = "__all";
  all.textContent = T("All main ceremonies", "అన్ని ముఖ్య కార్యాలు");
  sel.appendChild(all);
  CATEGORY_TABS.forEach(t => {
    const rules = allMuhurtaRules.filter(r => (r.tab || r.category) === t.id && poolEligible(r));
    if (!rules.length) return;
    const g = document.createElement("optgroup");
    g.label = T(t.en, t.te);
    rules.forEach(r => {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = currentLang === "te" && r.title_te ? `${r.title_te} (${r.title_en})` : r.title_en;
      g.appendChild(o);
    });
    sel.appendChild(g);
  });
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}

function fillPoolYears() {
  const sel = el("mfPoolYear");
  if (!sel || sel.options.length) return;
  const now = new Date();
  const current = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();   // the Telugu year starts at Ugadi
  for (let y = current - 1; y <= current + 2; y++) {
    const o = document.createElement("option");
    o.value = y;
    o.textContent = String(y);      // one year, as people say it (21 Nov 2026); its months run Ugadi to Ugadi
    sel.appendChild(o);
  }
  sel.value = current;
}

function setFinderMode(pool) {
  poolMode = pool;
  el("mfControls")?.classList.toggle("mode-pool", pool);
  [["mfModePerson", !pool], ["mfModePool", pool]].forEach(([id, on]) => {
    el(id)?.classList.toggle("active", on);
    el(id)?.setAttribute("aria-selected", String(on));
  });
  el("mfCategoryTabs").hidden = pool;
  el("mfPoolIntro").hidden = !pool;
  document.querySelectorAll(".field--pool").forEach(f => { f.hidden = !pool; });
  const fb = el("findBtn");
  fb.setAttribute("data-en", pool ? "Show muhurtas" : "Find muhurtas");
  fb.setAttribute("data-te", pool ? "ముహూర్తాలు చూపించు" : "ముహూర్తాలు వెతుకు");
  fb.textContent = fb.getAttribute(currentLang === "te" ? "data-te" : "data-en");
  if (pool) {
    setYogaMode(false);
    if (el("mfPitruPanel")) el("mfPitruPanel").hidden = true;
    fillPoolEvents();
    fillPoolYears();
  } else {
    onCategoryChange(currentCategory);
  }
}
el("mfModePerson")?.addEventListener("click", () => setFinderMode(false));
el("mfModePool")?.addEventListener("click", () => setFinderMode(true));

async function runPool(loc) {
  const activityId = el("mfPoolEvent")?.value;
  if (!activityId) { setStatus(T("Choose an event.", "కార్యం ఎంచుకోండి."), true); return; }
  const year = Number(el("mfPoolYear").value);
  const wanted = [...document.querySelectorAll("#mfLunarMonths input:checked")].map(i => Number(i.value));
  paging = null; bandFilter = null; lastToolSearch = null;
  el("findBtn").disabled = true;
  el("mfResults").style.display = "none";
  const more = el("mfMore");
  setStatus(T("Working out the lunar months of the year…", "సంవత్సరంలోని చాంద్రమాన మాసాలు లెక్కిస్తున్నాం…"));
  try {
    const mres = await fetch(`${API_BASE}/muhurta/lunar-months?year=${year}&lat=${loc.lat}&lon=${loc.lon}&tz_offset=${loc.tz_offset}`);
    const mdata = await mres.json().catch(() => null);
    if (!mres.ok) throw new Error((mdata && typeof mdata.detail === "string" && mdata.detail) || `HTTP ${mres.status}`);
    // The start and end dates (21 Nov 2026) trim the year's months: a month outside them is skipped, one
    // across them is searched only inside them.
    const from = el("startDate").value || null, to = el("mfEndDate")?.value || null;
    const months = mdata.months.filter(m => !wanted.length || wanted.includes(m.month_number)).map(m => {
      const mEnd = addDaysIso(m.start, m.days - 1);
      const s0 = from && from > m.start ? from : m.start, e0 = to && to < mEnd ? to : mEnd;
      return s0 > e0 ? null : Object.assign({}, m, { start: s0, days: searchSpanDays(s0, e0) });
    }).filter(Boolean);
    if (!months.length) throw new Error(T("None of the chosen months falls between the start and end dates in that year.",
                                          "ఎంచుకున్న మాసాలు ఆ సంవత్సరంలో ప్రారంభ, ముగింపు తేదీల మధ్య లేవు."));
    const base = { activity_id: activityId, lat: loc.lat, lon: loc.lon, tz_offset: loc.tz_offset, place_name: loc.place_name,
                   panchaka_method: "standard", time_preference: "any",
                   participants: [] };
    lastRequest = { ...base, start_date: months[0].start, days_to_scan: Math.min(366, months.reduce((a, m) => a + m.days, 0)),
                    lunar_months: wanted };
    const allEvents = activityId === "__all";
    const events = allEvents ? POOL_MAIN.filter(id => allMuhurtaRules.some(r => r.id === id)) : [activityId];
    lastData = { results: [], candidates: [], rejection_summary: [], days_scanned: 0, strictness: base.strictness,
                 monthRanges: months, poolDone: false, allEvents,
                 title_en: allEvents ? "Main ceremonies" : undefined, title_te: allEvents ? "ముఖ్య కార్యాలు" : undefined };
    eventFilter = null;
    const rej = {};
    setStatus("");
    for (const [i, m] of months.entries()) {
      for (const [k, ev] of events.entries()) {
        const rule = allMuhurtaRules.find(r => r.id === ev);
        if (more) {
          more.hidden = false;
          const what = allEvents ? `: ${T(rule?.title_en || ev, rule?.title_te || ev)} (${k + 1}/${events.length})` : "";
          more.innerHTML = `<span class="load-more__spinner" aria-hidden="true"></span> ${escapeHtml(T(
            `Searching ${m.name_en}${what}, month ${i + 1} of ${months.length}…`, `${m.name_te}${what} వెతుకుతున్నాం, ${months.length} లో ${i + 1}వ మాసం…`))}`;
        }
        const res = await fetch(`${API_BASE}/muhurta/find`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...base, activity_id: ev, start_date: m.start, days_to_scan: m.days, lunar_months: [m.month_number] }) });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error((data && typeof data.detail === "string" && data.detail) || `HTTP ${res.status}`);
        if (!allEvents) Object.assign(lastData, { title_en: data.title_en, title_te: data.title_te, activity_id: data.activity_id });
        const tag = { id: ev, en: data.title_en, te: data.title_te };
        const chunk = chunkResults(data).map(r => Object.assign(r, { _event: tag }));
        lastData.results = lastData.results.concat(chunk).sort(byDateTime);
        lastData.candidates = lastData.results;
        (data.rejection_summary || []).forEach(x => { rej[x.reason] = (rej[x.reason] || 0) + x.count; });
        lastData.rejection_summary = Object.entries(rej).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([reason, count]) => ({ reason, count }));
        lastData.poolDone = i === months.length - 1 && k === events.length - 1;
        renderResults(lastData);
      }
      lastData.days_scanned += m.days;
    }
    if (more) {
      more.hidden = false;
      more.textContent = T(`All muhurtas for ${months.map(m => m.name_en).join(", ")} (${year}).`,
                           `${months.map(m => m.name_te).join(", ")} (${year}) ముహూర్తాలన్నీ చూపించాము.`);
    }
  } catch (e) {
    setStatus(T("Couldn't load the muhurtas: ", "ముహూర్తాలు లోడ్ కాలేదు: ") + e.message, true);
    if (more) more.hidden = true;
  } finally {
    el("findBtn").disabled = false;
  }
}

// ---- Compact list and ceremony chips (11 Nov 2026) ----
var resultView = (() => { try { return localStorage.getItem("mh_result_view") || "cards"; } catch (e) { return "cards"; } })();
var eventFilter = null;      // a ceremony id in the "All main ceremonies" list, or null for all

function bandClass(p) { return p >= 75 ? "excellent" : p >= 50 ? "medium" : "avoid"; }
// The dosha parts of the muhurta % shown on their own (A8, 21 Nov 2026: % = panchanga 30 + mahadoshas 70,
// or 30 / 60 / 10 with dashavidha for marriage).
function doshaScoreChips(r) {
  const chip = (sc, en, te, tip_en, tip_te) => sc
    ? `<span class="score-chip score-chip--${bandClass(sc.percentage)}" title="${escapeHtml(T(tip_en, tip_te))}">${escapeHtml(T(en, te))} ${sc.percentage}%</span>` : "";
  return chip(r.maha_score, "Mahadosha", "మహాదోష", `${r.maha_score?.passed} of ${r.maha_score?.checked} mahadoshas clear`, `${r.maha_score?.checked} లో ${r.maha_score?.passed} మహాదోషాలు శుద్ధం`) +
         chip(r.dasha_score, "Dashavidha", "దశవిధ", `${r.dasha_score?.passed} of ${r.dasha_score?.checked} dashavidha doshas clear`, `${r.dasha_score?.checked} లో ${r.dasha_score?.passed} దశవిధ దోషాలు శుద్ధం`);
}
function dmy(iso) { const [y, m, d] = String(iso).split("-"); return `${d}-${m}-${y}`; }

// One line per muhurta (or, for all ceremonies, one line per lagna with a tag per ceremony).
function renderCompactList(data, results, passes, grid) {
  const shown = results.map((r, idx) => ({ r, idx })).filter(x => passes(x.r));
  const rows = [];
  if (data.allEvents) {
    const byLagna = new Map();
    shown.forEach(x => {
      const key = `${x.r.date}|${x.r.detailed_eval?.lagna?.name || x.r.window_start}`;
      if (!byLagna.has(key)) { byLagna.set(key, []); rows.push(byLagna.get(key)); }
      byLagna.get(key).push(x);
    });
  } else {
    shown.forEach(x => rows.push([x]));
  }
  let lastMonthHead = null, html = "";
  rows.forEach(group => {
    const best = group.reduce((a, b) => ((b.r.percentage || 0) > (a.r.percentage || 0) ? b : a));
    const r = best.r, p = r.panchang || {};
    if (data.monthRanges) {
      const m = data.monthRanges.find(x => r.date >= x.start && r.date <= x.end);
      if (m && m.start !== lastMonthHead) {
        lastMonthHead = m.start;
        html += `<h3 class="pool-month">${escapeHtml(T(m.name_en, m.name_te))} <small>${escapeHtml(dmy(m.start))} – ${escapeHtml(dmy(m.end))}</small></h3>`;
      }
    }
    const vaara = VAARA_NAMES[currentLang]?.[p.vaara] || p.vaara || "";
    const tRaw = typeof p.tithi === "string" ? p.tithi.split(" ")[0] : "";
    const tithi = te(tRaw, TITHI_NAMES_TE) || tRaw;
    const nak = te(p.nakshatra, NAKSHATRA_NAMES_TE) || p.nakshatra || "";
    const lg = r.detailed_eval?.lagna || {};
    const lagna = currentLang === "te" ? (lg.name_te || lg.name) : `${lg.name || ""} lagna`;
    const am = r.amsha && r.amsha.type !== "none"
      ? ` <span class="amsha-badge amsha-badge--${escapeHtml(r.amsha.type)}">${escapeHtml(T(r.amsha.name_en, r.amsha.name_te))}</span>` : "";
    const starts = group.map(x => x.r.window_start).sort();
    const ends = group.map(x => x.r.window_end).sort();
    const time = `${String(starts[0]).slice(0, 5)}–${String(ends[ends.length - 1]).slice(0, 5)}`;
    // one tag per ceremony: its best window inside this lagna (durmuhurta can split a lagna into pieces)
    const perEvent = [];
    group.forEach(x => {
      const i = perEvent.findIndex(y => y.r._event?.id === x.r._event?.id);
      if (i < 0) perEvent.push(x);
      else if ((x.r.percentage || 0) > (perEvent[i].r.percentage || 0)) perEvent[i] = x;
    });
    const chips = data.allEvents ? `<div class="lagna-row__events">${perEvent.map(x =>
      `<button type="button" class="event-chip event-chip--${bandClass(x.r.percentage || 0)}" onclick="openDayModal(${x.idx})" title="${escapeHtml(T("Full analysis", "సమగ్ర విశ్లేషణ"))}">${escapeHtml(T(x.r._event.en, x.r._event.te))} ${x.r.percentage}%</button>`).join("")}</div>` : "";
    const open = data.allEvents ? "" : ` role="button" tabindex="0" onclick="openDayModal(${best.idx})" onkeydown="if(event.key==='Enter')openDayModal(${best.idx})"`;
    html += `<div class="lagna-row${data.allEvents ? "" : " lagna-row--link"}"${open}>
      <div class="lagna-row__line1"><strong>${escapeHtml(dmy(r.date))}</strong><span>${escapeHtml(vaara)}</span><span>${escapeHtml(tithi)}</span><span>${escapeHtml(nak)}</span></div>
      <div class="lagna-row__line2"><span class="lagna-row__lagna">${escapeHtml(lagna)}</span>${am}<span class="lagna-row__time">${escapeHtml(time)}</span>
        <span class="lagna-row__pct lagna-row__pct--${bandClass(r.percentage || 0)}" title="${escapeHtml(T("Basic muhurta rules", "ముహూర్త ప్రాథమిక నియమాలు"))}">${escapeHtml(T("Muhurta", "ముహూర్త"))} ${r.percentage}%</span>${doshaScoreChips(r)}</div>
      ${chips}
    </div>`;
  });
  grid.insertAdjacentHTML("beforeend", html || `<div class="empty-state"><p>${escapeHtml(T("No muhurtas match these filters.", "ఈ ఎంపికలకు ముహూర్తాలు లేవు."))}</p></div>`);
}

function renderEventFilter(data, results) {
  const box = el("mfEventFilter");
  if (!box) return;
  if (!data.allEvents) { box.hidden = true; box.innerHTML = ""; return; }
  const counts = {}, names = {};
  results.forEach(r => { if (r._event) { counts[r._event.id] = (counts[r._event.id] || 0) + 1; names[r._event.id] = r._event; } });
  const chip = (id, label, n) => `<button type="button" class="filter-chip${(eventFilter || "") === id ? " is-active" : ""}" data-event="${escapeHtml(id)}" aria-pressed="${(eventFilter || "") === id}">${escapeHtml(label)}${n != null ? ` <small>${n}</small>` : ""}</button>`;
  box.hidden = false;
  box.innerHTML = chip("", T("All", "అన్నీ"), null) + POOL_MAIN.filter(id => names[id]).map(id => chip(id, T(names[id].en, names[id].te), counts[id])).join("");
}
el("mfEventFilter")?.addEventListener("click", e => {
  const b = e.target.closest("[data-event]");
  if (!b || !lastData) return;
  const id = b.getAttribute("data-event") || null;
  eventFilter = eventFilter === id ? null : id;
  renderResults(lastData);
});

function setResultView(view, initial) {
  resultView = view;
  try { localStorage.setItem("mh_result_view", view); } catch (e) { /* private mode */ }
  document.querySelectorAll(".results-view .view-btn").forEach(b => {
    const on = b.getAttribute("data-view") === view;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
  if (!initial && lastData && !lastToolSearch) renderResults(lastData);
}
document.querySelectorAll(".results-view .view-btn").forEach(b => b.addEventListener("click", () => setResultView(b.getAttribute("data-view"))));
setResultView(resultView, true);     // buttons only: no results exist yet at page load

// ---- Main Search ----
let lastData = null;
let lastRequest = null;   // the payload of the last search, for "Save" (plan R3)
let lastToolSearch = null; // { kind: "yogas" | "pitru", request } when those results are on screen (plan F2)

// The /muhurta/find request from the form: event, place, people and the event's own details. Shared by the
// search and by "Check a given muhurta" (21 Nov 2026), so both judge with exactly the same inputs.
function buildFindPayload({ startDate, days, lat, lon, tz_offset, place_name }) {
  const actSelect = el("mfActivitySelect");
  const activityId = actSelect ? actSelect.value : null;

  const payload = {
    activity_id: activityId,
    start_date: startDate,
    days_to_scan: days,
    lat: lat,
    lon: lon,
    tz_offset: tz_offset,
    place_name: place_name,
    panchaka_method: "standard",
    rule_variant: el("mfVariantSelect")?.value || null,
    time_preference: el("mfTimePref")?.value || "any",
    participants: collectParticipants(),
    lunar_months: [...document.querySelectorAll("#mfLunarMonths input:checked")].map(i => Number(i.value)),
    date_to: el("mfEndDate")?.value || null,     // optional end date (21 Nov 2026); the server stops there
  };

  // Event details (form groups the rule lists in tab_inputs). People come from the cards above.
  const tabInputs = currentRule()?.tab_inputs || [];
  const val = id => el(id)?.value?.trim() || null;
  if (tabInputs.includes("samskara_pregnancy")) payload.conception_date = val("mfConceptionDate");
  if (tabInputs.includes("garbhadhana_period")) payload.period_start_date = val("mfPeriodStart");
  if (tabInputs.includes("samskara_main_event")) payload.main_event_date = val("mfMainEventDate");
  if (tabInputs.includes("pitru_death")) payload.main_event_date = val("mfDeathDate");
  if (tabInputs.includes("upanayana_family")) {
    payload.veda_shakha = val("mfVedaShakha");
    payload.sutra = val("mfSutra");
    payload.varna = val("mfVarna");
  }
  if (tabInputs.includes("griha_owner")) {
    payload.door_facing = val("mfDoorFacing");
    payload.plot_facing = val("mfPlotFacing");
    payload.house_type = val("mfHouseType");
  }
  if (tabInputs.includes("travel")) {
    payload.origin = val("mfTravelOrigin");
    payload.destination = val("mfTravelDest");
    payload.travel_direction = val("mfTravelDir");
    payload.travel_mode = val("mfTravelMode");
    payload.travel_purpose = val("mfTravelPurpose");
    payload.travel_exemption = val("mfTravelExemption");
  }
  if (tabInputs.includes("business")) {
    payload.business_name = val("mfBusinessName");
    payload.business_type = val("mfBusinessType");
    payload.entrance_facing = val("mfEntranceFacing");
  }
  if (tabInputs.includes("vehicle")) {
    payload.vehicle_type = val("mfVehicleType");
    payload.vehicle_muhurta_type = val("mfVehicleMuhurtaType");
  }
  return payload;
}

async function findMuhurtas() {
  const startDate = el("startDate").value;
  // The first part of the year (or of the chosen dates); the rest loads as the list scrolls.
  const days = Math.min(CHUNK_DAYS, searchSpanDays(startDate, el("mfEndDate")?.value || null));
  paging = null;
  bandFilter = null;
  eventFilter = null;
  updateMore();
  if (!chosenPlace || (!startDate && !poolMode)) {
    setStatus(currentLang === "te" ? "దయచేసి తేదీ మరియు ప్రాంతం ఎంచుకోండి." : "Pick a start date and a place first.", true);
    return;
  }
  const endDate = el("mfEndDate")?.value || "";
  if (endDate && startDate && endDate < startDate) {
    setStatus(T("The end date is before the start date.", "ముగింపు తేదీ ప్రారంభ తేదీ కంటే ముందుంది."), true);
    return;
  }
  const lat = chosenPlace.lat, lon = chosenPlace.lon, tz_offset = chosenPlace.tz_offset, place_name = chosenPlace.label;
  if (poolMode) return runPool({ lat, lon, tz_offset, place_name });

  lastToolSearch = null;    // set again once a yoga or shraddha search succeeds
  if (currentCategory !== "yogas" && !(currentCategory === "pitru" && pitruCalendarOn) && !(currentCategory === "garbha" && rajaOn)) {
    const missing = missingRequired();
    if (missing.length) {
      const go = await AppShell.confirm(
        T(`These details are not given:\n${missing.map(m => "• " + m.text).join("\n")}\n\nThe checks that need them will be left out of the results.`,
          `ఈ వివరాలు ఇవ్వలేదు:\n${missing.map(m => "• " + m.text).join("\n")}\n\nవాటి అవసరమైన పరిశీలనలు ఫలితాల్లో ఉండవు.`),
        { ok: T("Search anyway", "అలాగే శోధించు"), cancel: T("Fill them in", "వివరాలు ఇస్తాను") });
      if (!go) {
        const card = document.querySelector(`#mfParticipants .person-card[data-role="${missing[0].role}"]`);
        if (card) { card.open = true; card.scrollIntoView({ behavior: "smooth", block: "center" }); card.querySelector("select, input")?.focus({ preventScroll: true }); }
        return;
      }
    }
  }
  if (currentCategory === "yogas") {
    return runYogaSearch({ lat, lon, tz_offset, place_name, startDate, days });
  }
  if (currentCategory === "pitru" && pitruCalendarOn) {
    return runPitruCalendar({ lat, lon, tz_offset, place_name });
  }
  if (currentCategory === "garbha" && rajaOn) {
    return runRajaswala({ lat, lon, tz_offset, place_name });
  }

  el("findBtn").disabled = true;
  el("mfResults").style.display = "none";
  el("progressSection").style.display = "block";
  el("progressFill").style.width = "10%";
  el("progressText").textContent = currentLang === "te" ? `${days} రోజుల ముహూర్త శోధన జరుగుతోంది...` : `Scanning ${days} days for auspicious Muhurtas...`;
  setStatus("");

  try {
    const payload = buildFindPayload({ startDate, days, lat, lon, tz_offset, place_name });

    lastRequest = payload;
    const res = await fetch(`${API_BASE}/muhurta/find`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    clearInterval(progressInterval);

    if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);

    el("progressFill").style.width = "100%";
    el("progressText").textContent = currentLang === "te" ? "పూర్తయింది! ✓" : "Complete! ✓";

    const data = await res.json();
    if (data.candidates && data.candidates.length > 0) {
      data.results = data.candidates;
    } else if (data.windows && data.windows.length > 0) {
      data.results = data.windows;
    }
    setTimeout(() => {
      el("progressSection").style.display = "none";
      startPaging(payload, data);
      setStatus("");      // notes about details not given are asked before the search instead (11 Nov 2026)
    }, 400);

  } catch (e) {
    el("progressSection").style.display = "none";
    setStatus(`Error: ${e.message}`, true);
  } finally {
    el("findBtn").disabled = false;
  }
}
