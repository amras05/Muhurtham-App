// ============================================================
// Muhurtham App · Muhurta Finder component: Other tools on the page: rajaswala record, shraddha calendar, special yogas, hidden tools.
// Split from finder.js (21 Nov 2026). Plain script: the page loads the finder-*.js files in order
// (see muhurta-finder.html); they share one global scope, and finder-init.js runs last.
// requires: js/config.js, js/i18n.js, js/regions.js, js/stars.js
// ============================================================

// ---- Garbha tab: rajaswala record (book p.106-108, 12 Nov 2026) ----
// The moment is health data: it is not saved, not added to the URL and not offered as a PDF.
var rajaOn = false;
function setRajaMode(on) {
  if (currentCategory === "garbha") rajaOn = on;
  document.body.classList.toggle("mode-raja", on);
  const f = el("mfRajaFields");
  if (f) f.hidden = !on;
  [["mfRajaTabRite", !on], ["mfRajaTabRec", on]].forEach(([id, active]) => {
    const b = el(id);
    if (b) { b.classList.toggle("active", active); b.setAttribute("aria-selected", active); }
  });
  if (on) {
    const nak = el("mfRajaNak"), rasi = el("mfRajaRasi");
    if (nak && !nak.options.length) nak.innerHTML = optionList(NAKSHATRAS_27, T("— Not given —", "— ఇవ్వలేదు —"), "");
    if (rasi && !rasi.options.length) rasi.innerHTML = optionList(RASIS_12, T("— Not given —", "— ఇవ్వలేదు —"), "");
    el("mfResults").style.display = "none";
  }
}

async function runRajaswala(loc) {
  const date = el("mfRajaDate").value, time = el("mfRajaTime").value;
  if (!date || !time) {
    setStatus(T("Enter the date and time of the first period.", "తొలి రజస్వల తేదీ, సమయం నమోదు చేయండి."), true);
    return;
  }
  const body = { date, time, lat: loc.lat, lon: loc.lon, tz_offset: loc.tz_offset, place_name: loc.place_name,
                 janma_nak_idx: parseInt(el("mfRajaNak").value) || null, husband_rasi_idx: parseInt(el("mfRajaRasi").value) || null };
  el("findBtn").disabled = true;
  setStatus(T("Reading the moment…", "సమయాన్ని పరిశీలిస్తున్నాం…"));
  try {
    const res = await fetch(`${API_BASE}/muhurta/rajaswala`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
    renderRajaswala(await res.json());
    lastToolSearch = null;
    lastData = null;
  } catch (e) {
    console.error("Rajaswala record failed:", e.message);
    setStatus(T(`Couldn't read the moment: ${e.message}`, `సమయాన్ని పరిశీలించలేకపోయాం: ${e.message}`), true);
  } finally {
    el("findBtn").disabled = false;
  }
}

function renderRajaswala(d) {
  const m = d.moment;
  setStatus(T("A traditional reading from the book (p.106-108); it is not medical advice.",
              "గ్రంథంలోని సంప్రదాయ పరిశీలన (పేజీ 106-108) మాత్రమే; వైద్య సలహా కాదు."));
  const good = d.verdict === "good";
  el("summaryBar").innerHTML = `<div class="raja-verdict raja-verdict--${good ? "good" : "bad"}" role="status">
    ${escapeHtml(good ? T("Auspicious: none of the book's bad times apply", "శుభం: గ్రంథంలోని దుష్ట కాలాలు ఏవీ లేవు")
                      : T(`${d.bad.length} of the book's bad signs apply`, `గ్రంథంలోని ${d.bad.length} దుష్ట లక్షణాలు ఉన్నాయి`))}
    <small>${escapeHtml(T(`${m.weekday_en} · ${m.tithi} · ${m.nakshatra} · ${m.yoga} yoga · ${m.karana} · ${m.lagna} lagna · ${m.hora} hora`,
                          `${m.weekday_te} · ${m.tithi} · ${m.nakshatra_te} · ${m.yoga} యోగం · ${m.karana} · ${m.lagna_te} లగ్నం · ${m.hora === "Chandra" ? "చంద్ర" : "సూర్య"} హోర`))}</small></div>`;
  const row = (r, cls, mark) => `<div class="yoga-row"><div class="yoga-row__when"><span class="pill pill--${cls}">${mark}</span></div>
    <div>${escapeHtml(T(r.en, r.te))}</div></div>`;
  el("dayGrid").innerHTML =
    d.bad.map(r => row(r, "fail", T("✕ Bad", "✕ దుష్టం"))).join("") +
    d.good.map(r => row(r, "pass", T("✓ Good", "✓ శుభం"))).join("") +
    d.not_evaluated.map(r => row(r, "muted", T("Not checked", "పరిశీలించలేదు"))).join("");
  el("mfResults").style.display = "block";
}

// ---- Pitru tab: shraddha calendar ----
let pitruCalendarOn = false;
function setPitruMode(on) {
  if (currentCategory === "pitru") pitruCalendarOn = on;
  el("mfControls")?.classList.toggle("mode-pitrucal", on);
  const f = el("mfPitruCalFields");
  if (f) f.hidden = !on;
  [["mfPitruTabRite", !on], ["mfPitruTabCal", on]].forEach(([id, active]) => {
    const b = el(id);
    if (b) { b.classList.toggle("active", active); b.setAttribute("aria-selected", active); }
  });
  updatePitruFields();
}

function updatePitruFields() {
  const mode = el("mfPitruMode")?.value;
  document.querySelectorAll("#mfPitruCalFields .pitru-death").forEach(x => { x.hidden = mode === "shannavati"; });
  document.querySelectorAll("#mfPitruCalFields .pitru-annual").forEach(x => { x.hidden = mode !== "annual"; });
  document.querySelectorAll("#mfPitruCalFields .pitru-year").forEach(x => { x.hidden = mode !== "shannavati"; });
  const yr = el("mfPitruYear");
  if (yr && !yr.value) yr.value = new Date().getFullYear();
}

async function runPitruCalendar(loc) {
  const mode = el("mfPitruMode").value;
  const body = { mode, lat: loc.lat, lon: loc.lon, tz_offset: loc.tz_offset, place_name: loc.place_name,
                 death_date: el("mfPitruDeathDate").value || null, death_time: el("mfPitruDeathTime").value || null,
                 years: parseInt(el("mfPitruYears").value) || 3, year: parseInt(el("mfPitruYear").value) || null };
  if (mode !== "shannavati" && !body.death_date) {
    setStatus(T("Enter the date of death.", "మరణ తేదీ నమోదు చేయండి."), true);
    return;
  }
  el("findBtn").disabled = true;
  setStatus(T("Working out the dates…", "తేదీలు లెక్కిస్తున్నాం…"));
  try {
    const res = await fetch(`${API_BASE}/muhurta/pitru-calendar`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
    renderPitruCalendar(mode, await res.json());
    lastToolSearch = { kind: "pitru", request: body };
  } catch (e) {
    console.error("Pitru calendar failed:", e);
    setStatus(T(`Couldn't work out the dates: ${e.message}`, `తేదీలు లెక్కించలేకపోయాం: ${e.message}`), true);
  } finally {
    el("findBtn").disabled = false;
  }
}

