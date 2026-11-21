// ============================================================
// Muhurtham App · Muhurta Finder component: Person cards (birth details known? / janma star / nama star), required details, family on the cards.
// Split from finder.js (21 Nov 2026). Plain script: the page loads the finder-*.js files in order
// (see muhurta-finder.html); they share one global scope, and finder-init.js runs last.
// requires: js/config.js, js/i18n.js, js/regions.js, js/stars.js
// ============================================================

// ---- People taking part (Input Data Master) ----
// One card per participant the event asks for. Janma and nama nakshatra are separate
// fields; a star can be picked, found from the name (user must confirm), or worked out
// from birth details on the server. Values survive switching events (kept per role).
const participantState = {};   // role -> { field: value }
const namaLookupTimers = {};

const T = (en, te) => (currentLang === "te" ? te : en);

function optionList(items, placeholder, selected) {
  return `<option value="">${placeholder}</option>` + items.map(i =>
    `<option value="${i.id}"${String(i.id) === String(selected ?? "") ? " selected" : ""}>${currentLang === "te" ? `${i.te} (${i.en})` : `${i.en} · ${i.te}`}</option>`
  ).join("");
}
const PADAS = [1, 2, 3, 4].map(n => ({ id: n, en: `Pada ${n}`, te: `${n}వ పాదం` }));

function saveParticipantState() {
  document.querySelectorAll("#mfParticipants .person-card").forEach(card => {
    const role = card.dataset.role;
    const st = participantState[role] = participantState[role] || {};
    card.querySelectorAll("[data-k]").forEach(inp => {
      st[inp.dataset.k] = inp.type === "checkbox" ? inp.checked : inp.value;
    });
    st.mode = card.dataset.mode;
  });
}

function birthPlaceOptions(selected) {
  const regions = (typeof allRegions !== "undefined" ? allRegions : []).filter(r => r.id !== "custom");
  return `<option value="">${T("Same as the event location", "కార్యక్రమ ప్రాంతమే")}</option>` +
    regions.map(r => `<option value="${escapeHtml(r.id)}"${r.id === selected ? " selected" : ""}>${escapeHtml(r.label)}</option>`).join("");
}

