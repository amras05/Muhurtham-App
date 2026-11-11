// ============================================================
// Muhurtham App · component: Muhurta Finder page (30-day scanner)
// requires: js/config.js, js/i18n.js, js/regions.js
// ============================================================

// Per-page name maps (TARA/PLANET/CHART/D9 — the RASI/VAARA/PAKSHA/NAKSHATRA/
// TITHI/YOGA/KARANA/MONTH maps come from js/i18n.js)
const TARA_NAMES_TE = {
  "Janma": "జన్మ తార (అశుభం)", "Sampat": "సంపత్ తార (శుభం)", "Vipat": "విపత్ తార (అశుభం)",
  "Kshema": "క్షేమ తార (శుభం)", "Pratyak": "ప్రత్యక్ తార (అశుభం)", "Sadhana": "సాధన తార (శుభం)",
  "Naidhana": "నైధన తార (అశుభం)", "Mitra": "మిత్ర తార (శుభం)", "Paramamitra": "పరమమిత్ర తార (శుభం)"
};
const PLANET_ABBRS = {
  en: { L: "Asc", "0": "Su", "1": "Mo", "2": "Ma", "3": "Me", "4": "Ju", "5": "Ve", "6": "Sa", "7": "Ra", "8": "Ke", Mnd: "Mnd", Gk: "Gk" },
  te: { L: "ల", "0": "ర", "1": "చ", "2": "కు", "3": "బు", "4": "గు", "5": "శు", "6": "శ", "7": "రా", "8": "కే", Mnd: "మం", Gk: "గుళి" }
};
const CHART_GRID_POSITIONS = {
  11: { row: 1, col: 1 }, 0: { row: 1, col: 2 }, 1: { row: 1, col: 3 }, 2: { row: 1, col: 4 },
  3: { row: 2, col: 4 }, 4: { row: 3, col: 4 }, 5: { row: 4, col: 4 }, 6: { row: 4, col: 3 },
  7: { row: 4, col: 2 }, 8: { row: 4, col: 1 }, 9: { row: 3, col: 1 }, 10: { row: 2, col: 1 }
};
const D9_RASI_LABELS = {
  en: ["Mesha", "Vrishabha", "Mithuna", "Karkataka", "Simha", "Kanya", "Tula", "Vrishchika", "Dhanus", "Makara", "Kumbha", "Meena"],
  te: ["మేషం", "వృషభం", "మిథునం", "కర్కాటకం", "సింహం", "కన్య", "తుల", "వృశ్చికం", "ధనుస్సు", "మకరం", "కుంభం", "మీనం"]
};

// ---- Category tabs + event catalog (from /muhurta/catalog) ----
let progressInterval = null;
let allMuhurtaRules = [];
let currentCategory = "vivaha";  // current tab id

// Tabs come from /muhurta/catalog (Dr. Nemani's 17 categories); this list is only the
// fallback order if an older backend sends no `tabs`.
let CATEGORY_TABS = [
  { id: "vivaha", en: "Marriage", te: "వివాహ ముహూర్తాలు" },
  { id: "general", en: "General", te: "సాధారణ ముహూర్తాలు" },
];
let SUB_GROUP_LABELS = {};

function ruleInTab(r, tabId) {
  return (r.tab || r.category) === tabId || (r.also_in || []).includes(tabId);
}

// tab_inputs value in a rule file -> form group shown for that event
// (vivaha_couple and samskara_child are now asked on the participant cards.)
const TAB_INPUT_GROUPS = {
  upanayana_family: "fieldsUpanayana",
  griha_owner: "fieldsGriha",
  business: "fieldsBusiness",
  travel: "fieldsTravel",
  vehicle: "fieldsVehicle",
  samskara_pregnancy: "fieldsSamskaraPregnancy",
  garbhadhana_period: "fieldsGarbhadhanaPeriod",
  samskara_main_event: "fieldsSamskaraMainEvent",
  pitru_death: "fieldsPitruDeath",
};

async function loadMuhurtaCatalog() {
  try {
    const res = await fetch(`${API_BASE}/muhurta/catalog`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allMuhurtaRules = data.all_activities || [];
    if (Array.isArray(data.tabs) && data.tabs.length) CATEGORY_TABS = data.tabs;
    applyToolVisibility(data.hidden_tools || [], data.hidden_tools_marked || []);
    SUB_GROUP_LABELS = data.sub_groups || {};
    const firstWithEvents = CATEGORY_TABS.find(t => allMuhurtaRules.some(r => ruleInTab(r, t.id)));
    if (!allMuhurtaRules.some(r => ruleInTab(r, currentCategory)) && firstWithEvents) {
      currentCategory = firstWithEvents.id;
    }
    populateActivityDropdown();
  } catch (e) {
    console.error("Failed to load catalog:", e);
    setStatus(currentLang === "te"
      ? "ముహూర్త జాబితా లోడ్ కాలేదు. బ్యాకెండ్ నడుస్తోందో చూడండి."
      : `Couldn't load the event list (${e.message}). Check that the backend is running.`, true);
  }
}

function renderCategoryTabs() {
  const bar = el("mfCategoryTabs");
  if (!bar) return;
  bar.innerHTML = "";
  CATEGORY_TABS.forEach(t => {
    const count = allMuhurtaRules.filter(r => ruleInTab(r, t.id)).length;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = `mfTab-${t.id}`;
    btn.className = "tab-item" + (t.id === currentCategory ? " active" : "");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", t.id === currentCategory ? "true" : "false");
    btn.disabled = count === 0 && t.id !== "yogas";   // Special Yogas searches without events
    btn.title = count === 0 ? (currentLang === "te" ? "ఇంకా అందుబాటులో లేదు" : "Not available yet") : "";
    btn.innerHTML = `${currentLang === "te" ? t.te : t.en} <span class="tab-badge">${count}</span>` +
      (t.hidden ? `<span class="tab-hidden-mark">${currentLang === "te" ? "దాచబడింది" : "Hidden"}</span>` : "");
    btn.addEventListener("click", () => onCategoryChange(t.id));
    bar.appendChild(btn);
  });
}

function populateActivityDropdown() {
  renderCategoryTabs();
  if (poolMode) fillPoolEvents();           // keep the by-month event list in step (catalog load, language)
  const actSelect = el("mfActivitySelect");
  if (!actSelect) return;
  const prevVal = actSelect.value;
  const filtered = allMuhurtaRules.filter(r => ruleInTab(r, currentCategory));

  actSelect.innerHTML = "";
  let hasSelected = false;
  const groups = {};
  filtered.forEach(r => {
    const opt = document.createElement("option");
    const g = r.sub_group && SUB_GROUP_LABELS[r.sub_group];
    let parent = actSelect;
    if (g) {
      if (!groups[r.sub_group]) {
        groups[r.sub_group] = document.createElement("optgroup");
        groups[r.sub_group].label = currentLang === "te" ? g.te : g.en;
        actSelect.appendChild(groups[r.sub_group]);
      }
      parent = groups[r.sub_group];
    }
    opt.value = r.id;
    opt.textContent = (r.hidden ? (currentLang === "te" ? "[దాచబడింది] " : "[Hidden] ") : "") + (currentLang === "te" && r.title_te
      ? `${r.title_te} (${r.title_en})`
      : `${r.title_en} · ${r.title_te || ""}`);
    if (r.id === prevVal) {
      opt.selected = true;
      hasSelected = true;
    }
    parent.appendChild(opt);
  });
  if (!hasSelected && filtered.length > 0) {
    actSelect.selectedIndex = 0;
  }
  updateContextualFields();
  if (currentCategory === "yogas") renderYogaPanel();   // relabel on language change
}

function currentRule() {
  const act = el("mfActivitySelect")?.value;
  return allMuhurtaRules.find(r => r.id === act) || null;
}

// NAKSHATRAS_27 and RASIS_12 come from js/stars.js

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
  const mode = st.mode || "star";
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
      <div class="nama-mode-tabs" role="tablist" aria-label="${T("How to enter the star", "నక్షత్రం నమోదు విధానం")}">
        ${tab("star", "I know the nakshatra", "నాకు నక్షత్రం తెలుసు")}
        ${tab("name", "Find it from the name", "పేరు ద్వారా తెలుసుకోవాలి")}
        ${tab("birth", "Work it out from birth details", "జన్మ వివరాల ద్వారా")}
      </div>
      <div class="person-mode" data-for="star" ${mode === "star" ? "" : "hidden"}>
        <div class="context-grid">
          <div class="field"><label for="${id("janma")}">${T("Janma nakshatra", "జన్మ నక్షత్రం")}</label>
            <select id="${id("janma")}" data-k="janma_nak_idx">${optionList(NAKSHATRAS_27, T("— Not known —", "— తెలియదు —"), st.janma_nak_idx)}</select></div>
          <div class="field"><label for="${id("jpada")}">${T("Janma pada", "జన్మ పాదం")}</label>
            <select id="${id("jpada")}" data-k="janma_pada">${optionList(PADAS, "—", st.janma_pada)}</select></div>
          <div class="field"><label for="${id("nama")}">${T("Nama nakshatra", "నామ నక్షత్రం")}</label>
            <select id="${id("nama")}" data-k="nama_nak_idx">${optionList(NAKSHATRAS_27, T("— Not known —", "— తెలియదు —"), st.nama_nak_idx)}</select></div>
          <div class="field"><label for="${id("npada")}">${T("Nama pada", "నామ పాదం")}</label>
            <select id="${id("npada")}" data-k="nama_pada">${optionList(PADAS, "—", st.nama_pada)}</select></div>
          <div class="field"><label for="${id("rasi")}">${T("Janma rashi (chandrabala)", "జన్మ రాశి (చంద్రబలం)")}</label>
            <select id="${id("rasi")}" data-k="rasi_idx">${optionList(RASIS_12, T("— Not known —", "— తెలియదు —"), st.rasi_idx)}</select></div>
          <div class="field"><label for="${id("lagna")}">${T("Janma lagna", "జన్మ లగ్నం")}</label>
            <select id="${id("lagna")}" data-k="lagna_idx">${optionList(RASIS_12, T("— Not known —", "— తెలియదు —"), st.lagna_idx)}</select></div>
        </div>
      </div>
      <div class="person-mode" data-for="name" ${mode === "name" ? "" : "hidden"}>
        <div class="context-grid">
          <div class="field"><label for="${id("lookup")}">${T("Name as given at naming", "నామకరణంలో పెట్టిన పేరు")}</label>
            <input type="text" id="${id("lookup")}" data-k="lookup" value="${escapeHtml(st.lookup || "")}" autocomplete="off"
              oninput="onPersonNameLookup('${role}', this.value)"></div>
        </div>
        <div class="nama-detected-badge" id="${id("badge")}" aria-live="polite" ${st.nama_nak_idx && mode === "name" ? "" : "hidden"}>${st.nama_nak_idx && mode === "name"
          ? T(`Nama nakshatra set: ${NAKSHATRAS_27[st.nama_nak_idx - 1].en}, pada ${st.nama_pada || "—"}`, `నామ నక్షత్రం: ${NAKSHATRAS_27[st.nama_nak_idx - 1].te}, ${st.nama_pada || "—"}వ పాదం`) : ""}</div>
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
      "Give a nakshatra for each person you want checked. Leave a card empty to skip that person; the result says what was not checked.",
      "ఎవరి బలం పరిశీలించాలో వారి నక్షత్రం ఇవ్వండి. ఖాళీగా వదిలితే ఆ వ్యక్తి పరిశీలన జరగదు; ఫలితంలో ఆ విషయం చూపిస్తాం.")}</p>` +
    specs.map(personCardHTML).join("");
}

function switchPersonMode(role, mode) {
  const card = document.querySelector(`#mfParticipants .person-card[data-role="${role}"]`);
  if (!card) return;
  card.dataset.mode = mode;
  const needsDob = card.dataset.needsDob === "true";
  card.querySelectorAll(".nama-tab").forEach((b, i) => {
    const on = ["star", "name", "birth"][i] === mode;
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
        badge.textContent = T("No nakshatra matches this name's first syllable. Pick the nama nakshatra under 'I know the nakshatra'.",
          "ఈ పేరు మొదటి అక్షరానికి నక్షత్రం సరిపోలలేదు. 'నాకు నక్షత్రం తెలుసు'లో నామ నక్షత్రం ఎంచుకోండి.");
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
    // Directly picked values always count; birth details are sent when that mode is used.
    ["janma_nak_idx", "janma_pada", "nama_nak_idx", "nama_pada", "rasi_idx", "lagna_idx"].forEach(k => { if (num(k)) p[k] = num(k); });
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

// ---- Context-Sensitive Level 3 Fields ----
function updateContextualFields() {
  Object.values(TAB_INPUT_GROUPS).forEach(gId => {
    const g = el(gId);
    if (g) g.style.display = "none";
  });
  const rule = currentRule();
  (rule?.tab_inputs || []).forEach(key => {
    const g = el(TAB_INPUT_GROUPS[key]);
    if (g) g.style.display = "block";
  });

  const vField = el("mfVariantField");
  const vSel = el("mfVariantSelect");
  if (vField && vSel) {
    const alts = rule?.alternatives || [];
    vField.hidden = alts.length === 0;
    vSel.innerHTML = `<option value="">${currentLang === "te" ? "ప్రధాన జాబితా" : "Main list"}</option>` +
      alts.map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(currentLang === "te" ? (a.title_te || a.title_en) : a.title_en)}</option>`).join("");
  }

  const desc = el("mfEventDesc");
  if (desc) {
    let text = rule ? (currentLang === "te" ? (rule.description_te || "") : (rule.description_en || "")) : "";
    const base = rule?.extends && allMuhurtaRules.find(r => r.id === rule.extends);
    if (base) text += T(` · Uses the rules of "${base.title_en}" until the book's own rules are added.`,
                        ` · గ్రంథంలోని ప్రత్యేక నియమాలు చేర్చేవరకు "${base.title_te || base.title_en}" నియమాలు వర్తిస్తాయి.`);
    desc.textContent = text;
  }

  renderParticipants(rule);

  // Disclaimers: reference-only events, and the doctor's rule 10 for health and pregnancy.
  const banner = el("mfInfoBanner");
  if (banner) {
    const tab = rule?.tab || currentCategory;
    const notes = [];
    if (rule?.informational) notes.push(T(
      "Shown for reference from the book only. Follow your doctor's or lawyer's advice for medical or legal decisions.",
      "ఇది గ్రంథంలోని సమాచారం మాత్రమే. వైద్య/చట్ట నిర్ణయాలకు నిపుణుల సలహా పాటించండి."));
    if (tab === "health") notes.push(T(
      "A muhurta never replaces medical advice. Do not delay urgent treatment or surgery for a muhurta.",
      "ముహూర్తం వైద్యుని సలహాకు ప్రత్యామ్నాయం కాదు. అత్యవసర చికిత్స లేదా శస్త్రచికిత్సను ముహూర్తం కోసం వాయిదా వేయకూడదు."));
    if (tab === "garbha") notes.push(T(
      "This is a traditional muhurta only. It does not replace medical advice on pregnancy or conception.",
      "ఇది సంప్రదాయ ముహూర్త సూచన మాత్రమే; గర్భధారణకు సంబంధించిన వైద్య సలహాకు ప్రత్యామ్నాయం కాదు."));
    banner.hidden = notes.length === 0;
    banner.textContent = notes.join(" ");
  }
}

