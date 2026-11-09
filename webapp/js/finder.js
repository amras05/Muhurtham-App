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
  const levelNote = spec.level === "L1"
    ? T("Required", "తప్పనిసరి")
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
  <details class="person-card" data-role="${role}" data-mode="${mode}" data-needs-dob="${needsDob}" ${spec.level === "L1" || idx === 0 || st.open ? "open" : ""}>
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
  const notes = [...(data.warnings || []), ...(data.notes || [])];
  setStatus([head, ...notes].filter(Boolean).join(" "));
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
    start_date: loc.startDate, days_to_scan: Math.min(loc.days, 60), lat: loc.lat, lon: loc.lon,
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
  } catch (e) {
    console.error("Yoga search failed:", e);
    setStatus(T(`Search failed: ${e.message}`, `శోధన విఫలమైంది: ${e.message}`), true);
  } finally {
    el("findBtn").disabled = false;
  }
}

function renderYogaResults(data) {
  const warn = (data.warnings || []).length ? ` ${T("Note:", "గమనిక:")} ${data.warnings.join("; ")}` : "";
  setStatus(T(`${data.total} window(s) in ${data.days_scanned} days.`, `${data.days_scanned} రోజుల్లో ${data.total} సమయాలు.`) + warn);
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

// ---- Main Search ----
let lastData = null;
let lastRequest = null;   // the payload of the last search, for "Save" (plan R3)

async function findMuhurtas() {
  const regionId = el("mfRegionSelect").value;
  const startDate = el("startDate").value;
  const days = parseInt(el("daysInput").value) || 30;

  if (!regionId || !startDate) {
    setStatus(currentLang === "te" ? "దయచేసి తేదీ మరియు ప్రాంతం ఎంచుకోండి." : "Pick a start date and location first.", true);
    return;
  }

  let lat, lon, tz_offset, place_name;
  if (regionId === "custom") {
    const query = el("mfCustomPlaceInput").value.trim();
    if (!query) {
      setStatus(currentLang === "te" ? "ప్రాంతం పేరు నమోదు చేయండి." : "Please enter a place name.", true);
      return;
    }
    setStatus("Geocoding...");
    try {
      const geoRes = await fetch(`${API_BASE}/geocode?place=${encodeURIComponent(query)}`);
      if (!geoRes.ok) throw new Error(await geoRes.text() || `HTTP ${geoRes.status}`);
      const geo = await geoRes.json();
      lat = geo.lat; lon = geo.lon; tz_offset = geo.tz_offset; place_name = geo.label;
    } catch (e) {
      setStatus(`Geocoding error: ${e.message}`, true);
      return;
    }
  } else {
    const r = allRegions.find(x => x.id === regionId);
    if (!r) { setStatus("Region not found.", true); return; }
    lat = r.lat; lon = r.lon; tz_offset = r.tz_offset; place_name = r.label;
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
      strictness: el("mfStrictness")?.value || "strict",
      rule_variant: el("mfVariantSelect")?.value || null,
      time_preference: el("mfTimePref")?.value || "any",
      participants: collectParticipants(),
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
    lastData = data;

    setTimeout(() => {
      el("progressSection").style.display = "none";
      renderResults(data);
      setStatus((data.warnings || []).join(" · "));
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
    <h4 class="detail-card__title">👥 ${T("Strength for each person", "ప్రతి వ్యక్తికి బలం")}</h4>
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
    <h4 class="detail-card__title">🏛️ ${T("Lagna and planet strength", "లగ్నం · గ్రహ బలం")}</h4>
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
    ? `${n("pass")} శుద్ధం · ${n("fail")} దోషం · ${n("not_evaluated")} పరిశీలించలేదు`
    : `${n("pass")} clear · ${n("fail")} dosha · ${n("not_evaluated")} not evaluated`;
}

function doshaItemHTML(m, title, desc, kind) {
  const status = doshaStatus(m);
  const itemCls = status === "fail" ? `dosha-item--fail-${kind}` : status === "pass" ? "dosha-item--pass" : "dosha-item--muted";
  const badgeCls = status === "fail" ? "dosha-item__badge--fail" : status === "pass" ? "dosha-item__badge--pass" : "dosha-item__badge--muted";
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

  // Summary
  const excellent = results.filter(r => (r.percentage || 0) >= 75 || r.verdict === "highly_favorable" || r.verdict === "ఉత్తమ ముహూర్తం").length;
  const favorable = results.filter(r => (r.percentage || 0) >= 50 && (r.percentage || 0) < 75 || r.verdict === "favorable" || r.verdict === "మధ్యమ ముహూర్తం").length;
  const unfavorable = results.filter(r => (r.percentage || 0) < 50 || r.verdict === "unfavorable" || r.verdict === "నిషిద్ధం").length;
  const withMuhurta = results.filter(r => r.pushkara_info && r.pushkara_info.is_available).length;

  el("summaryBar").innerHTML = `
    <div class="summary-stat">
      <div class="num num--excellent">${excellent}</div>
      <div class="label" data-en="Excellent" data-te="ఉత్తమ ముహూర్తములు">${currentLang === "te" ? "ఉత్తమ ముహూర్తములు" : "Excellent"}</div>
    </div>
    <div class="summary-stat">
      <div class="num num--favorable">${favorable}</div>
      <div class="label" data-en="Medium" data-te="మధ్యమ ముహూర్తములు">${currentLang === "te" ? "మధ్యమ ముహూర్తములు" : "Medium"}</div>
    </div>
    <div class="summary-stat">
      <div class="num num--unfavorable">${unfavorable}</div>
      <div class="label" data-en="Avoid" data-te="నిషిద్ధములు">${currentLang === "te" ? "నిషిద్ధములు" : "Avoid"}</div>
    </div>
    <div class="summary-stat">
      <div class="num num--muhurta">${results.length}</div>
      <div class="label" data-en="Total Evaluated" data-te="మొత్తం ముహూర్తములు">${currentLang === "te" ? "మొత్తం ముహూర్తములు" : "Total Evaluated"}</div>
    </div>
  `;

  // Day cards
  const grid = el("dayGrid");
  grid.innerHTML = "";

  if (results.length === 0) {
    const reasons = (data.rejection_summary || []).slice(0, 5)
      .map(x => `<li>${escapeHtml(x.reason)} <span class="reject-count">× ${x.count}</span></li>`).join("");
    const strictNote = data.strictness === "strict"
      ? (currentLang === "te"
        ? "కఠిన నియమంలో మహాదోషం ఉన్న సమయాలు తొలగించబడ్డాయి. 'సడలింపు' ఎంచుకుంటే అవి హెచ్చరికతో కనిపిస్తాయి."
        : "Strict mode drops windows with a fatal mahadosha. Choose Lenient to see them with warnings.")
      : "";
    grid.innerHTML = `
      <div class="empty-state">
        <p>${currentLang === "te"
          ? `ఎంచుకున్న ${data.days_scanned || 30} రోజులలో ఈ కార్యానికి శాస్త్రోక్త ముహూర్తం లభించలేదు. రోజుల సంఖ్య పెంచి మళ్ళీ ప్రయత్నించండి.`
          : `No muhurta passed the book's rules in the ${data.days_scanned || 30} days scanned. Try a longer range.`}</p>
        ${reasons ? `<p class="empty-state__label">${currentLang === "te" ? "ఎక్కువగా తిరస్కరించిన కారణాలు:" : "Most common reasons windows were rejected:"}</p><ul class="empty-state__reasons">${reasons}</ul>` : ""}
        ${strictNote ? `<p class="empty-state__note">${strictNote}</p>` : ""}
      </div>`;
    return;
  }

  results.forEach((r, idx) => {
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
          <strong>⏰ ${stmt}</strong>
          <div class="pushkara-mini__details" style="font-size: 12px; margin-top: 4px; color: #555;">
            ${windowTimeStr ? `🏛️ <strong>${currentLang === "te" ? "శుభ ముహూర్త వ్యవధి:" : "Muhurtha Window:"}</strong> ${windowTimeStr} (${lagnaLabel} లగ్నం)` : ""}
            ${pi.pushkara_bhaga?.is_available ? `<br>📌 <strong>${currentLang === "te" ? "పుష్కర భాగం:" : "P. Bhaga:"}</strong> ${pi.pushkara_bhaga.precise_time} (${pi.pushkara_bhaga.time_window})` : ""}
            ${pi.pushkara_navamsha?.is_available ? `<br>📌 <strong>${currentLang === "te" ? "పుష్కర నవాంశ:" : "P. Navamsha:"}</strong> ${pi.pushkara_navamsha.precise_time}` : ""}
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
      yogasHtml = `<div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">${r.special_yogas.map(y => `<span class="rule-chip" style="background:#fef7e0; color:#b06000; font-size:11px;">✨ ${currentLang === 'te' ? y.name_te : y.name_en}</span>`).join("")}</div>`;
    }

    grid.innerHTML += `
      <div class="day-card ${verdictClass}" onclick="openDayModal(${idx})" style="cursor: pointer; margin-bottom: 16px;">
        <div class="day-header">
          <div>
            <div class="day-date" style="font-size: 16px; font-weight: 700;">${r.date} · ${vaaraTe}</div>
            <div class="day-vaara" style="font-size: 13px; color: #777;">
              ${r.panchang?.chandramana ? `🪔 ${r.panchang.chandramana.month_name || ''} · ${tithiTe}` : tithiTe} · ${nakTe}
            </div>
          </div>
          <div class="day-right">
            <span class="verdict-badge ${verdictClass}">${pct}% · ${verdictText}</span>
          </div>
        </div>
        ${pushMini}
        ${dotsHtml}
        ${yogasHtml}
        ${reasonsHtml}
        <div style="margin-top: 12px; text-align: right;">
          <button type="button" onclick="event.stopPropagation(); openDayModal(${idx})" class="btn btn--primary btn--sm" style="font-size: 12px; padding: 6px 14px;">
            🔍 ${currentLang === "te" ? "సమగ్ర విశ్లేషణ & D1 చక్రం చూడండి ➔" : "View Full Analysis & D1 Chart Popup ➔"}
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
        `📌 <strong>పుష్కర భాగ ముహూర్తం:</strong> ${pi.pushkara_bhaga.precise_time} (వ్యవధి: ${pi.pushkara_bhaga.time_window})` :
        `📌 <strong>Pushkara Bhaga:</strong> ${pi.pushkara_bhaga.precise_time} (Window: ${pi.pushkara_bhaga.time_window})`);
    }
    if (pi.pushkara_navamsha?.is_available) {
      subDetails.push(currentLang === "te" ?
        `📌 <strong>పుష్కర నవాంశ ముహూర్తం:</strong> ${pi.pushkara_navamsha.precise_time} (వ్యవధి: ${pi.pushkara_navamsha.time_window})` :
        `📌 <strong>Pushkara Navamsha:</strong> ${pi.pushkara_navamsha.precise_time} (Window: ${pi.pushkara_navamsha.time_window})`);
    }
    if (subDetails.length === 0) {
      subDetails.push(`📌 <strong>${currentLang === "te" ? "సమయ వ్యవధి:" : "Window:"}</strong> ${pi.time_window}`);
    }

    bodyHtml += `
      <div class="rec-time-box">
        <h4 class="rec-time-box__title">☀️ ${currentLang === "te" ? "శుభ ముహూర్త సమయ నిర్ణయం" : "Recommended Time Prediction"}</h4>
        <div class="rec-time-box__time">⏰ ${stmt}</div>
        <div class="rec-time-box__details">
          ${subDetails.join("<br>")}
        </div>
        ${avoidNote ? `<div class="rec-time-box__note">⚠️ ${currentLang === "te" ? "గమనిక:" : "Note:"} ${avoidNote}</div>` : ''}
      </div>`;
  }

  const det = r.detail;
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
          <strong class="native-profile-box__title">👤 ${currentLang === "te" ? "వ్యక్తిగత సమాచారం & గోచారం (Native & Transit)" : "Native Profile & Transit Details"}</strong>
          ${cb ? `<span class="native-profile-box__badge ${cbBadgeClass}">🌙 ${currentLang === "te" ? "చంద్రబలం:" : "Chandrabalam:"} ${cb.house ? cb.house + 'వ ఇల్లు' : 'అనుకూలం'}</span>` : ''}
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
        <span class="cm-banner__sam">🪔 ${samName}</span>
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
      <h4 class="detail-card__title">📌 ${currentLang === "te" ? "పంచాంగ వివరాలు" : "Panchang Details"}</h4>
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
          <span>${isAbhijitAuspicious ? '✨' : '⚠️'}</span>
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
            ☸️ ${currentLang === "te" ? "పంచక రహిత విశ్లేషణ (Panchaka Rahitam)" : "Panchaka Rahitam Analysis"}
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
              <strong>🌿 ${currentLang === "te" ? "శాస్త్రోక్త పరిహారం:" : "Classical Remedy:"}</strong> ${panPariharam}
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
          <span>⏳ ${currentLang === "te" ? "రోజు మొత్తంలో కాల విభజన (పంచధా కాల విభజన)" : "Daily 5-Fold Time Division (Kala Vibhajana)"}</span>
          <span class="kv-header__sub">${currentLang === "te" ? "పగలు 5 భాగాలు + రాత్రి పవిత్ర కాలాలు" : "5 Day divisions + Night Sacred Periods"}</span>
        </h4>
        <div class="kv-grid">
          <div class="kv-card">
            <div class="kv-card__name kv-card__name--pratah">🌅 ${currentLang === "te" ? kv.pratah_kalam?.name_te : kv.pratah_kalam?.name_en}</div>
            <div class="kv-card__time">${kv.pratah_kalam?.start} – ${kv.pratah_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.pratah_kalam?.desc_te : kv.pratah_kalam?.desc_en}</div>
          </div>
          <div class="kv-card">
            <div class="kv-card__name kv-card__name--sangava">🌾 ${currentLang === "te" ? kv.sangava_kalam?.name_te : kv.sangava_kalam?.name_en}</div>
            <div class="kv-card__time">${kv.sangava_kalam?.start} – ${kv.sangava_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.sangava_kalam?.desc_te : kv.sangava_kalam?.desc_en}</div>
          </div>
          <div class="kv-card kv-card--highlight">
            <div class="kv-card__name kv-card__name--madhya">☀️ ${currentLang === "te" ? kv.madhyahnika_kalam?.name_te : kv.madhyahnika_kalam?.name_en} <span class="kv-tag">అభిజిత్</span></div>
            <div class="kv-card__time">${kv.madhyahnika_kalam?.start} – ${kv.madhyahnika_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.madhyahnika_kalam?.desc_te : kv.madhyahnika_kalam?.desc_en}</div>
          </div>
          <div class="kv-card">
            <div class="kv-card__name kv-card__name--aparahna">⛅ ${currentLang === "te" ? kv.aparahna_kalam?.name_te : kv.aparahna_kalam?.name_en}</div>
            <div class="kv-card__time">${kv.aparahna_kalam?.start} – ${kv.aparahna_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.aparahna_kalam?.desc_te : kv.aparahna_kalam?.desc_en}</div>
          </div>
          <div class="kv-card">
            <div class="kv-card__name kv-card__name--sayahna">🌇 ${currentLang === "te" ? kv.sayahna_kalam?.name_te : kv.sayahna_kalam?.name_en}</div>
            <div class="kv-card__time">${kv.sayahna_kalam?.start} – ${kv.sayahna_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.sayahna_kalam?.desc_te : kv.sayahna_kalam?.desc_en}</div>
          </div>
          <div class="kv-card kv-card--sacred">
            <div class="kv-card__name kv-card__name--sacred">🕉️ ${currentLang === "te" ? "రాత్రి విశేష కాలములు" : "Night Sacred Timings"}</div>
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
          <span>🏛️ ${currentLang === "te" ? "ప్రతి లగ్న అంతము (సూర్యోదయం నుండి 12 లగ్నాలు)" : "Daily Lagna Schedule (Lagna Antyalu - All 12 Signs)"}</span>
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
      <h4 class="inauspicious-card__title">⏳ ${currentLang === "te" ? "అశుభ సమయములు" : "Inauspicious Timings"}</h4>
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
      <h4 class="chart-card__title">📊 ${currentLang === "te" ? `ముహూర్త D1 చక్రం (${r.date})` : `Muhurta D1 Chart (${r.date})`}</h4>
      ${buildD1ChartHTML(r.d1_chart, chartLabel)}
    </div>`;

  // 9. Rule Evaluation Grid
  if (d) {
    bodyHtml += `<h4 class="rules-eval-title">📜 ${currentLang === "te" ? "ముహూర్త నియమ విశ్లేషణ" : "Muhurta Rules Evaluation"}</h4>`;
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
          <span>🔥 ${currentLang === "te" ? "ఏకవింశతి మహాదోషముల విశ్లేషణ (21 Maha Doshas)" : "21 Maha Doshas Evaluation"}</span>
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
          <span>⚡ ${currentLang === "te" ? "దశవిధ దోషముల విశ్లేషణ (10 Dashavidha Doshas)" : "10 Dashavidha Doshas Evaluation"}</span>
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

  // 12. Muhurta Dosha Pariharams (ముహూర్తములో దోషాలకు పరిహారములు)
  const pariharas = d?.pariharas;
  if (pariharas && pariharas.length > 0) {
    bodyHtml += `
      <div class="dosha-panel dosha-panel--pariharam">
        <div class="dosha-panel__header dosha-panel__header--pariharam">
          <span>🛡️ ${currentLang === "te" ? "ముహూర్తములో దోషాలకు పరిహారములు (Muhurta Dosha Remedies)" : "Muhurta Dosha Cancellation Remedies (Pariharams)"}</span>
          <span class="dosha-panel__score dosha-panel__score--pariharam">${pariharas.length} ${currentLang === "te" ? "పరిహారములు వర్తించును" : "Active Remedies"}</span>
        </div>
        <div class="dosha-panel__body dosha-panel__body--pariharam">`;
    pariharas.forEach(pr => {
      const prTitle = currentLang === "te" ? pr.name_te : pr.name_en;
      const prDesc = currentLang === "te" ? pr.desc_te : pr.desc_en;
      bodyHtml += `
        <div class="pariharam-item">
          <div class="pariharam-item__header">
            <strong class="pariharam-item__name">✨ ${prTitle}</strong>
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
      bodyHtml += `<div class="yoga-item yoga-item--compact ${yogaClass}">✨ ${yName} — <span class="yoga-item__desc">${yDesc}</span></div>`;
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
attachRegionToggle("mfRegionSelect", "mfCustomPlaceField", "mfCustomPlaceInput");
attachPlaceAutocomplete("mfCustomPlaceInput", "mfSuggestionsList", findMuhurtas);

populateActivityDropdown();
el("mfPitruMode")?.addEventListener("change", updatePitruFields);

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
  const sel = el("mfRegionSelect");
  return sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
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
    alert(T("Pick people from \"From my family\" on the cards first; the event is saved for them.",
            "ముందు కార్డులపై 'నా కుటుంబం నుండి' వ్యక్తులను ఎంచుకోండి; కార్యక్రమం వారికి భద్రపరుస్తాం."));
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
    alert(T(`Saved as a planned event for ${picked.map(p => p.name).join(" and ")}. See My family.`,
            `${picked.map(p => p.name).join(", ")} కు నిర్ణయించిన కార్యక్రమంగా భద్రపరిచాము. 'నా కుటుంబం'లో చూడండి.`));
  } catch (e) {
    alert(T("Couldn't save the event: ", "కార్యక్రమం భద్రపరచలేకపోయాము: ") + e.message);
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

async function saveSearch(btn, withWindow) {
  const req = requestForSaving();
  if (!req) { alert(T("Run a search first.", "ముందు శోధించండి.")); return; }
  const r = withWindow ? lastData?.results?.[openDayIdx] : null;
  const label = [eventTitle(), r ? r.date + (r.window_start ? " " + String(r.window_start).slice(0, 5) : "") : T(`from ${req.start_date}`, `${req.start_date} నుండి`),
                 req.place_name].filter(Boolean).join(" · ");
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/me/saved`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "muhurta", label: label.slice(0, 120), request: req, chosen_window: r || null }) });
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error((d && typeof d.detail === "string" && d.detail) || `HTTP ${res.status}`);
    alert(T(`Saved as "${d.label}". Find it under My muhurtas.`, `"${d.label}" గా భద్రపరిచాము. 'నా ముహూర్తాలు'లో చూడండి.`));
  } catch (e) { alert(T("Couldn't save: ", "భద్రపరచలేకపోయాము: ") + e.message); }
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
    const rule = allMuhurtaRules.find(x => x.id === req.activity_id);
    if (!rule) throw new Error(T("This muhurta is not available now.", "ఈ ముహూర్తం ఇప్పుడు అందుబాటులో లేదు."));
    (req.participants || []).forEach(p => {
      participantState[p.role] = { ...p, mode: "star", eldest: !!p.eldest };
    });
    onCategoryChange(rule.tab || rule.category);
    el("mfActivitySelect").value = rule.id;
    updateContextualFields();
    if (req.start_date) el("startDate").value = req.start_date;
    if (req.days_to_scan) el("daysInput").value = req.days_to_scan;
    if (req.strictness && el("mfStrictness")) el("mfStrictness").value = req.strictness;
    if (req.time_preference && el("mfTimePref")) el("mfTimePref").value = req.time_preference;
    if (req.rule_variant && el("mfVariantSelect")) el("mfVariantSelect").value = req.rule_variant;
    const reg = allRegions.find(x => Math.abs(x.lat - req.lat) < 1e-4 && Math.abs(x.lon - req.lon) < 1e-4);
    if (reg) el("mfRegionSelect").value = reg.id;
    else if (el("mfCustomPlaceInput")) { el("mfRegionSelect").value = "custom"; el("mfRegionSelect").dispatchEvent(new Event("change")); el("mfCustomPlaceInput").value = req.place_name || ""; }
    Object.entries(SAVED_FIELD_IDS).forEach(([k, fid]) => { if (req[k] && el(fid)) el(fid).value = req[k]; });
    if (req.main_event_date) ["mfMainEventDate", "mfDeathDate"].forEach(fid => { if (el(fid)) el(fid).value = req.main_event_date; });
    setStatus(T(`Opened "${d.label}".`, `"${d.label}" తెరిచాము.`) + (d.engine_changed ? " " + T("The app has been updated since you saved this, so results may differ.", "భద్రపరిచిన తర్వాత యాప్ నవీకరించబడింది; ఫలితాలు మారవచ్చు.") : ""));
    findMuhurtas();
  } catch (e) { setStatus(T("Couldn't open the saved muhurta: ", "భద్రపరిచిన ముహూర్తం తెరవలేకపోయాము: ") + e.message, true); }
}