function personCardHTML(spec, idx) {
  const role = spec.role;
  const st = participantState[role] || {};
  // 21 Nov 2026: first "are the birth details known?". Yes = date, time and place (worked out on the server);
  // no = janma nakshatra, pada and (optional) rashi. The old "find it from the name" mode now lives only in
  // the nama nakshatra block (Griha Pravesha).
  const mode = st.mode === "star" || st.mode === "name" ? "star" : "birth";
  const isNama = spec.star_basis === "nama";
  const label = T(spec.label_en, spec.label_te);
  const id = k => `mfP_${role}_${k}`;
  const needsDob = (spec.fields || []).includes("birth_date");
  // L1 required · L1o recommended (shown open, may be left empty; e.g. the father at upanayana) · L2 optional, folded
  const levelNote = spec.level === "L1"
    ? T("Required", "తప్పనిసరి")
    : spec.level === "L1o"
      ? T("Recommended (optional): adds this person's tarabala", "సిఫార్సు (ఐచ్ఛికం): వీరి తారాబలం కూడా పరిశీలిస్తుంది")
      : T("Optional: adds this person's tarabala", "ఐచ్ఛికం: వీరి తారాబలం కూడా పరిశీలిస్తుంది");
  const basisNote = spec.star_basis === "nama"
    ? T("Rules use the nama nakshatra", "నియమాలు నామ నక్షత్రాన్ని వాడుతాయి")
    : T("Rules use the janma nakshatra", "నియమాలు జన్మ నక్షత్రాన్ని వాడుతాయి");
  const extra = [];
  if ((spec.fields || []).includes("gender")) {
    extra.push(`<div class="field"><label for="${id("gender")}">${T("Boy / girl", "బాలుడు / బాలిక")}</label>
      <select id="${id("gender")}" data-k="gender">
        <option value="">${T("— Not specified —", "— పేర్కొనలేదు —")}</option>
        <option value="boy"${st.gender === "boy" ? " selected" : ""}>${T("Boy", "బాలుడు")}</option>
        <option value="girl"${st.gender === "girl" ? " selected" : ""}>${T("Girl", "బాలిక")}</option>
      </select></div>`);
  }
  if ((spec.fields || []).includes("eldest")) {
    extra.push(`<div class="field field--check"><label><input type="checkbox" id="${id("eldest")}" data-k="eldest"${st.eldest ? " checked" : ""}>
      ${T("Eldest child (Trijyeshtha check)", "జ్యేష్ఠ సంతానం (త్రిజ్యేష్ఠ పరిశీలన)")}</label></div>`);
  }
  const tab = (m, en, te) => `<button type="button" role="tab" class="nama-tab${mode === m ? " active" : ""}" aria-selected="${mode === m}" onclick="switchPersonMode('${role}','${m}')">${T(en, te)}</button>`;
  return `
  <details class="person-card" data-role="${role}" data-mode="${mode}" data-needs-dob="${needsDob}" ${spec.level === "L1" || spec.level === "L1o" || idx === 0 || st.open ? "open" : ""}>
    <summary class="person-card__head">
      <strong>${escapeHtml(label)}</strong>
      <span class="person-card__note">${levelNote} · ${basisNote}</span>
    </summary>
    <div class="person-card__body">
      ${familyPickerHTML(role, st)}
      <div class="context-grid">
        <div class="field"><label for="${id("name")}">${T("Name", "పేరు")}</label>
          <input type="text" id="${id("name")}" data-k="name" value="${escapeHtml(st.name || "")}" autocomplete="off"></div>
        <div class="field"><label for="${id("gotra")}">${T("Gotra (printed only)", "గోత్రం (ముద్రణకు మాత్రమే)")}</label>
          <input type="text" id="${id("gotra")}" data-k="gotra" value="${escapeHtml(st.gotra || "")}" autocomplete="off"></div>
        ${extra.join("")}
      </div>
      ${isNama ? `
      <div class="nama-block">
        <div class="context-grid">
          <div class="field"><label for="${id("nama")}">${T("Nama nakshatra (used for Griha Pravesha)", "నామ నక్షత్రం (గృహప్రవేశానికి)")}</label>
            <select id="${id("nama")}" data-k="nama_nak_idx">${optionList(NAKSHATRAS_27, T("— Not known —", "— తెలియదు —"), st.nama_nak_idx)}</select></div>
          <div class="field"><label for="${id("npada")}">${T("Nama pada", "నామ పాదం")}</label>
            <select id="${id("npada")}" data-k="nama_pada">${optionList(PADAS, "—", st.nama_pada)}</select></div>
          <div class="field"><label for="${id("lookup")}">${T("Or find it from the name", "లేదా పేరు ద్వారా తెలుసుకోండి")}</label>
            <input type="text" id="${id("lookup")}" data-k="lookup" value="${escapeHtml(st.lookup || "")}" autocomplete="off"
              oninput="onPersonNameLookup('${role}', this.value)"></div>
        </div>
        <div class="nama-detected-badge" id="${id("badge")}" aria-live="polite" hidden></div>
      </div>` : ""}
      <p class="participants__hint">${T("Are this person's birth details (date, time, place) known?", "వీరి జన్మ వివరాలు (తేదీ, సమయం, స్థలం) తెలుసా?")}</p>
      <div class="nama-mode-tabs" role="tablist" aria-label="${T("Birth details known?", "జన్మ వివరాలు తెలుసా?")}">
        ${tab("birth", "Yes, birth details known", "అవును, జన్మ వివరాలు తెలుసు")}
        ${tab("star", "No, I know the janma nakshatra", "లేదు, జన్మ నక్షత్రం తెలుసు")}
      </div>
      <div class="person-mode" data-for="star" ${mode === "star" ? "" : "hidden"}>
        <div class="context-grid">
          <div class="field"><label for="${id("janma")}">${T("Janma nakshatra", "జన్మ నక్షత్రం")}</label>
            <select id="${id("janma")}" data-k="janma_nak_idx">${optionList(NAKSHATRAS_27, T("— Not known —", "— తెలియదు —"), st.janma_nak_idx)}</select></div>
          <div class="field"><label for="${id("jpada")}">${T("Janma pada", "జన్మ పాదం")}</label>
            <select id="${id("jpada")}" data-k="janma_pada">${optionList(PADAS, "—", st.janma_pada)}</select></div>
          <div class="field"><label for="${id("rasi")}">${T("Janma rashi (optional)", "జన్మ రాశి (ఐచ్ఛికం)")}</label>
            <select id="${id("rasi")}" data-k="rasi_idx">${optionList(RASIS_12, T("— Not known —", "— తెలియదు —"), st.rasi_idx)}</select></div>
        </div>
      </div>
      <div class="person-mode" data-for="birth" ${mode === "birth" || needsDob ? "" : "hidden"}>
        <div class="context-grid">
          <div class="field"><label for="${id("dob")}">${T("Birth date", "పుట్టిన తేదీ")}${needsDob ? T(" (needed for the age rule)", " (వయస్సు నియమానికి అవసరం)") : ""}</label>
            <input type="date" id="${id("dob")}" data-k="birth_date" value="${escapeHtml(st.birth_date || "")}"></div>
          <div class="field birth-only" ${mode === "birth" ? "" : "hidden"}><label for="${id("tob")}">${T("Birth time", "పుట్టిన సమయం")}</label>
            <input type="time" id="${id("tob")}" data-k="birth_time" value="${escapeHtml(st.birth_time || "")}"></div>
          <div class="field field--check birth-only" ${mode === "birth" ? "" : "hidden"}><label><input type="checkbox" id="${id("tunk")}" data-k="birth_time_unknown"${st.birth_time_unknown ? " checked" : ""}>
            ${T("Birth time not known", "జన్మ సమయం తెలియదు")}</label></div>
          <div class="field birth-only" ${mode === "birth" ? "" : "hidden"}><label for="${id("bplace")}">${T("Birth place", "జన్మస్థలం")}</label>
            <select id="${id("bplace")}" data-k="birth_region">${birthPlaceOptions(st.birth_region)}</select></div>
        </div>
      </div>
    </div>
  </details>`;
}