function renderPitruCalendar(mode, data) {
  const dd = data.death;
  const head = dd ? T(`Death tithi: ${dd.tithi_label}, ${dd.masa_en}${dd.adhika ? " (adhika)" : ""} masa.`,
                      `మరణ తిథి: ${dd.masa_te}${dd.adhika ? " (అధిక)" : ""} మాసం, ${dd.tithi_label}.`) : "";
  setStatus([head, ...(data.notes || [])].filter(Boolean).join(" "));
  let rows = [];
  if (mode === "annual") rows = data.shraddha.map(r => [r.date, T(`Year ${r.year_no} shraddha`, `${r.year_no}వ సంవత్సర శ్రాద్ధం`),
    `${VAARA_NAMES[currentLang]?.[r.weekday] || r.weekday}${r.aparahna_minutes ? T(` · tithi covers ${r.aparahna_minutes} min of aparahna`, ` · అపరాహ్ణంలో ${r.aparahna_minutes} ని.`) : ""}${r.note ? " · " + r.note : ""}`]);
  else if (mode === "after_death") rows = data.rites.map(r => [r.date, T(r.rite_en, r.rite_te), T(`Day ${r.day}`, `${r.day}వ రోజు`) + (r.note ? " · " + r.note : "")]);
  else rows = data.days.map(r => [r.date, T(r.kind_en, r.kind_te), `${VAARA_NAMES[currentLang]?.[r.weekday] || r.weekday} · ${r.detail || ""}`]);
  const counts = mode === "shannavati" ? `<div class="verdict-strip">${T(`${data.total} days`, `${data.total} దినాలు`)}: ${
    Object.entries(data.counts).map(([k, v]) => `${escapeHtml(k)} ${v}`).join(" · ")}</div>` : "";
  el("summaryBar").innerHTML = counts;
  el("dayGrid").innerHTML = rows.map(([d, what, more]) => `
    <div class="yoga-row"><div class="yoga-row__when">${escapeHtml(d)}</div>
      <div><strong>${escapeHtml(what)}</strong><br><small>${escapeHtml(more)}</small></div></div>`).join("");
  el("mfResults").style.display = "block";
}

// ---- Special Yogas tab ----
let yogaCatalog = null;
function setYogaMode(on) {
  el("mfControls")?.classList.toggle("mode-yogas", on);
  const panel = el("mfYogaPanel");
  if (panel) panel.hidden = !on;
  if (on) renderYogaPanel();
}