function onCategoryChange(catId) {
  currentCategory = catId;
  populateActivityDropdown();
  setYogaMode(catId === "yogas");
  const pp = el("mfPitruPanel");
  if (pp) pp.hidden = catId !== "pitru";
  setPitruMode(catId === "pitru" && pitruCalendarOn);
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

// ---- D1 Chart Builder ----
function buildD1ChartHTML(d1Array, centerLabel) {
  let rasiPlanets = Array.from({ length: 12 }, () => []);
  if (d1Array && d1Array.length > 0) {
    d1Array.forEach(item => {
      let pAbbr = PLANET_ABBRS[currentLang][item.planet] || item.planet;
      if (item.is_retro && item.planet !== "L" && item.planet !== "Mnd" && item.planet !== "Gk") {
        pAbbr += `<span class="chart-retro">${currentLang === "te" ? "(వ)" : "(R)"}</span>`;
      }
      if (item.is_combust && item.planet !== "L" && item.planet !== "Mnd" && item.planet !== "Gk") {
        pAbbr += `<span class="chart-combust">${currentLang === "te" ? "(మ)" : "(C)"}</span>`;
      }
      rasiPlanets[item.rasi_index].push(pAbbr);
    });
  }
  let html = `<div class="south-chart">`;
  html += `<div class="chart-center">${centerLabel}</div>`;
  for (let rasiIdx = 0; rasiIdx < 12; rasiIdx++) {
    const pos = CHART_GRID_POSITIONS[rasiIdx];
    const rasiName = D9_RASI_LABELS[currentLang][rasiIdx];
    const pList = rasiPlanets[rasiIdx].join(", ");
    html += `
      <div class="chart-cell" style="grid-row: ${pos.row}; grid-column: ${pos.col};">
        <div class="rasi-label">${rasiName}</div>
        <div class="planets-list">${pList || "—"}</div>
      </div>`;
  }
  html += `</div>`;
  return html;
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
    } else {
      if (!p.janma_nak_idx && !fromBirth) parts.push(T("janma nakshatra", "జన్మ నక్షత్రం"));
      if (!p.rasi_idx && !fromBirth) parts.push(T("janma rashi", "జన్మ రాశి"));
    }
    if ((s.fields || []).includes("birth_date") && !p.birth_date) parts.push(T("date of birth", "పుట్టిన తేదీ"));
    if (parts.length) out.push({ role: s.role, text: `${T(s.label_en, s.label_te)}: ${parts.join(", ")}` });
  });
  return out;
}