function renderParticipants(rule) {
  const box = el("mfParticipants");
  if (!box) return;
  saveParticipantState();
  const specs = rule?.participants || [];
  if (!specs.length) { box.innerHTML = ""; box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<h4 class="participants__title">${T("People taking part", "పాల్గొనే వ్యక్తులు")}</h4>
    <p class="participants__hint">${T(
      "For each person, give the birth date, time and place if known; if not, give the janma nakshatra and pada. Leave an optional card empty to skip that person.",
      "ప్రతి వ్యక్తికి జన్మ తేదీ, సమయం, స్థలం తెలిస్తే ఇవ్వండి; తెలియకపోతే జన్మ నక్షత్రం, పాదం ఇవ్వండి. ఐచ్ఛిక కార్డును ఖాళీగా వదిలితే ఆ వ్యక్తి పరిశీలన జరగదు.")}</p>` +
    specs.map(personCardHTML).join("");
}

function switchPersonMode(role, mode) {
  const card = document.querySelector(`#mfParticipants .person-card[data-role="${role}"]`);
  if (!card) return;
  card.dataset.mode = mode;
  const needsDob = card.dataset.needsDob === "true";
  card.querySelectorAll(".nama-tab").forEach((b, i) => {
    const on = ["birth", "star"][i] === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on);
  });
  card.querySelectorAll(".person-mode").forEach(div => {
    div.hidden = !(div.dataset.for === mode || (div.dataset.for === "birth" && needsDob));
  });
  card.querySelectorAll(".birth-only").forEach(f => { f.hidden = mode !== "birth"; });
}

