// ============================================================
// Muhurtham App · Muhurta Finder component: Name maps for charts and taras, category tabs and the event catalog.
// Split from finder.js (21 Nov 2026). Plain script: the page loads the finder-*.js files in order
// (see muhurta-finder.html); they share one global scope, and finder-init.js runs last.
// requires: js/config.js, js/i18n.js, js/regions.js, js/stars.js
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