// ---- One year of muhurtas, 60 days at a time (11 Nov 2026) ----
// The first search covers 60 days; when the end of the list comes into view the next 60 days load,
// up to one year from the start date. Results are listed by date so new ones always follow on.
const YEAR_DAYS = 366, CHUNK_DAYS = 60;
let paging = null;        // { payload, scanned, done, loading, error, rejections }
let moreObserver = null;

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
  paging = { payload, scanned: payload.days_to_scan, done: payload.days_to_scan >= YEAR_DAYS, loading: false, error: null, rejections: {} };
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
  const days = Math.min(CHUNK_DAYS, YEAR_DAYS - paging.scanned);
  const body = { ...paging.payload, start_date: addDaysIso(paging.payload.start_date, paging.scanned), days_to_scan: days };
  try {
    const res = await fetch(`${API_BASE}/muhurta/find`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json().catch(() => null); throw new Error((d && typeof d.detail === "string" && d.detail) || `HTTP ${res.status}`); }
    const data = await res.json();
    lastData.results = lastData.results.concat(chunkResults(data).slice().sort(byDateTime));
    lastData.candidates = lastData.results;
    mergeRejections(data);
    paging.scanned += days;
    paging.done = paging.scanned >= YEAR_DAYS;
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
  const next = addDaysIso(paging.payload.start_date, Math.min(YEAR_DAYS, paging.scanned + CHUNK_DAYS) - 1);
  if (paging.loading) {
    box.innerHTML = `<span class="load-more__spinner" aria-hidden="true"></span> ${escapeHtml(T(`Loading muhurtas up to ${next}…`, `${next} వరకు ముహూర్తాలు లోడ్ అవుతున్నాయి…`))}`;
  } else if (paging.error) {
    box.innerHTML = `${escapeHtml(T("Couldn't load more: ", "మరిన్ని లోడ్ కాలేదు: ") + paging.error)} <button type="button" class="btn btn--sm" onclick="loadMore()">${escapeHtml(T("Try again", "మళ్ళీ ప్రయత్నించు"))}</button>`;
  } else if (paging.done) {
    box.innerHTML = escapeHtml(T(`That's one year of muhurtas, up to ${upTo}.`, `${upTo} వరకు ఒక సంవత్సరం ముహూర్తాలు చూపించాము.`));
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
    o.textContent = `${y}–${String(y + 1).slice(2)}`;
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
    const months = mdata.months.filter(m => !wanted.length || wanted.includes(m.month_number));
    if (!months.length) throw new Error(T("None of the chosen months falls in that year.", "ఎంచుకున్న మాసాలు ఆ సంవత్సరంలో లేవు."));
    const base = { activity_id: activityId, lat: loc.lat, lon: loc.lon, tz_offset: loc.tz_offset, place_name: loc.place_name,
                   panchaka_method: "standard", strictness: el("mfStrictness")?.value || "lenient", time_preference: "any",
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
      more.textContent = T(`All muhurtas for ${months.map(m => m.name_en).join(", ")} (${year}–${String(year + 1).slice(2)}).`,
                           `${months.map(m => m.name_te).join(", ")} (${year}–${String(year + 1).slice(2)}) ముహూర్తాలన్నీ చూపించాము.`);
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
        <span class="lagna-row__pct lagna-row__pct--${bandClass(r.percentage || 0)}">${r.percentage}%</span></div>
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

async function findMuhurtas() {
  const startDate = el("startDate").value;
  const days = CHUNK_DAYS;      // the first part of the year; the rest loads as the list scrolls
  paging = null;
  bandFilter = null;
  eventFilter = null;
  updateMore();
  if (!chosenPlace || (!startDate && !poolMode)) {
    setStatus(currentLang === "te" ? "దయచేసి తేదీ మరియు ప్రాంతం ఎంచుకోండి." : "Pick a start date and a place first.", true);
    return;
  }
  const lat = chosenPlace.lat, lon = chosenPlace.lon, tz_offset = chosenPlace.tz_offset, place_name = chosenPlace.label;
  if (poolMode) return runPool({ lat, lon, tz_offset, place_name });

  lastToolSearch = null;    // set again once a yoga or shraddha search succeeds
  if (currentCategory !== "yogas" && !(currentCategory === "pitru" && pitruCalendarOn)) {
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

  el("findBtn").disabled = true;
  el("mfResults").style.display = "none";
  el("progressSection").style.display = "block";
  el("progressFill").style.width = "10%";
  el("progressText").textContent = currentLang === "te" ? `${days} రోజుల ముహూర్త శోధన జరుగుతోంది...` : `Scanning ${days} days for auspicious Muhurtas...`;
  setStatus("");

  try {
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
      strictness: el("mfStrictness")?.value || "lenient",
      rule_variant: el("mfVariantSelect")?.value || null,
      time_preference: el("mfTimePref")?.value || "any",
      participants: collectParticipants(),
      lunar_months: [...document.querySelectorAll("#mfLunarMonths input:checked")].map(i => Number(i.value)),
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

// ---- Month names: Amanta (as the rules use) or Purnimanta (display only) ----
const LUNAR_MONTHS = [
  { en: "Chaitra", te: "చైత్ర మాసం" }, { en: "Vaishakha", te: "వైశాఖ మాసం" }, { en: "Jyeshtha", te: "జ్యేష్ఠ మాసం" },
  { en: "Ashadha", te: "ఆషాఢ మాసం" }, { en: "Shravana", te: "శ్రావణ మాసం" }, { en: "Bhadrapada", te: "భాద్రపద మాసం" },
  { en: "Ashwina", te: "ఆశ్వయుజ మాసం" }, { en: "Kartika", te: "కార్తీక మాసం" }, { en: "Margashira", te: "మార్గశిర మాసం" },
  { en: "Pushya", te: "పుష్య మాసం" }, { en: "Magha", te: "మాఘ మాసం" }, { en: "Phalguna", te: "ఫాల్గుణ మాసం" },
];

function displayMasa(cm) {
  const amanta = currentLang === "te" ? (cm.month_telugu || cm.month_name) : `${cm.month_name} Masam`;
  const n = Number(cm.month_number);
  const krishna = String(cm.paksha_en || "").toLowerCase().startsWith("krishna");
  if (el("mfMasaSystem")?.value !== "purnimanta" || !krishna || !(n >= 1 && n <= 12)) return amanta;
  // Purnimanta months end at the full moon, so Krishna paksha belongs to the next month.
  const m = LUNAR_MONTHS[n % 12];
  return currentLang === "te" ? `${m.te} (పూర్ణిమాంత)` : `${m.en} Masam (Purnimanta)`;
}

// ---- Result detail (Phase 12: what each result must show) ----
function roleLabel(role) {
  const spec = (currentRule()?.participants || []).find(p => p.role === role);
  return spec ? T(spec.label_en, spec.label_te) : role;
}

function limbWithTimes(lt, fallback) {
  if (!lt) return escapeHtml(fallback);
  const pada = lt.pada ? T(`, pada ${lt.pada}`, `, ${lt.pada}వ పాదం`) : "";
  return `${escapeHtml(lt.name)}${pada}<br><small class="limb-time">${escapeHtml(lt.start)} – ${escapeHtml(lt.end)}</small>`;
}

function peopleStrengthHTML(people) {
  const rows = people.filter(p => p.tara || p.chandrabala).map(p => {
    const tara = p.tara
      ? `<span class="pill ${p.tara.is_pass ? "pill--pass" : "pill--fail"}">${escapeHtml(T(p.tara.name, p.tara.name_te || p.tara.name))}</span>`
      : `<span class="pill pill--muted">${T("Not given", "ఇవ్వలేదు")}</span>`;
    const cb = p.chandrabala
      ? `<span class="pill ${p.chandrabala.is_pass ? "pill--pass" : "pill--fail"}">${T(`House ${p.chandrabala.house}`, `${p.chandrabala.house}వ ఇల్లు`)}</span>`
      : `<span class="pill pill--muted">${T("Not given", "ఇవ్వలేదు")}</span>`;
    const basis = p.star_basis_used ? (p.star_basis_used === "nama" ? T("nama star", "నామ నక్షత్రం") : T("janma star", "జన్మ నక్షత్రం")) : "";
    return `<tr><th scope="row">${escapeHtml(roleLabel(p.role))}${p.name ? `<br><small>${escapeHtml(p.name)}</small>` : ""}</th>
      <td>${tara}${basis ? `<br><small>${basis}</small>` : ""}</td><td>${cb}</td></tr>`;
  });
  if (!rows.length) return "";
  return `<div class="detail-card">
    <h4 class="detail-card__title">${Icon("users")} ${T("Strength for each person", "ప్రతి వ్యక్తికి బలం")}</h4>
    <div class="table-scroll"><table class="people-table">
      <thead><tr><th>${T("Person", "వ్యక్తి")}</th><th>${T("Tarabala", "తారాబలం")}</th><th>${T("Chandrabala", "చంద్రబలం")}</th></tr></thead>
      <tbody>${rows.join("")}</tbody></table></div></div>`;
}

const PLANET_LABEL = { jupiter: ["Jupiter (Guru)", "గురువు"], venus: ["Venus (Shukra)", "శుక్రుడు"], moon: ["Moon", "చంద్రుడు"] };
function lagnaStrengthHTML(det) {
  const lg = det.lagna || {};
  const strength = (det.planet_strength || []).map(s => {
    const [en, te] = PLANET_LABEL[s.planet] || [s.planet, s.planet];
    const bad = s.state === "combust" || s.state === "bala" || s.state === "vriddha";
    const extra = s.planet === "moon" ? ` · ${s.illumination}%` : (s.days ? T(` · ${s.days} days`, ` · ${s.days} రోజులు`) : "");
    const stateEn = { clear: "Strong", combust: "Combust", bala: "Child (bala)", vriddha: "Old (vriddha)", waxing: "Waxing", waning: "Waning" }[s.state] || s.state;
    return `<span class="pill ${bad ? "pill--fail" : "pill--pass"}">${T(en, te)}: ${escapeHtml(T(stateEn, s.state_te || stateEn))}${extra}</span>`;
  }).join(" ");
  const deg = lg.degree_dms ? T(` · ${lg.degree_dms} at ${lg.degree_at}`, ` · ${lg.degree_at}కు ${lg.degree_dms}`) : "";
  return `<div class="detail-card">
    <h4 class="detail-card__title">${Icon("landmark")} ${T("Lagna and planet strength", "లగ్నం · గ్రహ బలం")}</h4>
    <div class="detail-card__grid">
      <div><strong>${T("Lagna:", "లగ్నం:")}</strong> ${escapeHtml(T(lg.name || "—", lg.name_te || lg.name || "—"))}${escapeHtml(deg)}</div>
      <div><strong>${T("Navamsa:", "నవాంశ:")}</strong> ${escapeHtml(te(lg.navamsa || "—", RASI_NAMES_TE))}${lg.is_pushkara_navamsa ? T(" (pushkara", " (పుష్కర") + (lg.pushkara_minutes ? " " + escapeHtml(lg.pushkara_minutes.replace(/ \([^)]*\)/g, "")) : "") + ")" : ""}</div>
    </div>
    <div class="strength-row">${strength}</div>
  </div>`;
}

// Printed header: event, place and the record-only details (names, gotra, shakha...).
const RECORD_FIELDS = [
  ["veda_shakha", "Veda shakha", "వేద శాఖ"], ["sutra", "Sutra", "సూత్రం"], ["varna", "Varna", "వర్ణం"],
  ["business_name", "Business", "సంస్థ"], ["business_type", "Business type", "వ్యాపార రకం"],
  ["origin", "From", "ప్రారంభ స్థలం"], ["destination", "To", "గమ్యస్థానం"], ["travel_mode", "Mode", "ప్రయాణ విధానం"],
  ["house_type", "House", "ఇల్లు"], ["vehicle_type", "Vehicle", "వాహనం"],
];
function eventHeaderHTML(r) {
  const rule = currentRule();
  const people = (lastData?.participants || []).filter(p => p.name || p.gotra).map(p =>
    `${escapeHtml(roleLabel(p.role))}: ${escapeHtml(p.name || "—")}${p.gotra ? ` (${T("gotra", "గోత్రం")} ${escapeHtml(p.gotra)})` : ""}`);
  const ap = lastData?.activity_params || {};
  const rec = RECORD_FIELDS.filter(([k]) => ap[k]).map(([k, en, te]) => `${T(en, te)}: ${escapeHtml(ap[k])}`);
  const place = lastData?.birth_details?.place || lastData?.place_name || "";
  const lines = [
    `<strong>${escapeHtml(T(rule?.title_en || lastData?.title_en || "", rule?.title_te || lastData?.title_te || ""))}</strong>` +
      (place ? ` · ${escapeHtml(place)}` : "") + ` · ${escapeHtml(r.window_start || "")}–${escapeHtml(r.window_end || "")}`,
  ];
  if (people.length) lines.push(people.join(" · "));
  if (rec.length) lines.push(rec.join(" · "));
  return `<div class="event-header">${lines.map(l => `<div>${l}</div>`).join("")}</div>`;
}

// ---- Dosha rows ----
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const DOSHA_STATUS_LABEL = {
  pass: { en: "Clear", te: "శుద్ధం" },
  fail: { en: "Dosha", te: "దోషం" },
  not_evaluated: { en: "Not evaluated", te: "పరిశీలించలేదు" },
  excepted: { en: "Excepted", te: "మినహాయింపు" },
  to_confirm: { en: "To be confirmed", te: "నిర్ధారించాలి" },
  not_applicable: { en: "N/A", te: "వర్తించదు" },
};

function doshaStatus(m) {
  if (m.status) return m.status;
  if (m.is_pass === null || m.is_pass === undefined) return "not_evaluated";
  return m.is_pass ? "pass" : "fail";
}

// Panchang limbs arrive as a string ("Saptami (Shukla)") or an object ({name, paksha}).
function limbName(x) {
  if (x === null || x === undefined || x === "") return "—";
  if (typeof x !== "object") return String(x);
  const name = x.name || x.name_en || "—";
  return x.paksha ? `${name} (${x.paksha})` : name;
}

function doshaTally(list) {
  const n = s => list.filter(m => doshaStatus(m) === s).length;
  return currentLang === "te"
    ? `${n("pass")} శుద్ధం · ${n("fail")} దోషం` + (n("excepted") ? ` · ${n("excepted")} మినహాయింపు` : "") + ` · ${n("not_evaluated")} పరిశీలించలేదు`
    : `${n("pass")} clear · ${n("fail")} dosha` + (n("excepted") ? ` · ${n("excepted")} excepted` : "") + ` · ${n("not_evaluated")} not evaluated`;
}

function doshaItemHTML(m, title, desc, kind) {
  const status = doshaStatus(m);
  const itemCls = status === "fail" ? `dosha-item--fail-${kind}` : status === "pass" ? "dosha-item--pass" : (status === "excepted" || status === "to_confirm") ? "dosha-item--excepted" : "dosha-item--muted";
  const badgeCls = status === "fail" ? "dosha-item__badge--fail" : status === "pass" ? "dosha-item__badge--pass" : (status === "excepted" || status === "to_confirm") ? "dosha-item__badge--excepted" : "dosha-item__badge--muted";
  const descCls = status === "fail" ? "dosha-item__desc--fail" : status === "pass" ? "dosha-item__desc--pass" : "dosha-item__desc--muted";
  const label = (DOSHA_STATUS_LABEL[status] || DOSHA_STATUS_LABEL.pass)[currentLang === "te" ? "te" : "en"];
  const sev = status === "fail" && m.severity && m.severity !== "info" ? ` · ${m.severity}` : "";
  const ref = m.book_ref ? `<div class="dosha-item__ref">${escapeHtml(m.book_ref)}</div>` : "";
  return `
        <div class="dosha-item ${itemCls}">
          <div class="dosha-item__header">
            <strong class="dosha-item__name">${escapeHtml(title)}</strong>
            <span class="dosha-item__badge ${badgeCls}">${label}${sev}</span>
          </div>
          <div class="${descCls}">${escapeHtml(desc)}</div>
          ${ref}
        </div>`;
}

// ---- Render Results ----
function renderResults(data) {
  el("mfResults").style.display = "block";
  const results = data.results || data.candidates || [];
  const title = currentLang === "te" ? (data.title_te || data.title_en) : data.title_en;

  // Summary boxes double as filters (11 Nov 2026): Excellent >= 75 %, Medium 50-74 %, Avoid < 50 %.
  const band = r => { const p = r.percentage || 0; return p >= 75 ? "excellent" : p >= 50 ? "medium" : "avoid"; };
  const count = b => results.filter(r => band(r) === b).length;
  const tile = (key, n, numCls, en, te) => `
    <button type="button" class="summary-stat summary-stat--filter${bandFilter === key ? " is-active" : ""}" data-band="${key}"
            aria-pressed="${bandFilter === key}" title="${escapeHtml(T("Show only these", "ఇవి మాత్రమే చూపించు"))}">
      <span class="num ${numCls}">${n}</span>
      <span class="label">${escapeHtml(T(en, te))}</span>
    </button>`;
  el("summaryBar").innerHTML =
    tile("excellent", count("excellent"), "num--excellent", "Excellent", "ఉత్తమ ముహూర్తములు") +
    tile("medium", count("medium"), "num--favorable", "Medium", "మధ్యమ ముహూర్తములు") +
    tile("avoid", count("avoid"), "num--unfavorable", "Avoid", "నిషిద్ధములు") +
    tile("", results.length, "num--muhurta", "All muhurtas", "అన్ని ముహూర్తములు");

  // Day cards
  const grid = el("dayGrid");
  grid.innerHTML = "";

  // Minimum score (11 Nov 2026): hide cards below it, but keep each card's index into lastData so
  // "Full analysis" still opens the right one.
  const minScore = Number(el("mfMinScore")?.value || 0);
  const passes = r => (r.percentage || 0) >= minScore && (!bandFilter || band(r) === bandFilter)
                    && (!eventFilter || (r._event && r._event.id === eventFilter));
  renderEventFilter(data, results);
  const shownCount = results.filter(passes).length;
  const bandName = { excellent: T("Excellent", "ఉత్తమ"), medium: T("Medium", "మధ్యమ"), avoid: T("Avoid", "నిషిద్ధ") }[bandFilter];
  if (results.length > 0 && shownCount === 0 && bandFilter) {
    grid.innerHTML = `<div class="empty-state"><p>${escapeHtml(T(
      `No ${bandName} muhurtas among the ${results.length} loaded so far. Choose "All muhurtas" to see every one.`,
      `ఇప్పటివరకు లోడ్ అయిన ${results.length} లో ${bandName} ముహూర్తాలు లేవు. అన్నీ చూడటానికి "అన్ని ముహూర్తములు" నొక్కండి.`))}</p></div>`;
    return;
  }
  if (results.length > 0 && shownCount === 0) {
    const top = Math.max(...results.map(r => r.percentage || 0));
    grid.innerHTML = `<div class="empty-state"><p>${escapeHtml(T(
      `${results.length} muhurtas were found, but none reaches ${minScore}%. The best is ${top}%. Lower the minimum score to see them.`,
      `${results.length} ముహూర్తాలు లభించాయి, కానీ ఏదీ ${minScore}% చేరలేదు. అత్యధికం ${top}%. చూడటానికి కనీస శాతం తగ్గించండి.`))}</p></div>`;
    return;
  }
  if (minScore > 0 || bandFilter) {
    const what = [bandName, minScore > 0 ? T(`${minScore}% or above`, `${minScore}% పైన`) : ""].filter(Boolean).join(", ");
    grid.innerHTML = `<p class="results-filter-note">${escapeHtml(T(`Showing ${shownCount} of ${results.length} muhurtas: ${what}.`,
      `${results.length} లో ${shownCount} ముహూర్తాలు: ${what}.`))}</p>`;
  }

  if (results.length === 0) {
    const reasons = (data.rejection_summary || []).slice(0, 5)
      .map(x => `<li>${escapeHtml(x.reason)} <span class="reject-count">× ${x.count}</span></li>`).join("");
    const strictNote = data.strictness === "strict"
      ? (currentLang === "te"
        ? "కఠిన నియమంలో మహాదోషం ఉన్న సమయాలు దాచబడ్డాయి. 'అన్నీ చూపించు' ఎంచుకుంటే అవి సరిపోని మహాదోషంతో, తక్కువ శాతంతో కనిపిస్తాయి."
        : "Strict mode hides windows with a mahadosha. Choose \"Show all\" to see them with the mahadosha marked and a lower percentage.")
      : "";
    grid.innerHTML = `
      <div class="empty-state">
        <p>${currentLang === "te"
          ? (paging && !paging.done ? `మొదటి ${data.days_scanned} రోజుల్లో ముహూర్తం లేదు; ముందుకు వెతుకుతున్నాం…` : `ప్రారంభ తేదీ నుండి ఒక సంవత్సరంలో ఈ కార్యానికి శాస్త్రోక్త ముహూర్తం లభించలేదు. వేరే ప్రారంభ తేదీ ఎంచుకోండి.`)
          : data.monthRanges ? (data.poolDone ? `No muhurta for this event in the chosen months. Try other months or another year.` : `Nothing yet; looking through the next month…`)
          : (paging && !paging.done ? `Nothing in the first ${data.days_scanned} days; looking further…` : `No muhurta passed the book's rules within one year of the start date. Try another start date.`)}</p>
        ${reasons ? `<p class="empty-state__label">${currentLang === "te" ? "ఎక్కువగా తిరస్కరించిన కారణాలు:" : "Most common reasons windows were rejected:"}</p><ul class="empty-state__reasons">${reasons}</ul>` : ""}
        ${strictNote ? `<p class="empty-state__note">${strictNote}</p>` : ""}
      </div>`;
    return;
  }

  if (resultView === "compact" || data.allEvents) {
    renderCompactList(data, results, passes, grid);
    return;
  }

  let lastMonthHead = null;
  results.forEach((r, idx) => {
    if (!passes(r)) return;
    if (data.monthRanges) {
      const m = data.monthRanges.find(x => r.date >= x.start && r.date <= x.end);
      const key = m ? m.start : null;
      if (m && key !== lastMonthHead) {
        lastMonthHead = key;
        grid.insertAdjacentHTML("beforeend", `<h3 class="pool-month">${escapeHtml(T(m.name_en, m.name_te))} <small>${escapeHtml(m.start)} – ${escapeHtml(m.end)}</small></h3>`);
      }
    }
    const vaaraTe = VAARA_NAMES[currentLang][r.panchang?.vaara] || r.panchang?.vaara || "—";
    const nakRaw = typeof r.panchang?.nakshatra === 'object' ? r.panchang.nakshatra.name : (r.panchang?.nakshatra || "");
    const nakTe = te(nakRaw, NAKSHATRA_NAMES_TE) || nakRaw || "—";
    const tithiRaw = typeof r.panchang?.tithi === 'object' ? `${r.panchang.tithi.name || ''} (${r.panchang.tithi.paksha || ''})` : (r.panchang?.tithi || "—");
    const tName = typeof tithiRaw === 'string' ? tithiRaw.split(" ")[0] : "";
    const pName = typeof tithiRaw === 'string' && tithiRaw.toLowerCase().includes("shukla") ? "Shukla" : "Krishna";
    const tithiTe = currentLang === "te" ? `${te(tName, TITHI_NAMES_TE) || tName} (${PAKSHA_NAMES.te[pName] || pName})` : tithiRaw;

    const pct = r.percentage || 70;
    const isAvoid = pct < 50;
    const isGood = pct >= 75;
    const verdictClass = isAvoid ? "unfavorable" : (isGood ? "highly_favorable" : "favorable");
    const verdictText = currentLang === "te" ?
      (isAvoid ? "నిషిద్ధం" : (isGood ? "ఉత్తమ ముహూర్తం" : "మధ్యమ ముహూర్తం")) :
      (isAvoid ? "Avoid" : (isGood ? "Excellent" : "Medium"));
    // Amsha of the lagna inside this window (Pushkaramsha / Vargottamamsha / Shubhamsha) and when it starts.
    const am = r.amsha;
    const amshaHtml = am && am.type !== "none"
      ? `<div class="amsha-row"><span class="amsha-badge amsha-badge--${escapeHtml(am.type)}">${escapeHtml(T(am.name_en, am.name_te))}</span>` +
        `<span class="amsha-row__time">${escapeHtml(T(`best from ${am.at}`, `${am.at} నుండి ఉత్తమం`))}${am.navamsa ? ` · ${escapeHtml(T(am.navamsa + " navamsa", am.navamsa + " నవాంశ"))}` : ""}</span></div>`
      : "";
    // Doshapavada (book paras 1972-78): the book's exceptions present in this lagna. "all" ones cancel the
    // lagna doshas (not mahadoshas); "partial" ones count as a plus.
    const apv = r.doshapavada || [];
    const apavadaHtml = apv.length ? `<div class="apavada-row">${apv.map(a =>
      `<span class="apavada-chip apavada-chip--${a.kind === "all" ? "all" : "partial"}">✓ ${escapeHtml(T(a.en, a.te))}</span>`).join("")}</div>` : "";
    // Rahu kalam / Yamagandam / Gulika inside the window: information only. Book para 1681: by shastra only
    // the vara-janita durmuhurtas are followed, so these no longer cut windows or lower the score.
    const kalas = r.custom_kalas || [];
    const kalaHtml = kalas.length ? `<div class="custom-kala-note">${escapeHtml(T(
      `Overlaps ${kalas.map(k => `${k.name} ${k.start}–${k.end}`).join(", ")}: a custom, not shastra (book para 1681), so it is not counted.`,
      `${kalas.map(k => `${k.name} ${k.start}–${k.end}`).join(", ")} తో కలుస్తుంది: ఇది ఆచారం, శాస్త్రం కాదు (గ్రంథం 1681), కాబట్టి లెక్కించలేదు.`))}</div>` : "";
    // Age of the child on this date (only when the birth date was given): 0 preferred, 1 "if needed", 2 outside.
    const ag = r.age;
    const ageHtml = ag ? `<div class="amsha-row"><span class="bala bala--${ag.tier === 0 ? "ok" : ag.tier === 1 ? "warn" : "bad"}">${
      ag.tier === 0 ? "✓" : ag.tier === 1 ? "!" : "✕"} ${escapeHtml(T("Age", "వయస్సు"))}: ${escapeHtml(ag.text)}</span></div>` : "";
    // Each person's tarabala and chandrabala for this window (only when their star was given).
    const people = (r.detail?.people || []).filter(p => p.tara || p.chandrabala);
    const personalHtml = people.length ? `<div class="personal-bala">${people.map(p => {
      const who = p.name || T(String(p.role || "Person"), String(p.role || "వ్యక్తి"));
      const tara = p.tara ? `<span class="bala bala--${p.tara.is_pass ? "ok" : "bad"}">${p.tara.is_pass ? "✓" : "✕"} ${escapeHtml(T("Tarabala", "తారాబలం"))}: ${escapeHtml(T(p.tara.name, p.tara.name_te || p.tara.name))}</span>` : "";
      const cb = p.chandrabala ? `<span class="bala bala--${p.chandrabala.is_pass ? "ok" : "bad"}">${p.chandrabala.is_pass ? "✓" : "✕"} ${escapeHtml(T("Chandrabala", "చంద్రబలం"))}${p.chandrabala.house ? ` (${p.chandrabala.house}${T("th", "వ")})` : ""}</span>` : "";
      return `<div class="personal-bala__row"><strong>${escapeHtml(who)}</strong>${tara}${cb}</div>`;
    }).join("")}</div>` : "";
    const mahaCount = r.audit?.mahadosha?.failed || 0;
    const mahaTag = mahaCount ? ` · ${T(`${mahaCount} mahadosha not matched`, `${mahaCount} మహాదోషం సరిపోలేదు`)}` : "";

    const windowTimeStr = r.window_start ? `${r.window_start} – ${r.window_end}` : (r.start_time ? `${r.start_time} – ${r.end_time}` : "");
    const lagnaLabel = currentLang === "te" ? (r.lagna_te || r.lagna_en || "") : (r.lagna_en || "");

    // Eval dots
    const d = r.detailed_eval;
    let dotsHtml = "";
    if (d) {
      const checks = [
        { label: currentLang === "te" ? "వారం" : "Vaara", pass: d.vaara?.is_pass },
        { label: currentLang === "te" ? "తిథి" : "Tithi", pass: d.tithi?.is_pass },
        { label: currentLang === "te" ? "నక్షత్రం" : "Nak", pass: d.nakshatra?.is_pass },
        { label: currentLang === "te" ? "అష్టమ శుద్ధి" : "8th", pass: d.ashtama_shuddhi?.has_shuddhi },
      ];
      if (d.lagna?.is_pushkara_navamsa) {
        checks.push({ label: currentLang === "te" ? "పుష్కర నవాంశ" : "P.Nav", pass: true });
      }
      if (d.tara) {
        checks.push({ label: currentLang === "te" ? "తారాబలం" : "Tara", pass: d.tara?.is_pass });
      }
      if (d.chandrabalam) {
        checks.push({ label: currentLang === "te" ? "చంద్రబలం" : "Chandra", pass: d.chandrabalam?.is_pass });
      }
      if (d.panchaka) {
        checks.push({ label: currentLang === "te" ? "పంచకం" : "Panchaka", pass: d.panchaka?.is_pass });
      }
      dotsHtml = `<div class="eval-dots" style="margin-top: 8px;">${checks.map(c =>
        `<span class="eval-dot ${c.pass ? 'pass' : 'fail'}">${c.pass ? '✓' : '✕'} ${c.label}</span>`
      ).join("")}</div>`;
    }

    // Pushkara Box
    let pushMini = "";
    if (r.pushkara_info) {
      const pi = r.pushkara_info;
      const stmt = currentLang === "te" ? pi.statement_te : pi.statement_en;
      pushMini = `
        <div class="pushkara-mini" style="margin-top: 10px;">
          <strong>${Icon("clock")} ${stmt}</strong>
          <div class="pushkara-mini__details" style="font-size: 12px; margin-top: 4px; color: #555;">
            ${windowTimeStr ? `${Icon("landmark")} <strong>${currentLang === "te" ? "శుభ ముహూర్త వ్యవధి:" : "Muhurtha Window:"}</strong> ${windowTimeStr} (${lagnaLabel} లగ్నం)` : ""}
            ${pi.pushkara_bhaga?.is_available ? `<br>${Icon("pin")} <strong>${currentLang === "te" ? "పుష్కర భాగం:" : "P. Bhaga:"}</strong> ${pi.pushkara_bhaga.precise_time} (${pi.pushkara_bhaga.time_window})` : ""}
            ${pi.pushkara_navamsha?.is_available ? `<br>${Icon("pin")} <strong>${currentLang === "te" ? "పుష్కర నవాంశ:" : "P. Navamsha:"}</strong> ${pi.pushkara_navamsha.precise_time}` : ""}
          </div>
        </div>`;
    }

    // Reasons chips
    let reasonsHtml = "";
    if (r.reasons && r.reasons.length > 0) {
      reasonsHtml = `<ul class="activity-reasons" style="margin-top: 8px; font-size: 12px; color: #444; line-height: 1.5;">${r.reasons.slice(0, 4).map(re => `<li>${re}</li>`).join("")}</ul>`;
    }

    // Special yogas
    let yogasHtml = "";
    if (r.special_yogas && r.special_yogas.length > 0) {
      yogasHtml = `<div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">${r.special_yogas.map(y => `<span class="rule-chip" style="background:var(--color-warning-bg); color:var(--color-warning); font-size:11px;">${Icon("sparkle")} ${currentLang === 'te' ? y.name_te : y.name_en}</span>`).join("")}</div>`;
    }

    grid.innerHTML += `
      <div class="day-card ${verdictClass}" onclick="openDayModal(${idx})" style="cursor: pointer; margin-bottom: 16px;">
        ${auditBannerHTML(r.audit, true)}
        <div class="day-header">
          <div>
            <div class="day-date" style="font-size: 16px; font-weight: 700;">${r.date} · ${vaaraTe}</div>
            <div class="day-vaara" style="font-size: 13px; color: #777;">
              ${r.panchang?.chandramana ? `${Icon("lamp")} ${r.panchang.chandramana.month_name || ''} · ${tithiTe}` : tithiTe} · ${nakTe}
            </div>
          </div>
          <div class="day-right">
            <span class="verdict-badge ${verdictClass}">${pct}% · ${verdictText}${mahaTag}</span>
          </div>
        </div>
        ${amshaHtml}
        ${apavadaHtml}
        ${ageHtml}
        ${kalaHtml}
        ${pushMini}
        ${personalHtml}
        ${dotsHtml}
        ${yogasHtml}
        ${reasonsHtml}
        <div style="margin-top: 12px; text-align: right;">
          <button type="button" onclick="event.stopPropagation(); openDayModal(${idx})" class="btn btn--primary btn--sm" style="font-size: 12px; padding: 6px 14px;">
            ${Icon("search")} ${currentLang === "te" ? "సమగ్ర విశ్లేషణ & D1 చక్రం చూడండి →" : "View Full Analysis & D1 Chart Popup →"}
          </button>
        </div>
      </div>
    `;
  });
}

// ---- Modal ----
function openDayModal(idx) {
  if (!lastData || !lastData.results[idx]) return;
  openDayIdx = idx;
  const r = lastData.results[idx];
  const d = r.detailed_eval;

  const vaaraTe = VAARA_NAMES[currentLang][r.panchang?.vaara] || r.panchang?.vaara;
  const rawNak = typeof r.panchang?.nakshatra === 'object' ? r.panchang.nakshatra.name : (r.panchang?.nakshatra || "");
  const nakTe = te(rawNak, NAKSHATRA_NAMES_TE) || rawNak;

  el("mfModalTitle").innerHTML = `${r.date} · ${vaaraTe}`;

  let bodyHtml = "";

  // 1. Pushkara Info
  const pi = r.pushkara_info;
  if (pi) {
    const stmt = currentLang === "te" ? pi.statement_te : pi.statement_en;
    const avoidNote = currentLang === "te" ? pi.avoid_note_te : pi.avoid_note_en;
    let subDetails = [];
    if (pi.pushkara_bhaga?.is_available) {
      subDetails.push(currentLang === "te" ?
        `${Icon("pin")} <strong>పుష్కర భాగ ముహూర్తం:</strong> ${pi.pushkara_bhaga.precise_time} (వ్యవధి: ${pi.pushkara_bhaga.time_window})` :
        `${Icon("pin")} <strong>Pushkara Bhaga:</strong> ${pi.pushkara_bhaga.precise_time} (Window: ${pi.pushkara_bhaga.time_window})`);
    }
    if (pi.pushkara_navamsha?.is_available) {
      subDetails.push(currentLang === "te" ?
        `${Icon("pin")} <strong>పుష్కర నవాంశ ముహూర్తం:</strong> ${pi.pushkara_navamsha.precise_time} (వ్యవధి: ${pi.pushkara_navamsha.time_window})` :
        `${Icon("pin")} <strong>Pushkara Navamsha:</strong> ${pi.pushkara_navamsha.precise_time} (Window: ${pi.pushkara_navamsha.time_window})`);
    }
    if (subDetails.length === 0) {
      subDetails.push(`${Icon("pin")} <strong>${currentLang === "te" ? "సమయ వ్యవధి:" : "Window:"}</strong> ${pi.time_window}`);
    }

    bodyHtml += `
      <div class="rec-time-box">
        <h4 class="rec-time-box__title">${Icon("sun")} ${currentLang === "te" ? "శుభ ముహూర్త సమయ నిర్ణయం" : "Recommended Time Prediction"}</h4>
        <div class="rec-time-box__time">${Icon("clock")} ${stmt}</div>
        <div class="rec-time-box__details">
          ${subDetails.join("<br>")}
        </div>
        ${avoidNote ? `<div class="rec-time-box__note">${Icon("alert")} ${currentLang === "te" ? "గమనిక:" : "Note:"} ${avoidNote}</div>` : ''}
      </div>`;
  }

  const det = r.detail;
  bodyHtml += auditBannerHTML(r.audit, false);
  bodyHtml += eventHeaderHTML(r);
  if (det) {
    bodyHtml += `<div class="verdict-strip" role="note">${escapeHtml(T(det.verdict_en, det.verdict_te))}</div>`;
  }

  // 2. Each person's strength (falls back to the single-person box for older results)
  const bd = lastData.birth_details;
  const cb = d?.chandrabalam || r.panchang?.chandrabalam;
  const peopleHtml = det?.people?.length ? peopleStrengthHTML(det.people) : "";
  bodyHtml += peopleHtml;
  if (!peopleHtml && (bd || cb)) {
    const bNakTe = bd ? te(bd.janma_nakshatra || "", NAKSHATRA_NAMES_TE) : "";
    const bRasiTe = bd?.birth_moon_rasi ? (te(bd.birth_moon_rasi, RASI_NAMES_TE) || bd.birth_moon_rasi) : "";
    const cbDesc = cb ? (currentLang === "te" ? cb.desc_te : cb.desc_en) : "";
    const cbBadgeClass = cb?.is_pass ? "native-profile-box__badge--pass" : "native-profile-box__badge--fail";
    bodyHtml += `
      <div class="native-profile-box">
        <div class="native-profile-box__header">
          <strong class="native-profile-box__title">${Icon("user")} ${currentLang === "te" ? "వ్యక్తిగత సమాచారం & గోచారం (Native & Transit)" : "Native Profile & Transit Details"}</strong>
          ${cb ? `<span class="native-profile-box__badge ${cbBadgeClass}">${Icon("moon")} ${currentLang === "te" ? "చంద్రబలం:" : "Chandrabalam:"} ${cb.house ? cb.house + 'వ ఇల్లు' : 'అనుకూలం'}</span>` : ''}
        </div>
        <div class="native-profile-box__grid">
          ${bd?.janma_nakshatra ? `<span><strong>${currentLang === "te" ? "జన్మ నక్షత్రం:" : "Janma Nakshatra:"}</strong> ${bNakTe || bd.janma_nakshatra} ${bd.janma_nakshatra_pada ? `(${bd.janma_nakshatra_pada} ${currentLang === "te" ? "పాదం" : "pada"})` : ""}</span>` : ''}
          ${bd?.birth_moon_rasi ? `<span><strong>${currentLang === "te" ? "జన్మ రాశి:" : "Janma Rasi:"}</strong> ${bRasiTe}</span>` : ''}
          ${d?.tara ? `<span><strong>${currentLang === "te" ? "తారాబలం:" : "Tarabalam:"}</strong> ${te(d.tara.name, TARA_NAMES_TE) || d.tara.name}</span>` : ''}
        </div>
        ${cbDesc ? `<div class="native-profile-box__footer">ℹ️ ${cbDesc}</div>` : ''}
      </div>`;
  }

  // 3. Chandramana Header (Samvatsara, Ayanam, Ruthu, Maasam, Paksham)
  const cm = r.panchang?.chandramana;
  let cmBanner = "";
  if (cm) {
    const samName = currentLang === "te" ? `${cm.samvatsara_name} (${cm.samvatsara_telugu}) నామ సంవత్సరం` : `${cm.samvatsara_name} Samvatsara`;
    const ayanam = currentLang === "te" ? (cm.ayanam_te || cm.ayanam_en) : cm.ayanam_en;
    const ruthu = currentLang === "te" ? (cm.ruthu_te || cm.ruthu_en) : cm.ruthu_en;
    const maasa = displayMasa(cm);
    const paksha = currentLang === "te" ? (cm.paksha_te || cm.paksha_en) : `${cm.paksha_en} Paksham`;
    cmBanner = `
      <div class="cm-banner">
        <span class="cm-banner__sam">${Icon("lamp")} ${samName}</span>
        <span>·</span>
        <span class="cm-banner__ayanam">${ayanam}</span>
        <span>·</span>
        <span class="cm-banner__ruthu">${ruthu}</span>
        <span>·</span>
        <span class="cm-banner__maasa">${maasa}</span>
        <span>·</span>
        <span class="cm-banner__paksha">${paksha}</span>
      </div>`;
  }

  // Panchang Grid
  const isAbhijitAuspicious = r.panchang?.abhijit_kala_muhurtham && r.panchang.abhijit_kala_muhurtham.status === 'auspicious';
  bodyHtml += `
    <div class="detail-card">
      <h4 class="detail-card__title">${Icon("pin")} ${currentLang === "te" ? "పంచాంగ వివరాలు" : "Panchang Details"}</h4>
      ${cmBanner}
      <div class="detail-card__grid">
        <div><strong>${currentLang === "te" ? "వారం:" : "Weekday:"}</strong> ${vaaraTe}</div>
        <div><strong>${currentLang === "te" ? "తిథి:" : "Tithi:"}</strong> ${limbWithTimes(r.detail?.limb_times?.tithi, limbName(r.panchang?.tithi))}</div>
        <div><strong>${currentLang === "te" ? "నక్షత్రం:" : "Nakshatra:"}</strong> ${limbWithTimes(r.detail?.limb_times?.nakshatra && { ...r.detail.limb_times.nakshatra, name: nakTe }, nakTe)}</div>
        <div><strong>${currentLang === "te" ? "యోగం:" : "Yoga:"}</strong> ${limbWithTimes(r.detail?.limb_times?.yoga, limbName(r.panchang?.yoga))}</div>
        <div><strong>${currentLang === "te" ? "కరణం:" : "Karana:"}</strong> ${limbWithTimes(r.detail?.limb_times?.karana, limbName(r.panchang?.karana))}</div>
        <div><strong>${currentLang === "te" ? "సూర్యోదయం:" : "Sunrise:"}</strong> ${r.panchang?.sunrise || "—"}</div>
        <div><strong>${currentLang === "te" ? "సూర్యాస్తమయం:" : "Sunset:"}</strong> ${r.panchang?.sunset || "—"}</div>
        <div><strong>${currentLang === "te" ? "అభిజిత్ ముహూర్తం:" : "Abhijit:"}</strong> ${r.panchang?.abhijit_muhurta ? (r.panchang.abhijit_muhurta.start + ' – ' + r.panchang.abhijit_muhurta.end) : '—'}</div>
        <div class="abhijit-strip ${isAbhijitAuspicious ? 'abhijit-strip--auspicious' : 'abhijit-strip--inauspicious'}">
          <span>${Icon(isAbhijitAuspicious ? "sparkle" : "alert")}</span>
          <span>
            <strong>${currentLang === "te" ? "అభిజిత్ కాల ముహూర్తం:" : "Abhijit Kala Muhurtham:"}</strong>
            ${r.panchang?.abhijit_kala_muhurtham ? 
              (currentLang === 'te' ? r.panchang.abhijit_kala_muhurtham.msg_te : r.panchang.abhijit_kala_muhurtham.msg_en) : 
              '—'
            }
          </span>
        </div>
      </div>
    </div>`;

  if (det) bodyHtml += lagnaStrengthHTML(det);

  // 4. Panchaka Rahitam Card
  const pan = r.panchang?.panchaka_rahitam || d?.panchaka;
  if (pan) {
    const panName = currentLang === "te" ? pan.name_te : pan.name_en;
    const panEffect = currentLang === "te" ? pan.effect_te : pan.effect_en;
    const panPariharam = currentLang === "te" ? pan.pariharam_te : pan.pariharam_en;
    const isPass = pan.is_pass;
    bodyHtml += `
      <div class="panchaka-box ${isPass ? 'panchaka-box--pass' : 'panchaka-box--fail'}">
        <div class="panchaka-box__header">
          <h4 class="panchaka-box__title ${isPass ? 'panchaka-box__title--pass' : 'panchaka-box__title--fail'}">
            ${Icon("wheel")} ${currentLang === "te" ? "పంచక రహిత విశ్లేషణ (Panchaka Rahitam)" : "Panchaka Rahitam Analysis"}
          </h4>
          <span class="panchaka-box__badge ${isPass ? 'panchaka-box__badge--pass' : 'panchaka-box__badge--fail'}">
            ${isPass ? (currentLang === "te" ? "శుభ పంచకం (దోష రహితం)" : "Subha (Clean)") : (currentLang === "te" ? "అశుభ పంచకం" : "Dosha")}
          </span>
        </div>
        <div class="panchaka-box__body">
          <div><strong>${currentLang === "te" ? "పంచక నిర్ణయ సూత్రం:" : "Formula:"}</strong> <code>${pan.formula || `(తిథి + వారం + నక్షత్రం + లగ్నం) % 9 = శేషం ${pan.remainder}`}</code></div>
          <div class="panchaka-box__classification"><strong>${currentLang === "te" ? "పంచక ఫలితం:" : "Classification:"}</strong> <span class="${isPass ? 'panchaka-box__classification-name--pass' : 'panchaka-box__classification-name--fail'}">${panName}</span> — <em>${panEffect}</em></div>
          ${panPariharam && !isPass ? `
            <div class="panchaka-box__remedy">
              <strong>${Icon("leaf")} ${currentLang === "te" ? "శాస్త్రోక్త పరిహారం:" : "Classical Remedy:"}</strong> ${panPariharam}
            </div>
          ` : ''}
        </div>
      </div>`;
  }

  // 5. Daily 5-Fold Division (Kala Vibhajana)
  const kv = r.panchang?.kala_vibhajana;
  if (kv) {
    bodyHtml += `
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
  }

  // 6. Lagna Schedule (ప్రతి లగ్న అంతము - All 12 Lagnas)
  const lsched = r.panchang?.lagna_schedule;
  if (lsched && lsched.length > 0) {
    const currentLagnaName = d?.lagna_shuddhi?.muhurta_lagna || "";
    bodyHtml += `
      <div class="lagna-section">
        <h4 class="lagna-section__title">
          <span>${Icon("landmark")} ${currentLang === "te" ? "ప్రతి లగ్న అంతము (సూర్యోదయం నుండి 12 లగ్నాలు)" : "Daily Lagna Schedule (Lagna Antyalu - All 12 Signs)"}</span>
          <span class="lagna-section__subtitle">${currentLang === "te" ? "ముహూర్త లగ్నం హైలైట్ చేయబడినది" : "Muhurta Lagna Highlighted"}</span>
        </h4>
        <div class="lagna-grid">`;
    lsched.forEach(l => {
      const isCurrent = currentLagnaName && (l.lagna_name === currentLagnaName || l.lagna_name_te === currentLagnaName);
      const lName = currentLang === "te" ? l.lagna_name_te : l.lagna_name;
      bodyHtml += `
        <div class="lagna-item ${isCurrent ? 'lagna-item--current' : ''}">
          <div class="lagna-item__header">
            <strong class="lagna-item__name">${lName}</strong>
            ${isCurrent ? `<span class="lagna-item__muhurta-tag">ముహూర్తం</span>` : ''}
          </div>
          <div class="lagna-item__time">${l.start_time} – ${l.end_time}</div>
        </div>`;
    });
    bodyHtml += `</div></div>`;
  }

  // 7. Inauspicious timings + Explanation Note
  const ip = r.panchang?.inauspicious_periods || r.panchang || {};
  function fmtP(p) {
    if (!p) return "—";
    if (typeof p === 'string') return p.trim() || "—";
    if (Array.isArray(p)) return p.map(i => typeof i === 'object' && i.start ? `${i.start} – ${i.end}` : String(i)).filter(Boolean).join(" & ") || "—";
    if (typeof p === 'object' && p.start) return `${p.start} – ${p.end}`;
    return String(p) || "—";
  }
  bodyHtml += `
    <div class="inauspicious-card">
      <h4 class="inauspicious-card__title">${Icon("hourglass")} ${currentLang === "te" ? "అశుభ సమయములు" : "Inauspicious Timings"}</h4>
      <div class="inauspicious-card__grid">
        <div><strong>${currentLang === "te" ? "రాహు కాలం:" : "Rahu:"}</strong> ${fmtP(ip.rahu_kalam)}</div>
        <div><strong>${currentLang === "te" ? "యమగండం:" : "Yama:"}</strong> ${fmtP(ip.yamagandam)}</div>
        <div><strong>${currentLang === "te" ? "గుళిక కాలం:" : "Gulika:"}</strong> ${fmtP(ip.gulika_kalam)}</div>
        <div><strong>${currentLang === "te" ? "దుర్ముహూర్తం:" : "Dur:"}</strong> ${fmtP(ip.durmuhurtam)}</div>
        <div><strong>${currentLang === "te" ? "వర్జ్యం:" : "Varjyam:"}</strong> ${fmtP(ip.varjyam)}</div>
      </div>
      ${det?.cut_by?.length ? `<div class="inauspicious-card__cut"><strong>${T("Cut from this lagna:", "ఈ లగ్నం నుండి తొలగించినవి:")}</strong> ${
        det.cut_by.map(c => `${escapeHtml(c.label)} ${escapeHtml(c.start)}–${escapeHtml(c.end)}`).join(" · ")}</div>` : ""}
      <div class="inauspicious-card__note">
        ℹ️ <strong>${currentLang === "te" ? "పంచాంగ సమయాల వివరణ:" : "Note on Astrological Timings Across Apps:"}</strong> 
        ${currentLang === "te" ? 
          "ఒక App లో ఒక రకంగా, ఇంకో App లో వేరే రకంగా ఉండటానికి కారణం: ఈ యాప్ ఖచ్చితమైన స్థానిక దృక్సిద్ధాంతం (Drik-Ganita Topocentric Swiss Ephemeris) ఆధారంగా ఆ ప్రదేశపు నిజ సూర్యోదయ/సూర్యాస్తమయ సమయాలను అనుసరించి 8 సమాన భాగాలుగా రాహుకాలం, యమగండం, దుర్ముహూర్తములను గణిస్తుంది. ప్రామాణిక 12 గంటల ఫిక్స్‌డ్ సమయాలను కాకుండా ఖగోళ సంబంధిత కచ్చితమైన సమయాన్ని ఇస్తుంది." : 
          "Timings may slightly vary across different panchang apps. This app calculates precise Drik-Ganita topocentric astronomical sunrise/sunset for your exact location, dividing the local daylight period into 8 equal Ashtabhaga intervals. This provides authentic classical accuracy rather than fixed standard calendar estimates."}
      </div>
    </div>`;

  // 8. D1 Chart
  const mTime = pi ? pi.precise_time : "";
  const chartLabel = currentLang === "te" ? `ముహూర్త D1<br>(${mTime || r.date})` : `MUHURTA D1<br>(${mTime || r.date})`;
  bodyHtml += `
    <div class="chart-card">
      <h4 class="chart-card__title">${Icon("chart")} ${currentLang === "te" ? `ముహూర్త D1 చక్రం (${r.date})` : `Muhurta D1 Chart (${r.date})`}</h4>
      ${buildD1ChartHTML(r.d1_chart, chartLabel)}
    </div>`;

  // 9. Rule Evaluation Grid
  if (d) {
    bodyHtml += `<h4 class="rules-eval-title">${Icon("scroll")} ${currentLang === "te" ? "ముహూర్త నియమ విశ్లేషణ" : "Muhurta Rules Evaluation"}</h4>`;
    bodyHtml += `<div class="rule-grid">`;

    // Vaara
    bodyHtml += buildRuleCard(currentLang === "te" ? "1. వార శుద్ధి" : "1. Weekday", d.vaara?.is_pass,
      `${vaaraTe} — ${d.vaara?.is_pass ? (currentLang === "te" ? "అనుకూలమైన వారం." : "Favorable weekday.") : (currentLang === "te" ? "అనుకూలం కాని వారం." : "Not recommended.")}`);

    // Tithi
    bodyHtml += buildRuleCard(currentLang === "te" ? "2. తిథి శుద్ధి" : "2. Tithi", d.tithi?.is_pass,
      `${limbName(r.panchang?.tithi)} — ${d.tithi?.is_pass ? (currentLang === "te" ? "అనుకూలమైన తిథి." : "Favorable.") : (currentLang === "te" ? "నిషిద్ధ / రిక్త తిథి (చతుర్థి, అష్టమి, నవమి, చతుర్దశి, పౌర్ణమి, అమావాస్య నిషిద్ధం)." : "Avoided Tithi (Chaturthi, Ashtami, Navami, Chaturdashi, Purnima, Amavasya avoided).")}`);

    // Nakshatra
    bodyHtml += buildRuleCard(currentLang === "te" ? "3. నక్షత్ర శుద్ధి" : "3. Nakshatra", d.nakshatra?.is_pass,
      `${nakTe} — ${d.nakshatra?.is_pass ? (currentLang === "te" ? "శ్రేష్ఠ నక్షత్రం." : "Favorable star.") : (currentLang === "te" ? "అనుకూలం కాని నక్షత్రం." : "Not favorable.")}`);

    // Yoga
    bodyHtml += buildRuleCard(currentLang === "te" ? "4. యోగం" : "4. Yoga", d.yoga?.is_pass,
      `${limbName(r.panchang?.yoga)} — ${d.yoga?.is_pass ? (currentLang === "te" ? "అనుకూల యోగం." : "Favorable.") : (currentLang === "te" ? "అశుభ యోగం." : "Inauspicious Yoga.")}`);

    // Karana
    bodyHtml += buildRuleCard(currentLang === "te" ? "5. కరణం" : "5. Karana", d.karana?.is_pass,
      `${limbName(r.panchang?.karana)} — ${d.karana?.is_pass ? (currentLang === "te" ? "అనుకూల కరణం." : "Favorable.") : (currentLang === "te" ? "అశుభ కరణం." : "Inauspicious.")}`);

    // Ashtama Shuddhi
    const as = d.ashtama_shuddhi;
    const aRasi = as?.ashtama_rasi ? ` (${te(as.ashtama_rasi, RASI_NAMES_TE)})` : "";
    bodyHtml += buildRuleCard(currentLang === "te" ? "6. అష్టమ శుద్ధి" : "6. 8th House", as?.has_shuddhi,
      as?.has_shuddhi ?
        (currentLang === "te" ? `8వ ఇల్లు${aRasi} ఖాళీగా ఉంది.` : `8th house${aRasi} is vacant.`) :
        (currentLang === "te" ? `8వ ఇంట్లో${aRasi} గ్రహాలు ఉన్నాయి (${(as?.planets_in_8th || []).join(", ")}).` : `Planets in 8th${aRasi}: ${(as?.planets_in_8th || []).join(", ")}.`));

    // Lagna Shuddhi
    const ls = d.lagna_shuddhi;
    bodyHtml += buildRuleCard(currentLang === "te" ? "7. లగ్న శుద్ధి" : "7. Lagna", ls?.has_shuddhi,
      ls?.has_shuddhi ?
        (currentLang === "te" ? `లగ్నం (${te(ls.muhurta_lagna, RASI_NAMES_TE) || ls.muhurta_lagna}) ఖాళీగా ఉంది.` : `Lagna (${ls?.muhurta_lagna}) is vacant.`) :
        (currentLang === "te" ? `లగ్నంలో గ్రహాలు ఉన్నాయి (${(ls?.planets_in_lagna || []).join(", ")}).` : `Planets in Lagna: ${(ls?.planets_in_lagna || []).join(", ")}.`));

    // Tarabalam
    if (d.tara) {
      const taraTe = te(d.tara.name || "", TARA_NAMES_TE);
      bodyHtml += buildRuleCard(currentLang === "te" ? "8. తారాబలం" : "8. Tarabalam", d.tara?.is_pass,
        `${taraTe} — ${d.tara?.is_pass ? (currentLang === "te" ? "శుభ తార." : "Favorable.") : (currentLang === "te" ? "అశుభ తార." : "Inauspicious.")}`);
    }

    // Chandrabalam
    if (d.chandrabalam) {
      const cb = d.chandrabalam;
      const cbDesc = currentLang === "te" ? cb.desc_te : cb.desc_en;
      bodyHtml += buildRuleCard(currentLang === "te" ? "9. చంద్రబలం" : "9. Chandrabalam", cb.is_pass, cbDesc);
    }

    // Panchaka
    if (d.panchaka) {
      const pk = d.panchaka;
      const pkDesc = `${currentLang === "te" ? pk.name_te : pk.name_en} — ${currentLang === "te" ? pk.effect_te : pk.effect_en}`;
      bodyHtml += buildRuleCard(currentLang === "te" ? "10. పంచక శుద్ధి" : "10. Panchaka Check", pk.is_pass, pkDesc);
    }

    // Ashtama Lagna
    if (d.ashtama_lagna) {
      bodyHtml += buildRuleCard(currentLang === "te" ? "11. అష్టమ లగ్నం" : "11. Ashtama Lagna", !d.ashtama_lagna?.is_dosha,
        d.ashtama_lagna?.is_dosha ?
          (currentLang === "te" ? `అష్టమ లగ్న దోషం ఉంది!` : `Ashtama Lagna Dosha present!`) :
          (currentLang === "te" ? `అష్టమ లగ్న దోషం లేదు.` : `No Ashtama Lagna Dosha.`));
    }

    bodyHtml += `</div>`;
  }

  // 10. 21 Maha Doshas Evaluation
  if (d && d.maha_doshas && d.maha_doshas.length > 0) {
    const mahaScore = doshaTally(d.maha_doshas);
    bodyHtml += `
      <div class="dosha-panel dosha-panel--maha">
        <div class="dosha-panel__header dosha-panel__header--maha">
          <span>${Icon("flame")} ${currentLang === "te" ? "ఏకవింశతి మహాదోషముల విశ్లేషణ (21 Maha Doshas)" : "21 Maha Doshas Evaluation"}</span>
          <span class="dosha-panel__score dosha-panel__score--maha">${mahaScore}</span>
        </div>
        <div class="dosha-panel__body dosha-panel__body--maha">`;
    d.maha_doshas.forEach(m => {
      const mTitle = currentLang === "te" ? m.name_te : m.name_en;
      const mDesc = currentLang === "te" ? m.desc_te : m.desc_en;
      bodyHtml += doshaItemHTML(m, mTitle, mDesc, "maha");
    });
    bodyHtml += `</div></div>`;
  }

  // 11. 10 Dashavidha Doshas Evaluation
  if (d && d.dashavidha_doshas && d.dashavidha_doshas.length > 0) {
    const dashaScore = doshaTally(d.dashavidha_doshas);
    bodyHtml += `
      <div class="dosha-panel dosha-panel--dasha">
        <div class="dosha-panel__header dosha-panel__header--dasha">
          <span>${Icon("zap")} ${currentLang === "te" ? "దశవిధ దోషముల విశ్లేషణ (10 Dashavidha Doshas)" : "10 Dashavidha Doshas Evaluation"}</span>
          <span class="dosha-panel__score dosha-panel__score--dasha">${dashaScore}</span>
        </div>
        <div class="dosha-panel__body dosha-panel__body--dasha">`;
    d.dashavidha_doshas.forEach(m => {
      const mTitle = currentLang === "te" ? m.name_te : m.name_en;
      const mDesc = currentLang === "te" ? m.desc_te : m.desc_en;
      bodyHtml += doshaItemHTML(m, mTitle, mDesc, "dasha");
    });
    bodyHtml += `</div></div>`;
  }

  // 11b. This event's own chart rules that the window does not meet ("Show all" mode, 11 Nov 2026):
  // the window is listed, each rule is marked not matched, and the percentage is lower.
  const ruleMisses = (d?.extra_checks || []).filter(x => String(x.id || "").startsWith("rule_miss_"));
  if (ruleMisses.length > 0) {
    bodyHtml += `
      <div class="dosha-panel dosha-panel--dasha">
        <div class="dosha-panel__header dosha-panel__header--dasha">
          <span>${Icon("alert")} ${T("This event's rules not matched", "ఈ కార్యపు నియమాలు సరిపోలనివి")}</span>
          <span class="dosha-panel__score dosha-panel__score--dasha">${ruleMisses.length}</span>
        </div>
        <div class="dosha-panel__body dosha-panel__body--dasha">`;
    ruleMisses.forEach(m => {
      bodyHtml += doshaItemHTML(m, T("Not matched", "సరిపోలలేదు"), m.desc_en, "dasha");
    });
    bodyHtml += `</div></div>`;
  }

  // 12. Muhurta Dosha Pariharams (ముహూర్తములో దోషాలకు పరిహారములు)
  const pariharas = d?.pariharas;
  if (pariharas && pariharas.length > 0) {
    bodyHtml += `
      <div class="dosha-panel dosha-panel--pariharam">
        <div class="dosha-panel__header dosha-panel__header--pariharam">
          <span>${Icon("shield")} ${currentLang === "te" ? "ముహూర్తములో దోషాలకు పరిహారములు (Muhurta Dosha Remedies)" : "Muhurta Dosha Cancellation Remedies (Pariharams)"}</span>
          <span class="dosha-panel__score dosha-panel__score--pariharam">${pariharas.length} ${currentLang === "te" ? "పరిహారములు వర్తించును" : "Active Remedies"}</span>
        </div>
        <div class="dosha-panel__body dosha-panel__body--pariharam">`;
    pariharas.forEach(pr => {
      const prTitle = currentLang === "te" ? pr.name_te : pr.name_en;
      const prDesc = currentLang === "te" ? pr.desc_te : pr.desc_en;
      bodyHtml += `
        <div class="pariharam-item">
          <div class="pariharam-item__header">
            <strong class="pariharam-item__name">${Icon("sparkle")} ${prTitle}</strong>
            <span class="pariharam-item__badge">${pr.status}</span>
          </div>
          ${pr.shloka ? `<div class="pariharam-item__shloka">"${pr.shloka}"</div>` : ''}
          <div class="pariharam-item__desc">${prDesc}</div>
        </div>`;
    });
    bodyHtml += `</div></div>`;
  }

  // 13. Special Yogas
  if (r.special_yogas?.length > 0) {
    bodyHtml += `<div class="special-yogas-container">`;
    r.special_yogas.forEach(y => {
      const yName = currentLang === "te" ? y.name_te : y.name_en;
      const yDesc = currentLang === "te" ? y.desc_te : y.desc_en;
      let yogaClass = "yoga-item--good";
      if (y.type === "bad") { yogaClass = "yoga-item--bad"; }
      bodyHtml += `<div class="yoga-item yoga-item--compact ${yogaClass}">${Icon("sparkle")} ${yName} — <span class="yoga-item__desc">${yDesc}</span></div>`;
    });
    bodyHtml += `</div>`;
  }

  el("mfModalBody").innerHTML = bodyHtml;
  el("mfModal").style.display = "flex";
}

function buildRuleCard(title, pass, desc) {
  return `
    <div class="rule-card ${pass ? 'pass' : 'fail'}">
      <div class="rule-title"><span>${title}</span><span>${pass ? '✓' : '✕'}</span></div>
      <div class="rule-desc">${desc}</div>
    </div>`;
}

function closeModal() { el("mfModal").style.display = "none"; }

// ---- Init ----
el("startDate").valueAsDate = new Date();

el("findBtn").addEventListener("click", findMuhurtas);
el("mfSearchPlaceBtn").addEventListener("click", findMuhurtas);

// Region dropdown toggle + place autocomplete (shared components)
// The old region dropdown and custom-place field were replaced by the OpenStreetMap search below.

populateActivityDropdown();
el("mfPitruMode")?.addEventListener("change", updatePitruFields);
// Changing the minimum score redraws the cards already found; no new search is needed.
el("mfMinScore")?.addEventListener("change", () => { if (lastData && !lastToolSearch) renderResults(lastData); });

// Birth-place lists on the cards need the regions; redraw the cards once both have loaded.
Promise.all([loadRegions(), loadMuhurtaCatalog(), loadFamily()]).then(() => { updateContextualFields(); applyUrlPrefill(); });

// Links from the home page: ?activity=<id>&start=YYYY-MM-DD, or #yogas / #pitru for those tools.
function applyUrlPrefill() {
  const q = new URLSearchParams(window.location.search);
  const start = q.get("start");
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) el("startDate").value = start;
  const act = q.get("activity");
  const rule = act && allMuhurtaRules.find(r => r.id === act);
  if (rule) {
    onCategoryChange(rule.tab || rule.category);
    el("mfActivitySelect").value = rule.id;
    updateContextualFields();
  } else if (q.get("saved")) {
    openSavedSearch(q.get("saved"));
  } else if (window.location.hash === "#yogas") {
    onCategoryChange("yogas");
  } else if (window.location.hash === "#pitru") {
    onCategoryChange("pitru");
    if (!el("mfPitruTabCal")?.hidden) setPitruMode(true);
  }
}

// ---- PDF downloads (plan R8): the server prints what is on screen, with correct Telugu ----
let openDayIdx = null;

function eventTitle() {
  const rule = currentRule();
  return T(rule?.title_en || lastData?.title_en || "Muhurta", rule?.title_te || lastData?.title_te || "ముహూర్తం");
}

function placeName() {
  return chosenPlace ? chosenPlace.label : "";
}

function downloadDetailPdf(btn) {
  const r = lastData?.results?.[openDayIdx];
  PdfDownload.fromElement("mfModalBody", {
    kind: "muhurta",
    title: `${eventTitle()} · ${el("mfModalTitle").textContent.trim()}`,
    subtitle: placeName(),
    filename: PdfDownload.fileName(lastData?.activity_id, r?.date),
  }, btn);
}

function downloadListPdf(btn) {
  let kind = "results", title = `${eventTitle()} · ${T("muhurtas found", "లభించిన ముహూర్తాలు")}`;
  if (currentCategory === "yogas") {
    kind = "yogas"; title = T("Special yogas", "ప్రత్యేక యోగాలు");
  } else if (currentCategory === "pitru" && pitruCalendarOn) {
    const m = el("mfPitruMode");
    kind = "pitru"; title = `${T("Shraddha calendar", "శ్రాద్ధ తిథి నిర్ణయం")} · ${m ? m.options[m.selectedIndex].text : ""}`;
  }
  const box = document.createElement("div");
  const status = el("mfStatus")?.textContent.trim();
  if (status) { const p = document.createElement("p"); p.textContent = status; box.appendChild(p); }
  box.insertAdjacentHTML("beforeend", el("summaryBar").outerHTML + el("dayGrid").outerHTML);
  const start = el("startDate")?.value || "";
  PdfDownload.fromElement(box, {
    kind, title,
    subtitle: [placeName(), kind === "pitru" ? "" : start && T(`from ${start}`, `${start} నుండి`)].filter(Boolean).join(" · "),
    filename: PdfDownload.fileName(kind === "results" ? lastData?.activity_id : kind, start),
  }, btn);
}

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

// ---- Saved muhurtas (plan R3) ----
// Saves keep family profile ids and stars, never birth date, time or place (the server strips them too).
function requestForSaving() {
  if (!lastRequest || !lastData) return null;
  const req = JSON.parse(JSON.stringify(lastRequest));
  delete req.period_start_date;                       // health data is never saved (plan R6b)
  const resolved = lastData.participants || [];
  (req.participants || []).forEach(p => {
    const r = resolved.find(x => x.role === p.role) || {};
    ["janma_nak_idx", "janma_pada", "nama_nak_idx", "nama_pada", "rasi_idx", "lagna_idx"].forEach(k => {
      if (!p[k] && r[k]) p[k] = r[k];               // a star worked out from birth details is kept as the star
    });
  });
  return req;
}

const PITRU_MODE_NAMES = { annual: ["Yearly shraddha", "వార్షిక శ్రాద్ధం"], after_death: ["Rites after a death", "మరణానంతర కర్మలు"],
                           shannavati: ["96 shraddha days", "96 శ్రాద్ధ దినాలు"] };

// Special Yogas / Shraddha calendar results on screen (plan F2): what to save, and its name.
// A death date is personal, so it is saved only when the person says yes.
async function toolSearchForSaving() {
  const req = JSON.parse(JSON.stringify(lastToolSearch.request));
  if (lastToolSearch.kind === "yogas") {
    return { kind: "yogas", request: req,
             label: [T("Special yogas", "విశేష యోగాలు"), T(`from ${req.start_date}`, `${req.start_date} నుండి`), req.place_name].filter(Boolean).join(" · ") };
  }
  const m = PITRU_MODE_NAMES[req.mode] || [req.mode, req.mode];
  if (req.death_date && !(await AppShell.confirm(
        T("Also save the date and time of death? If you don't, you enter them again when you run this search.",
          "మరణ తేదీ, సమయం కూడా భద్రపరచాలా? వద్దంటే, మళ్లీ శోధించినప్పుడు మళ్లీ నమోదు చేయాలి."),
        { ok: T("Save them", "భద్రపరచు"), cancel: T("Don't save them", "భద్రపరచవద్దు") }))) {
    delete req.death_date;
    delete req.death_time;
  }
  return { kind: "pitru", request: req,
           label: [T(m[0], m[1]), req.mode === "shannavati" ? String(req.year) : "", req.place_name].filter(Boolean).join(" · ") };
}

async function saveSearch(btn, withWindow) {
  let kind = "muhurta", req, label, r = null;
  if (lastToolSearch && !withWindow) {
    ({ kind, request: req, label } = await toolSearchForSaving());
  } else {
    req = requestForSaving();
    if (!req) { AppShell.toast(T("Run a search first.", "ముందు శోధించండి."), "error"); return; }
    r = withWindow ? lastData?.results?.[openDayIdx] : null;
    label = [eventTitle(), r ? r.date + (r.window_start ? " " + String(r.window_start).slice(0, 5) : "") : T(`from ${req.start_date}`, `${req.start_date} నుండి`),
             req.place_name].filter(Boolean).join(" · ");
  }
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/me/saved`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, label: label.slice(0, 120), request: req, chosen_window: r || null }) });
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error((d && typeof d.detail === "string" && d.detail) || `HTTP ${res.status}`);
    AppShell.toast(T(`Saved as "${d.label}". Find it under My muhurtas.`, `"${d.label}" గా భద్రపరిచాము. 'నా ముహూర్తాలు'లో చూడండి.`), "success");
  } catch (e) { AppShell.toast(T("Couldn't save: ", "భద్రపరచలేకపోయాము: ") + e.message, "error"); }
  finally { btn.disabled = false; }
}