function onPersonNameLookup(role, val) {
  clearTimeout(namaLookupTimers[role]);
  const badge = el(`mfP_${role}_badge`);
  if (!badge) return;
  if (!val || !val.trim()) { badge.hidden = true; badge.innerHTML = ""; return; }
  namaLookupTimers[role] = setTimeout(async () => {
    try {
      const res = await fetch(`${API_BASE}/muhurta/nama-nakshatra/lookup?name=${encodeURIComponent(val.trim())}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      badge.hidden = false;
      if (data.matched && data.result) {
        const r = data.result;
        badge.innerHTML = `${T("Suggested nama nakshatra", "సూచించిన నామ నక్షత్రం")}: <strong>${escapeHtml(T(r.nakshatra_en, r.nakshatra_te))}</strong>,
          ${T(`pada ${r.pada}`, `${r.pada}వ పాదం`)} (${T("syllable", "అక్షరం")} <code>${escapeHtml(r.matched_syllable)}</code>)
          <button type="button" class="btn btn--sm" onclick="confirmNamaNakshatra('${role}', ${Number(r.nakshatra_index)}, ${Number(r.pada)})">${T("Use this", "ఇదే వాడండి")}</button>`;
      } else {
        badge.textContent = T("No nakshatra matches this name's first syllable. Pick the nama nakshatra from the list.",
          "ఈ పేరు మొదటి అక్షరానికి నక్షత్రం సరిపోలలేదు. జాబితా నుండి నామ నక్షత్రం ఎంచుకోండి.");
      }
    } catch (e) {
      console.error("Nama lookup failed:", e);
      badge.hidden = false;
      badge.textContent = T("Name lookup failed. Pick the nakshatra directly.", "పేరు పరిశీలన విఫలమైంది. నక్షత్రం నేరుగా ఎంచుకోండి.");
    }
  }, 250);
}

function confirmNamaNakshatra(role, nakIdx, pada) {
  const nama = el(`mfP_${role}_nama`), npada = el(`mfP_${role}_npada`), badge = el(`mfP_${role}_badge`);
  if (nama) nama.value = String(nakIdx);
  if (npada) npada.value = String(pada);
  if (badge) badge.textContent = T(`Nama nakshatra set: ${NAKSHATRAS_27[nakIdx - 1].en}, pada ${pada}`,
    `నామ నక్షత్రం: ${NAKSHATRAS_27[nakIdx - 1].te}, ${pada}వ పాదం`);
}

function collectParticipants() {
  const out = [];
  document.querySelectorAll("#mfParticipants .person-card").forEach(card => {
    const v = k => card.querySelector(`[data-k="${k}"]`);
    const val = k => { const i = v(k); return i ? (i.type === "checkbox" ? i.checked : i.value.trim()) : ""; };
    const num = k => parseInt(val(k)) || null;
    const p = { role: card.dataset.role, name: val("name") || null, gotra: val("gotra") || null,
                gender: val("gender") || null, eldest: !!val("eldest") };
    if (val("profile_id")) p.profile_id = val("profile_id");      // saved family member (plan R1)
    if (val("birth_date")) p.birth_date = val("birth_date");
    // The nama star (Griha Pravesha cards only) always counts. The janma star is sent only when the birth
    // details are not known; when they are, the server works it out from them (21 Nov 2026).
    ["nama_nak_idx", "nama_pada"].forEach(k => { if (num(k)) p[k] = num(k); });
    if (card.dataset.mode === "star") ["janma_nak_idx", "janma_pada", "rasi_idx"].forEach(k => { if (num(k)) p[k] = num(k); });
    if (card.dataset.mode === "birth" && p.birth_date) {
      p.from_birth = true;
      p.birth_time_unknown = !!val("birth_time_unknown");
      if (!p.birth_time_unknown && val("birth_time")) p.birth_time = val("birth_time");
      const reg = (typeof allRegions !== "undefined" ? allRegions : []).find(r => r.id === val("birth_region"));
      if (reg) Object.assign(p, { birth_place: reg.label, birth_lat: reg.lat, birth_lon: reg.lon, birth_tz_offset: reg.tz_offset });
    }
    const given = p.profile_id || p.name || p.birth_date || p.janma_nak_idx || p.nama_nak_idx || p.rasi_idx || p.gender || p.eldest;
    if (given) out.push(p);
  });
  return out;
}
// ---- Required details not given (11 Nov 2026) ----
// Only people marked Required (level L1) are checked; Recommended and Optional people never ask.
// A saved family member counts as complete: the server fills in their star.
function missingRequired() {
  const specs = (currentRule()?.participants || []).filter(s => s.level === "L1");
  const given = collectParticipants();
  const out = [];
  specs.forEach(s => {
    const p = given.find(x => x.role === s.role) || {};
    if (p.profile_id) return;
    const fromBirth = !!(p.from_birth && p.birth_date);
    const parts = [];
    if (s.star_basis === "nama") {
      if (!p.nama_nak_idx) parts.push(T("nama nakshatra", "నామ నక్షత్రం"));
    } else if (p.from_birth) {
      // Birth details known: date and time (unless marked not known); the place defaults to the event's.
      if (!p.birth_time && !p.birth_time_unknown) parts.push(T("birth time", "జన్మ సమయం"));
    } else if (!fromBirth && !p.janma_nak_idx) {
      const card = document.querySelector(`#mfParticipants .person-card[data-role="${s.role}"]`);
      parts.push(card && card.dataset.mode === "birth" ? T("birth date", "పుట్టిన తేదీ") : T("janma nakshatra", "జన్మ నక్షత్రం"));
    }
    if ((s.fields || []).includes("birth_date") && !p.birth_date) parts.push(T("date of birth", "పుట్టిన తేదీ"));
    if (parts.length) out.push({ role: s.role, text: `${T(s.label_en, s.label_te)}: ${parts.join(", ")}` });
  });
  return out;
}
// ---- My family on the person cards (plan R1) ----
var FAMILY = [];          // var: the cards render before this line runs
var RELATION_LABELS = {
  self: ["Me", "నేను"], spouse: ["Spouse", "భార్య / భర్త"], son: ["Son", "కుమారుడు"], daughter: ["Daughter", "కుమార్తె"],
  father: ["Father", "తండ్రి"], mother: ["Mother", "తల్లి"], brother: ["Brother", "సోదరుడు"], sister: ["Sister", "సోదరి"],
  grandchild: ["Grandchild", "మనవడు / మనవరాలు"], other: ["Other", "ఇతరులు"],
};

async function loadFamily() {
  try {
    const res = await fetch(`${API_BASE}/me/family`);
    if (res.ok) FAMILY = (await res.json()).family || [];
  } catch (e) { console.warn("Family not loaded:", e.message); }   // cards work without it
}

function familyPickerHTML(role, st) {
  const id = `mfP_${role}_fam`;
  const fam = FAMILY || [];                // undefined during the first render, before this file finishes
  if (!fam.length) {
    return `<p class="participants__hint"><a href="family.html">${T("Save your family once", "మీ కుటుంబాన్ని ఒకసారి భద్రపరచండి")}</a>${T(" to fill these cards with one click.", " — తర్వాత ఒక క్లిక్‌తో ఈ వివరాలు నిండుతాయి.")}</p>`;
  }
  return `<div class="field field--family"><label for="${id}">${T("From my family", "నా కుటుంబం నుండి")}</label>
    <select id="${id}" data-k="profile_id" onchange="pickFamily('${role}', this.value)">
      <option value="">${T("— Enter the details below —", "— కింద వివరాలు నమోదు చేయండి —")}</option>
      ${fam.map(f => `<option value="${escapeHtml(f.id)}"${st.profile_id === f.id ? " selected" : ""}>${escapeHtml(f.display_name)} · ${escapeHtml(T(...(RELATION_LABELS[f.relation] || [f.relation, f.relation])))}</option>`).join("")}
    </select></div>`;
}

function pickFamily(role, profileId) {
  const f = (FAMILY || []).find(x => x.id === profileId);
  if (!f) return;
  const set = (k, v) => { const i = el(`mfP_${role}_${k}`); if (!i) return; if (i.type === "checkbox") i.checked = !!v; else i.value = v == null ? "" : String(v); };
  set("name", f.display_name); set("gotra", f.gotra);
  set("janma", f.janma_nak); set("jpada", f.janma_pada); set("nama", f.nama_nak); set("npada", f.nama_pada);
  set("rasi", f.janma_rasi); set("lagna", f.birth_lagna);
  set("gender", { male: "boy", female: "girl" }[f.gender] || ""); set("eldest", f.is_eldest);
  if (f.birth && f.birth.date) set("dob", f.birth.date);
  switchPersonMode(role, "star");          // the saved star is shown; the server checks it belongs to you
}

// ---- Add the open window to the family events of the people picked on the cards (plan R2) ----
async function addWindowToFamily(btn) {
  const r = lastData?.results?.[openDayIdx];
  const picked = collectParticipants().filter(p => p.profile_id);
  if (!r || !picked.length) {
    AppShell.toast(T("Pick people from \"From my family\" on the cards first; the event is saved for them.",
                     "ముందు కార్డులపై 'నా కుటుంబం నుండి' వ్యక్తులను ఎంచుకోండి; కార్యక్రమం వారికి భద్రపరుస్తాం."), "error");
    return;
  }
  const start = r.window_start || r.start_time || "";
  const time = /^\d{2}:\d{2}/.test(start) ? start.slice(0, 5) : null;
  btn.disabled = true;
  try {
    for (const p of picked) {
      const res = await fetch(`${API_BASE}/me/family/events`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: p.profile_id, activity_id: lastData.activity_id, event_date: r.date, event_time: time,
                               status: "planned", notes: T("Chosen in the Muhurta Finder", "ముహూర్త శోధనలో ఎంచుకున్నది") }) });
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error((d && typeof d.detail === "string" && d.detail) || `HTTP ${res.status}`); }
    }
    AppShell.toast(T(`Saved as a planned event for ${picked.map(p => p.name).join(" and ")}. See My family.`,
                     `${picked.map(p => p.name).join(", ")} కు నిర్ణయించిన కార్యక్రమంగా భద్రపరిచాము. 'నా కుటుంబం'లో చూడండి.`), "success");
  } catch (e) {
    AppShell.toast(T("Couldn't save the event: ", "కార్యక్రమం భద్రపరచలేకపోయాము: ") + e.message, "error");
  } finally { btn.disabled = false; }
}