async function renderYogaPanel() {
  if (!yogaCatalog) {
    try {
      const res = await fetch(`${API_BASE}/muhurta/yogas/catalog`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      yogaCatalog = await res.json();
    } catch (e) {
      console.error("Yoga catalog failed:", e);
      setStatus(T(`Couldn't load the yoga list (${e.message}).`, "యోగాల జాబితా లోడ్ కాలేదు."), true);
      return;
    }
  }
  const keep = id => el(id)?.checked;
  const box = (list, prefix, defaults) => list.map(y => {
    const id = `${prefix}${y.id}`;
    const checked = el(id) ? keep(id) : defaults.includes(y.id);
    return `<label><input type="checkbox" id="${id}" value="${escapeHtml(y.id)}"${checked ? " checked" : ""}> ${escapeHtml(T(y.name_en, y.name_te))}</label>`;
  }).join("");
  el("mfYogaList").innerHTML = box(yogaCatalog.yogas, "mfYg_", ["amrita_siddhi", "sarvartha_siddhi"]);
  el("mfCondList").innerHTML = box(yogaCatalog.conditions, "mfYc_", ["bad_times_free", "varjyam_free"]);
  const nak = el("mfYogaNak"), rasi = el("mfYogaRasi");
  if (nak) nak.innerHTML = optionList(NAKSHATRAS_27, T("— Not given —", "— ఇవ్వలేదు —"), nak.value);
  if (rasi) rasi.innerHTML = optionList(RASIS_12, T("— Not given —", "— ఇవ్వలేదు —"), rasi.value);
}

async function runYogaSearch(loc) {
  const picked = sel => [...document.querySelectorAll(`${sel} input:checked`)].map(i => i.value);
  const body = {
    start_date: loc.startDate, days_to_scan: 60, lat: loc.lat, lon: loc.lon,
    tz_offset: loc.tz_offset, place_name: loc.place_name,
    yogas: picked("#mfYogaList"), conditions: picked("#mfCondList"),
    janma_nak_idx: parseInt(el("mfYogaNak")?.value) || null, janma_rasi_idx: parseInt(el("mfYogaRasi")?.value) || null,
  };
  if (!body.yogas.length && !body.conditions.length) {
    setStatus(T("Tick at least one yoga or condition.", "కనీసం ఒక యోగం లేదా నియమం ఎంచుకోండి."), true);
    return;
  }
  el("findBtn").disabled = true;
  setStatus(T("Searching…", "శోధిస్తున్నాం…"));
  try {
    const res = await fetch(`${API_BASE}/muhurta/yogas`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
    renderYogaResults(await res.json());
    lastToolSearch = { kind: "yogas", request: body };
  } catch (e) {
    console.error("Yoga search failed:", e);
    setStatus(T(`Search failed: ${e.message}`, `శోధన విఫలమైంది: ${e.message}`), true);
  } finally {
    el("findBtn").disabled = false;
  }
}

function renderYogaResults(data) {
  setStatus(T(`${data.total} window(s) in ${data.days_scanned} days.`, `${data.days_scanned} రోజుల్లో ${data.total} సమయాలు.`));
  el("summaryBar").innerHTML = "";
  el("dayGrid").innerHTML = data.windows.length ? data.windows.map(w => `
    <div class="yoga-row">
      <div class="yoga-row__when">${escapeHtml(w.date)} · ${escapeHtml(w.start)}–${escapeHtml(w.end)}<br><small>${escapeHtml(VAARA_NAMES[currentLang]?.[w.vaara] || w.vaara)} · ${w.duration_minutes} ${T("min", "ని.")}</small></div>
      <div>${escapeHtml(te(w.nakshatra, NAKSHATRA_NAMES_TE))} · ${escapeHtml(w.tithi)}${w.lagna ? ` · ${escapeHtml(te(w.lagna, RASI_NAMES_TE))} ${T("lagna", "లగ్నం")}` : ""}${w.tara ? ` · ${escapeHtml(w.tara)} ${T("tara", "తార")}` : ""}
        <div class="yoga-row__chips">${w.yogas.map(y => `<span class="pill pill--pass">${escapeHtml(T(y.name_en, y.name_te))}</span>`).join("")}</div></div>
    </div>`).join("") : `<div class="empty-state"><p>${T("No window matches every condition. Untick a condition or scan more days.", "అన్ని నియమాలు సరిపోయే సమయం లేదు. ఒక నియమం తీసివేయండి లేదా ఎక్కువ రోజులు వెతకండి.")}</p></div>`;
  el("mfResults").style.display = "block";
}

function onActivityChange() {
  updateContextualFields();
}


// (allRegions already declared in js/regions.js)
// ---- Hidden tools (plan R12): users don't get the Shraddha calendar when the super admin hides it ----
function applyToolVisibility(hiddenForMe, markedHidden) {
  const cal = el("mfPitruTabCal");
  if (!cal) return;
  if (hiddenForMe.includes("pitru_calendar")) {
    cal.hidden = true;
    if (pitruCalendarOn) setPitruMode(false);
  } else if (markedHidden.includes("pitru_calendar") && !cal.querySelector(".tab-hidden-mark")) {
    cal.insertAdjacentHTML("beforeend", `<span class="tab-hidden-mark">${T("Hidden", "దాచబడింది")}</span>`);
  }
}