const SAVED_FIELD_IDS = { conception_date: "mfConceptionDate", veda_shakha: "mfVedaShakha", sutra: "mfSutra", varna: "mfVarna",
  door_facing: "mfDoorFacing", plot_facing: "mfPlotFacing", house_type: "mfHouseType", origin: "mfTravelOrigin", destination: "mfTravelDest",
  travel_direction: "mfTravelDir", travel_mode: "mfTravelMode", travel_purpose: "mfTravelPurpose", travel_exemption: "mfTravelExemption",
  business_name: "mfBusinessName", business_type: "mfBusinessType", entrance_facing: "mfEntranceFacing",
  vehicle_type: "mfVehicleType", vehicle_muhurta_type: "mfVehicleMuhurtaType" };

async function openSavedSearch(id) {
  try {
    const res = await fetch(`${API_BASE}/me/saved/${encodeURIComponent(id)}`);
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error((d && typeof d.detail === "string" && d.detail) || `HTTP ${res.status}`);
    const req = d.request || {};
    if (d.kind === "yogas" || d.kind === "pitru") return await openSavedToolSearch(d);
    const rule = allMuhurtaRules.find(x => x.id === req.activity_id);
    if (!rule) throw new Error(T("This muhurta is not available now.", "ఈ ముహూర్తం ఇప్పుడు అందుబాటులో లేదు."));
    (req.participants || []).forEach(p => {
      participantState[p.role] = { ...p, mode: "star", eldest: !!p.eldest };
    });
    onCategoryChange(rule.tab || rule.category);
    el("mfActivitySelect").value = rule.id;
    updateContextualFields();
    if (req.start_date) el("startDate").value = req.start_date;
    if (req.strictness && el("mfStrictness")) el("mfStrictness").value = req.strictness;
    document.querySelectorAll("#mfLunarMonths input").forEach(i => { i.checked = (req.lunar_months || []).includes(Number(i.value)); });
    if (req.time_preference && el("mfTimePref")) el("mfTimePref").value = req.time_preference;
    if (req.rule_variant && el("mfVariantSelect")) el("mfVariantSelect").value = req.rule_variant;
    if (req.lat != null && req.lon != null) setPlace({ label: req.place_name || "", lat: req.lat, lon: req.lon, tz_offset: req.tz_offset }, false);
    Object.entries(SAVED_FIELD_IDS).forEach(([k, fid]) => { if (req[k] && el(fid)) el(fid).value = req[k]; });
    if (req.main_event_date) ["mfMainEventDate", "mfDeathDate"].forEach(fid => { if (el(fid)) el(fid).value = req.main_event_date; });
    setStatus(T(`Opened "${d.label}".`, `"${d.label}" తెరిచాము.`) + (d.engine_changed ? " " + T("The app has been updated since you saved this, so results may differ.", "భద్రపరిచిన తర్వాత యాప్ నవీకరించబడింది; ఫలితాలు మారవచ్చు.") : ""));
    findMuhurtas();
  } catch (e) { setStatus(T("Couldn't open the saved muhurta: ", "భద్రపరిచిన ముహూర్తం తెరవలేకపోయాము: ") + e.message, true); }
}

// A saved Special Yogas or Shraddha calendar search (plan F2): fill its tab and run it again.
async function openSavedToolSearch(d) {
  const req = d.request || {};
  const opened = T(`Opened "${d.label}".`, `"${d.label}" తెరిచాము.`) +
    (d.engine_changed ? " " + T("The app has been updated since you saved this, so results may differ.", "భద్రపరిచిన తర్వాత యాప్ నవీకరించబడింది; ఫలితాలు మారవచ్చు.") : "");
  if (req.lat != null && req.lon != null) setPlace({ label: req.place_name || "", lat: req.lat, lon: req.lon, tz_offset: req.tz_offset }, false);
  if (d.kind === "yogas") {
    onCategoryChange("yogas");
    await renderYogaPanel();
    const tick = (box, ids) => document.querySelectorAll(`${box} input[type=checkbox]`).forEach(i => { i.checked = (ids || []).includes(i.value); });
    tick("#mfYogaList", req.yogas);
    tick("#mfCondList", req.conditions);
    if (el("mfYogaNak")) el("mfYogaNak").value = req.janma_nak_idx || "";
    if (el("mfYogaRasi")) el("mfYogaRasi").value = req.janma_rasi_idx || "";
    if (req.start_date) el("startDate").value = req.start_date;
    setStatus(opened);
    return findMuhurtas();
  }
  onCategoryChange("pitru");
  if (el("mfPitruTabCal")?.hidden) throw new Error(T("The shraddha calendar is not available now.", "శ్రాద్ధ పంచాంగం ఇప్పుడు అందుబాటులో లేదు."));
  setPitruMode(true);
  el("mfPitruMode").value = req.mode;
  updatePitruFields();
  el("mfPitruDeathDate").value = req.death_date || "";
  el("mfPitruDeathTime").value = req.death_time || "";
  if (req.years) el("mfPitruYears").value = req.years;
  if (req.year) el("mfPitruYear").value = req.year;
  if (req.mode !== "shannavati" && !req.death_date) {
    setStatus(opened + " " + T("The date of death was not saved: enter it and press Search.", "మరణ తేదీ భద్రపరచలేదు: నమోదు చేసి శోధించండి."));
    el("mfPitruDeathDate").focus();
    return;
  }
  setStatus(opened);
  return findMuhurtas();
}

// ---- Dosha audit banner (plan B1): "0 of 21 mahadoshas · 0 of 10 dashavidha doshas" ----
// Green: nothing failed. Amber: a dosha the author's rule excepts (Jupiter in the lagna) or a lesser
// dosha. Red: a mahadosha did not match (listed with a lower percentage; hidden in Strict mode).
function auditBannerHTML(a, compact) {
  if (!a) return "";
  const m = a.mahadosha || {}, d = a.dashavidha || {};
  const parts = [];
  if (m.checked) parts.push(T(`${m.failed} of 21 mahadoshas`, `21 మహాదోషాల్లో ${m.failed}`));
  if (d.checked) parts.push(T(`${d.failed} of 10 dashavidha doshas`, `10 దశవిధ దోషాల్లో ${d.failed}`));
  // Red: which mahadosha(s) did not match. The window is still listed, with a lower percentage (11 Nov 2026).
  const failedNames = T((a.maha_failed_en || []).join(", "), (a.maha_failed_te || []).join(", "));
  const head = { green: T("Clean", "శుద్ధం"), amber: T("Clean with exception", "మినహాయింపుతో శుద్ధం"),
                 red: T("Mahadosha not matched", "మహాదోషం సరిపోలేదు") + (failedNames ? ": " + failedNames : "") }[a.colour] || "";
  const exc = (a.excepted || []).length && !compact
    ? `<div class="audit-banner__note">${escapeHtml(T("Excepted because Jupiter is in the muhurta lagna: ", "ముహూర్త లగ్నంలో గురుడు ఉన్నందున మినహాయింపు: ") + a.excepted.join(", "))}</div>` : "";
  const tc = (a.to_confirm || []).length && !compact
    ? `<div class="audit-banner__note">${escapeHtml(T("Shown, not blocking, until Dr. Nemani confirms: ", "డా. నేమాని గారు నిర్ధారించే వరకు చూపిస్తాము, నిరోధించము: ") + a.to_confirm.join(", "))}</div>` : "";
  const ne = (m.not_evaluated || 0) + (d.not_evaluated || 0);
  const neNote = ne && !compact ? `<div class="audit-banner__note">${escapeHtml(T(`${ne} check(s) could not be made with the details given.`, `ఇచ్చిన వివరాలతో ${ne} పరిశీలనలు చేయలేకపోయాము.`))}</div>` : "";
  return `<div class="audit-banner audit-banner--${escapeHtml(a.colour)}${compact ? " audit-banner--compact" : ""}" role="note">
    <strong>${escapeHtml(head)}</strong>${parts.length ? ` · ${escapeHtml(parts.join(" · "))}` : ""}${exc}${tc}${neNote}</div>`;
}

// ---- Location: OpenStreetMap search, filled with the user's current town (9 Nov 2026) ----
// The browser asks once for location; the server turns it into the town (rounded to ~1 km) and its
// time zone. A place the user picks by hand is remembered on this device. If location is refused,
// the home place from My account is used, else Hyderabad.
var chosenPlace = null;
const PLACE_KEY = "mh_finder_place";
function setPlace(p, remember) {
  chosenPlace = { label: p.label, lat: Number(p.lat), lon: Number(p.lon), tz_offset: Number(p.tz_offset) };
  el("mfPlaceInput").value = p.label;
  el("mfPlaceNote").textContent = T(`Times for ${p.label} (UTC${p.tz_offset >= 0 ? "+" : ""}${p.tz_offset})`, `${p.label} సమయాలు (UTC${p.tz_offset >= 0 ? "+" : ""}${p.tz_offset})`);
  if (remember) { try { localStorage.setItem(PLACE_KEY, JSON.stringify(chosenPlace)); } catch (e) { /* private mode */ } }
}
async function fallbackPlace(why) {
  try {
    const me = await (await fetch(`${API_BASE}/me`)).json();
    if (me && me.home && me.home.lat != null) { setPlace({ label: me.home.name, lat: me.home.lat, lon: me.home.lon, tz_offset: me.home.tz }, false); }
  } catch (e) { /* use Hyderabad below */ }
  if (!chosenPlace) setPlace({ label: "Hyderabad, Telangana", lat: 17.385, lon: 78.4867, tz_offset: 5.5 }, false);
  if (why) el("mfPlaceNote").textContent += " · " + why;
}
function useMyLocation() {
  if (!navigator.geolocation) return fallbackPlace(T("Location isn't available in this browser; search for the place.", "ఈ బ్రౌజర్‌లో స్థానం అందుబాటులో లేదు; ప్రాంతం వెతకండి."));
  el("mfPlaceNote").textContent = T("Finding your town…", "మీ ఊరు కనుగొంటున్నాం…");
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const res = await fetch(`${API_BASE}/geocode/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error((d && d.detail) || `HTTP ${res.status}`);
      setPlace(d, false);
    } catch (e) { fallbackPlace(e.message); }
  }, () => fallbackPlace(T("Location not shared; search for the place.", "స్థానం పంచుకోలేదు; ప్రాంతం వెతకండి.")),
  { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}
(function initPlaceSearch() {
  const input = el("mfPlaceInput"), list = el("mfPlaceList");
  if (!input) return;
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) { list.hidden = true; list.innerHTML = ""; return; }
    timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/geocode/suggestions?q=${encodeURIComponent(q)}`);
        const items = res.ok ? await res.json() : [];
        list.innerHTML = items.length ? "" : `<div class="suggestion-item suggestion-item--empty">${escapeHtml(T("No town found. Try just the town name.", "ఊరు దొరకలేదు. ఊరి పేరు మాత్రమే ఇచ్చి చూడండి."))}</div>`;
        items.forEach(it => {
          const div = document.createElement("div");
          div.className = "suggestion-item"; div.setAttribute("role", "option"); div.textContent = it.label;
          div.addEventListener("click", () => { setPlace(it, true); list.hidden = true; });
          list.appendChild(div);
        });
        list.hidden = false;
      } catch (e) { console.warn("Place search failed:", e.message); }
    }, 400);                       // OpenStreetMap asks for no more than about one search a second
  });
  document.addEventListener("click", e => { if (e.target !== input && !list.contains(e.target)) list.hidden = true; });
  el("mfUseMyLocation").addEventListener("click", () => { try { localStorage.removeItem(PLACE_KEY); } catch (e) {} useMyLocation(); });
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(PLACE_KEY) || "null"); } catch (e) { saved = null; }
  if (saved && saved.lat != null) setPlace(saved, false); else useMyLocation();
})();

