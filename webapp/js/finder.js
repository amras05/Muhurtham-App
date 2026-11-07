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

// ---- Declarative 3-Layer Muhurtha Catalog ----
let birthVisible = false;
let progressInterval = null;

const FALLBACK_MUHURTA_RULES = [
  {"id": "adoption", "category": "general", "title_en": "Child Adoption", "title_te": "దత్తత స్వీకారము"},
  {"id": "borrowing_money", "category": "general", "title_en": "Borrowing Money / Taking Loans", "title_te": "రుణం గ్రహించుట (అప్పు చేయుట)"},
  {"id": "business_start", "category": "general", "title_en": "Business Opening & Commercial Start", "title_te": "నూతన వ్యాపారారంభము"},
  {"id": "buying_vehicles", "category": "general", "title_en": "Buying Vehicles (Vahana Kraya)", "title_te": "నూతన వాహన కొనుగోలు"},
  {"id": "contracts_agreements", "category": "general", "title_en": "Contracts & Agreements Signing", "title_te": "ఒప్పందములు / దస్తావేజులు"},
  {"id": "first_bath_after_illness", "category": "general", "title_en": "First Bath After Illness", "title_te": "వ్యాధి తగ్గిన తరువాత మొదటి స్నానము"},
  {"id": "haircut", "category": "general", "title_en": "Haircut & Shaving (Kshaura Karma)", "title_te": "క్షురకర్మ / కేశఖండనము"},
  {"id": "idol_consecration", "category": "general", "title_en": "Idol Consecration (Vigraha Pratishtha)", "title_te": "విగ్రహ ప్రతిష్ఠ"},
  {"id": "inheritance_division", "category": "general", "title_en": "Division of Inherited Property", "title_te": "వారసత్వ ఆస్తుల పంపకము"},
  {"id": "lending_money", "category": "general", "title_en": "Lending Money", "title_te": "రుణం ఇచ్చుట"},
  {"id": "mantra_siddhi", "category": "general", "title_en": "Mantra Initiation & Practice", "title_te": "మంత్రోపదేశము / మంత్రసిద్ధి"},
  {"id": "medicine", "category": "general", "title_en": "Taking Medicine & Treatment", "title_te": "ఔషధ సేవన (చికిత్సారంభము)"},
  {"id": "new_clothes_jewelry", "category": "general", "title_en": "Wearing New Clothes & Jewelry", "title_te": "నూతన వస్త్ర / ఆభరణ ధారణము"},
  {"id": "sowing_seeds", "category": "general", "title_en": "Sowing Seeds & Agriculture", "title_te": "విత్తనములు జల్లుట / వ్యవసాయారంభము"},
  {"id": "surgery", "category": "general", "title_en": "Surgical Operation", "title_te": "శస్త్రచికిత్స (ఆపరేషన్)"},
  {"id": "will_writing", "category": "general", "title_en": "Writing a Legal Will", "title_te": "వీలునామా రచన"},
  {"id": "door_placement", "category": "griha", "title_en": "Main Door Frame Installation (Dwara Sthapana)", "title_te": "సింహద్వార బంధ స్థాపన"},
  {"id": "griha_pravesha", "category": "griha", "title_en": "Griha Pravesha (House Warming - New House)", "title_te": "నూతన గృహప్రవేశము"},
  {"id": "rented_entry", "category": "griha", "title_en": "Entering a Rented House", "title_te": "అద్దె ఇల్లు ప్రవేశము"},
  {"id": "sankusthapana", "category": "griha", "title_en": "Sankusthapana (Foundation Stone Laying)", "title_te": "శంకుస్థాపన (గృహారంభము)"},
  {"id": "aksharabhyasa", "category": "samskaras", "title_en": "Aksharabhyasa (Vidyarambha)", "title_te": "అక్షరాభ్యాసము (విద్యారంభము)"},
  {"id": "annaprashana", "category": "samskaras", "title_en": "Annaprashana (First Feeding)", "title_te": "అన్నప్రాశన సంస్కారము"},
  {"id": "namakarana", "category": "samskaras", "title_en": "Namakarana (Naming Ceremony)", "title_te": "నామకరణ మహోత్సవము"},
  {"id": "upanayana", "category": "samskaras", "title_en": "Upanayana (Sacred Thread Ceremony)", "title_te": "ఉపనయనము (వటువు బ్రహ్మోపదేశము)"},
  {"id": "prayana", "category": "travel", "title_en": "Prayana (Travel & Journey)", "title_te": "ప్రయాణము (దేశాంతర గమనము)"},
  {"id": "invitation_printing", "category": "vivaha", "title_en": "Lagna Patrika & Invitation Printing", "title_te": "లగ్నపత్రిక రచన / శుభలేఖల ముద్రణ"},
  {"id": "nisheka", "category": "vivaha", "title_en": "Nisheka (First Night / Consummation)", "title_te": "నిశేకము (ప్రథమ రాత్రి)"},
  {"id": "nutana_vadhu_pravesha", "category": "vivaha", "title_en": "Nutana Vadhu Griha Pravesha", "title_te": "నూతన వధూ గృహప్రవేశము"},
  {"id": "vivaha", "category": "vivaha", "title_en": "Vivaha (Wedding Muhurtham)", "title_te": "వివాహ మహోత్సవము"}
];

let allMuhurtaRules = FALLBACK_MUHURTA_RULES.slice();

async function loadMuhurtaCatalog() {
  try {
    const res = await fetch(`${API_BASE}/muhurta/catalog`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.all_activities && data.all_activities.length > 0) {
      allMuhurtaRules = data.all_activities;
      populateActivityDropdown();
    }
  } catch (e) {
    console.error("Failed to load catalog:", e);
  }
}

function populateActivityDropdown() {
  const catSelect = el("mfCategorySelect");
  const actSelect = el("mfActivitySelect");
  if (!actSelect) return;
  const selectedCat = catSelect ? catSelect.value : "all";

  const prevVal = actSelect.value;
  const filtered = selectedCat === "all"
    ? allMuhurtaRules
    : allMuhurtaRules.filter(r => r.category === selectedCat);

  actSelect.innerHTML = "";
  let hasSelected = false;
  filtered.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = currentLang === "te" && r.title_te
      ? `${r.title_te} (${r.title_en})`
      : `${r.title_en} · ${r.title_te || ""}`;
    if (r.id === prevVal) {
      opt.selected = true;
      hasSelected = true;
    }
    actSelect.appendChild(opt);
  });
  if (!hasSelected && filtered.length > 0) {
    actSelect.selectedIndex = 0;
  }
  updateContextualFields();
}

const NAKSHATRAS_27 = [
  { id: 1, en: "Ashwini", te: "అశ్విని" },
  { id: 2, en: "Bharani", te: "భరణి" },
  { id: 3, en: "Krittika", te: "కృత్తిక" },
  { id: 4, en: "Rohini", te: "రోహిణి" },
  { id: 5, en: "Mrigashira", te: "మృగశిర" },
  { id: 6, en: "Ardra", te: "ఆర్ద్ర" },
  { id: 7, en: "Punarvasu", te: "పునర్వసు" },
  { id: 8, en: "Pushya", te: "పుష్యమి" },
  { id: 9, en: "Ashlesha", te: "ఆశ్లేష" },
  { id: 10, en: "Magha", te: "మఖ" },
  { id: 11, en: "Purva Phalguni", te: "పూర్వఫల్గుని (పుబ్బ)" },
  { id: 12, en: "Uttara Phalguni", te: "ఉత్తరఫల్గుని (ఉత్తర)" },
  { id: 13, en: "Hasta", te: "హస్త" },
  { id: 14, en: "Chitra", te: "చిత్త" },
  { id: 15, en: "Swati", te: "స్వాతి" },
  { id: 16, en: "Vishakha", te: "విశాఖ" },
  { id: 17, en: "Anuradha", te: "అనూరాధ" },
  { id: 18, en: "Jyeshtha", te: "జ్యేష్ఠ" },
  { id: 19, en: "Mula", te: "మూల" },
  { id: 20, en: "Purvashadha", te: "పూర్వాషాఢ" },
  { id: 21, en: "Uttarashadha", te: "ఉత్తరాషాఢ" },
  { id: 22, en: "Shravana", te: "శ్రవణము" },
  { id: 23, en: "Dhanishta", te: "ధనిష్ఠ" },
  { id: 24, en: "Shatabhisha", te: "శతభిషం" },
  { id: 25, en: "Purvabhadra", te: "పూర్వాభాద్ర" },
  { id: 26, en: "Uttarabhadra", te: "ఉత్తరాభాద్ర" },
  { id: 27, en: "Revati", te: "రేవతి" },
];

function populateAllNakshatraDropdowns() {
  const nakSelectIds = [
    "mfDirectNakSelect",
    "mfGroomNak", "mfBrideNak",
    "mfFatherNak", "mfMotherNak",
    "mfOwnerNak", "mfSpouseNak",
    "mfPartnerNak"
  ];

  nakSelectIds.forEach(id => {
    const sel = el(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = `<option value="">${currentLang === "te" ? "— నక్షత్రం ఎంచుకోండి —" : "— Select Nakshatra —"}</option>`;
    NAKSHATRAS_27.forEach(n => {
      const opt = document.createElement("option");
      opt.value = n.id;
      opt.textContent = currentLang === "te" ? `${n.te} (${n.en})` : `${n.en} · ${n.te}`;
      if (String(n.id) === String(prev)) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

// ---- Horoscope & 3-Mode Nama Nakshatra ----
let horoscopeVisible = false;
let currentNamaMode = 1;
let detectedNamaNakIdx = null;
let detectedNamaPada = null;
let namaLookupTimer = null;

function toggleHoroscopeSection() {
  horoscopeVisible = !horoscopeVisible;
  const sec = el("mfHoroscopeSection");
  if (sec) sec.style.display = horoscopeVisible ? "block" : "none";
}

function switchNamaMode(mode) {
  currentNamaMode = mode;
  [1, 2, 3].forEach(m => {
    const tab = el(`tabMode${m}`);
    const content = el(`namaMode${m}Content`);
    if (tab) tab.className = `nama-tab ${m === mode ? "active" : ""}`;
    if (content) content.style.display = (m === mode) ? "block" : "none";
  });
}

function onNamaNameInput(val) {
  clearTimeout(namaLookupTimer);
  const badge = el("mfNamaLookupBadge");
  if (!val || val.trim().length < 1) {
    if (badge) { badge.style.display = "none"; badge.innerHTML = ""; }
    detectedNamaNakIdx = null;
    detectedNamaPada = null;
    return;
  }
  namaLookupTimer = setTimeout(async () => {
    try {
      const res = await fetch(`${API_BASE}/muhurta/nama-nakshatra/lookup?name=${encodeURIComponent(val.trim())}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.matched && data.result) {
        const r = data.result;
        detectedNamaNakIdx = r.nakshatra_index;
        detectedNamaPada = r.pada;
        if (badge) {
          badge.style.display = "block";
          badge.innerHTML = `✨ <strong>${currentLang === "te" ? "గుర్తించిన నామ నక్షత్రం:" : "Detected Nama Nakshatra:"}</strong> ${r.nakshatra_te} (${r.nakshatra_en}) · ${currentLang === "te" ? `${r.pada}వ పాదం` : `Pada ${r.pada}`} · <strong>${currentLang === "te" ? "రాశి:" : "Rasi:"}</strong> ${r.rasi_te} (${r.rasi_en}) (అక్షరం: <code>${r.matched_syllable}</code>)`;
        }
      } else {
        if (badge) {
          badge.style.display = "block";
          badge.innerHTML = `<span style="color:#888;">${currentLang === "te" ? "ఈ పేరుకు నామ నక్షత్రం నేరుగా లభించలేదు. దయచేసి '1. నాకు నక్షత్రం తెలుసు' ద్వారా ఎంచుకోండి." : "Exact syllable not matched. Please pick manually in Tab 1."}</span>`;
        }
      }
    } catch (e) {
      console.error("Nama lookup error:", e);
    }
  }, 250);
}

// ---- Context-Sensitive Level 3 Fields ----
function updateContextualFields() {
  const catSelect = el("mfCategorySelect");
  const actSelect = el("mfActivitySelect");
  const cat = catSelect ? catSelect.value : "all";
  const act = actSelect ? actSelect.value : "";

  // Hide all context groups
  const groups = ["fieldsVivaha", "fieldsUpanayana", "fieldsGriha", "fieldsBusiness", "fieldsTravel", "fieldsVehicle"];
  groups.forEach(gId => {
    const g = el(gId);
    if (g) g.style.display = "none";
  });

  // Determine active category
  let activeCat = cat;
  if (cat === "all" && act) {
    const foundRule = allMuhurtaRules.find(r => r.id === act);
    if (foundRule) activeCat = foundRule.category;
  }

  if (activeCat === "vivaha") {
    el("fieldsVivaha").style.display = "block";
  } else if (activeCat === "samskaras") {
    el("fieldsUpanayana").style.display = "block";
  } else if (activeCat === "griha") {
    el("fieldsGriha").style.display = "block";
  } else if (activeCat === "travel") {
    el("fieldsTravel").style.display = "block";
  } else if (activeCat === "general") {
    if (act === "business_start" || act === "contracts_agreements") {
      el("fieldsBusiness").style.display = "block";
    } else if (act === "buying_vehicles") {
      el("fieldsVehicle").style.display = "block";
    }
  }
}

function onCategoryChange() {
  populateActivityDropdown();
  updateContextualFields();
}

function onActivityChange() {
  updateContextualFields();
}


// ---- Birth details toggle ----
function toggleBirth() {
  toggleHoroscopeSection();
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

  // Birth details
  let birthParams = "";
  if (birthVisible) {
    const bDob = el("mfBirthDob").value;
    const bTob = el("mfBirthTob").value;
    if (bDob && bTob) {
      birthParams = `&birth_dob=${bDob}&birth_tob=${bTob}`;
    }
  }

  el("findBtn").disabled = true;
  el("mfResults").style.display = "none";
  el("progressSection").style.display = "block";
  el("progressFill").style.width = "10%";
  el("progressText").textContent = currentLang === "te" ? `${days} రోజుల ముహూర్త శోధన జరుగుతోంది...` : `Scanning ${days} days for auspicious Muhurtas...`;
  setStatus("");

  try {
    const actSelect = el("mfActivitySelect");
    const catSelect = el("mfCategorySelect");
    const activityId = actSelect ? actSelect.value : null;
    const cat = catSelect ? catSelect.value : "all";

    const payload = {
      activity_id: activityId,
      start_date: startDate,
      days_to_scan: days,
      lat: lat,
      lon: lon,
      tz_offset: tz_offset,
      place_name: place_name,
      panchaka_method: "standard",
      person_name: el("mfPersonName")?.value?.trim() || null,
      gotra: el("mfGotra")?.value?.trim() || null
    };

    // Level 2 — Astrological & Nama Nakshatra
    if (currentNamaMode === 1 && el("mfDirectNakSelect")) {
      const nakVal = parseInt(el("mfDirectNakSelect").value);
      if (nakVal) payload.janma_nak_idx = nakVal;
      payload.janma_pada = parseInt(el("mfDirectPadaSelect")?.value) || 1;
    } else if (currentNamaMode === 2 && detectedNamaNakIdx) {
      payload.nama_nak_idx = detectedNamaNakIdx;
      payload.nama_pada = detectedNamaPada || 1;
    } else if (currentNamaMode === 3) {
      payload.birth_dob = el("mfBirthDob")?.value || null;
      payload.birth_tob = el("mfBirthTob")?.value || null;
    }

    // Level 3 — Category & Activity Specific Parameters
    let activeCat = cat;
    if (cat === "all" && activityId) {
      const fr = allMuhurtaRules.find(r => r.id === activityId);
      if (fr) activeCat = fr.category;
    }

    if (activeCat === "vivaha") {
      payload.groom_name = el("mfGroomName")?.value?.trim() || null;
      payload.groom_nak_idx = parseInt(el("mfGroomNak")?.value) || null;
      payload.groom_gotra = el("mfGroomGotra")?.value?.trim() || null;
      payload.bride_name = el("mfBrideName")?.value?.trim() || null;
      payload.bride_nak_idx = parseInt(el("mfBrideNak")?.value) || null;
      payload.bride_gotra = el("mfBrideGotra")?.value?.trim() || null;
      payload.time_preference = el("mfTimePref")?.value || "any";
    } else if (activeCat === "samskaras") {
      payload.vatu_name = el("mfVatuName")?.value?.trim() || null;
      payload.father_name = el("mfFatherName")?.value?.trim() || null;
      payload.father_nak_idx = parseInt(el("mfFatherNak")?.value) || null;
      payload.mother_nak_idx = parseInt(el("mfMotherNak")?.value) || null;
      payload.veda_shakha = el("mfVedaShakha")?.value || null;
      payload.sutra = el("mfSutra")?.value || null;
    } else if (activeCat === "griha") {
      payload.owner_name = el("mfOwnerName")?.value?.trim() || null;
      payload.owner_nama_nak_idx = parseInt(el("mfOwnerNak")?.value) || null;
      payload.spouse_name = el("mfSpouseName")?.value?.trim() || null;
      payload.spouse_nama_nak_idx = parseInt(el("mfSpouseNak")?.value) || null;
      payload.door_facing = el("mfDoorFacing")?.value || null;
      payload.plot_facing = el("mfPlotFacing")?.value || null;
      payload.house_type = el("mfHouseType")?.value || null;
    } else if (activeCat === "travel") {
      payload.person_name = el("mfTravelerName")?.value?.trim() || payload.person_name;
      payload.origin = el("mfTravelOrigin")?.value?.trim() || null;
      payload.destination = el("mfTravelDest")?.value?.trim() || null;
      payload.travel_direction = el("mfTravelDir")?.value || null;
      payload.travel_mode = el("mfTravelMode")?.value || null;
    } else if (activeCat === "general") {
      if (activityId === "business_start" || activityId === "contracts_agreements") {
        payload.business_name = el("mfBusinessName")?.value?.trim() || null;
        payload.business_type = el("mfBusinessType")?.value || null;
        payload.partner_name = el("mfPartnerName")?.value?.trim() || null;
        payload.partner_nama_nak_idx = parseInt(el("mfPartnerNak")?.value) || null;
        payload.entrance_facing = el("mfEntranceFacing")?.value || null;
      } else if (activityId === "buying_vehicles") {
        payload.vehicle_type = el("mfVehicleType")?.value || null;
        payload.vehicle_muhurta_type = el("mfVehicleMuhurtaType")?.value || null;
      }
    }

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
      setStatus("");
    }, 400);

  } catch (e) {
    el("progressSection").style.display = "none";
    setStatus(`Error: ${e.message}`, true);
  } finally {
    el("findBtn").disabled = false;
  }
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
    grid.innerHTML = `
      <div class="empty-state" style="padding: 40px 20px; text-align: center; color: #888; background: #fff; border-radius: 8px; border: 1px dashed #ddd; width: 100%;">
        <p style="font-size: 16px; margin: 0;">
          ${currentLang === "te"
            ? `ఎంచుకున్న ${data.days_scanned || 30} రోజులలో ఈ కార్యమునకు శాస్త్రోక్తమైన శుభ ముహూర్తములు లభించలేదు. దయచేసి శోధన రోజులు పెంచి లేదా ఇతర తేదీలను ఎంచుకోండి.`
            : `No auspicious muhurtas found in the ${data.days_scanned || 30} days scanned. Try expanding the date range.`}
        </p>
      </div>`;
    return;
  }

  results.forEach((r, idx) => {
    const vaaraTe = VAARA_NAMES[currentLang][r.panchang?.vaara] || r.panchang?.vaara || "—";
    const nakTe = te(r.panchang?.nakshatra || "", NAKSHATRA_NAMES_TE) || r.panchang?.nakshatra || "—";
    const tithiRaw = r.panchang?.tithi || "—";
    const tName = tithiRaw.split(" ")[0];
    const pName = tithiRaw.includes("Shukla") ? "Shukla" : "Krishna";
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
  const r = lastData.results[idx];
  const d = r.detailed_eval;

  const vaaraTe = VAARA_NAMES[currentLang][r.panchang?.vaara] || r.panchang?.vaara;
  const nakTe = te(r.panchang?.nakshatra || "", NAKSHATRA_NAMES_TE);

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

  // 2. Native Profile & Transit Strength (Janma Nakshatra, Janma Rasi, Tarabalam, Chandrabalam)
  const bd = lastData.birth_details;
  const cb = d?.chandrabalam || r.panchang?.chandrabalam;
  if (bd || cb) {
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
          ${bd ? `<span><strong>${currentLang === "te" ? "జన్మ నక్షత్రం:" : "Janma Nakshatra:"}</strong> ${bNakTe || bd.janma_nakshatra} (${bd.janma_nakshatra_pada} పాదం)</span>` : ''}
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
    const maasa = currentLang === "te" ? (cm.month_telugu || cm.month_name) : `${cm.month_name} Masam`;
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
        <div><strong>${currentLang === "te" ? "తిథి:" : "Tithi:"}</strong> ${r.panchang?.tithi}</div>
        <div><strong>${currentLang === "te" ? "నక్షత్రం:" : "Nakshatra:"}</strong> ${nakTe}</div>
        <div><strong>${currentLang === "te" ? "యోగం:" : "Yoga:"}</strong> ${r.panchang?.yoga}</div>
        <div><strong>${currentLang === "te" ? "కరణం:" : "Karana:"}</strong> ${r.panchang?.karana}</div>
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
  const ip = r.panchang?.inauspicious_periods || {};
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
      `${r.panchang?.tithi} — ${d.tithi?.is_pass ? (currentLang === "te" ? "అనుకూలమైన తిథి." : "Favorable.") : (currentLang === "te" ? "నిషిద్ధ / రిక్త తిథి (చతుర్థి, అష్టమి, నవమి, చతుర్దశి, పౌర్ణమి, అమావాస్య నిషిద్ధం)." : "Avoided Tithi (Chaturthi, Ashtami, Navami, Chaturdashi, Purnima, Amavasya avoided).")}`);

    // Nakshatra
    bodyHtml += buildRuleCard(currentLang === "te" ? "3. నక్షత్ర శుద్ధి" : "3. Nakshatra", d.nakshatra?.is_pass,
      `${nakTe} — ${d.nakshatra?.is_pass ? (currentLang === "te" ? "శ్రేష్ఠ నక్షత్రం." : "Favorable star.") : (currentLang === "te" ? "అనుకూలం కాని నక్షత్రం." : "Not favorable.")}`);

    // Yoga
    bodyHtml += buildRuleCard(currentLang === "te" ? "4. యోగం" : "4. Yoga", d.yoga?.is_pass,
      `${r.panchang?.yoga} — ${d.yoga?.is_pass ? (currentLang === "te" ? "అనుకూల యోగం." : "Favorable.") : (currentLang === "te" ? "అశుభ యోగం." : "Inauspicious Yoga.")}`);

    // Karana
    bodyHtml += buildRuleCard(currentLang === "te" ? "5. కరణం" : "5. Karana", d.karana?.is_pass,
      `${r.panchang?.karana} — ${d.karana?.is_pass ? (currentLang === "te" ? "అనుకూల కరణం." : "Favorable.") : (currentLang === "te" ? "అశుభ కరణం." : "Inauspicious.")}`);

    // Ashtama Shuddhi
    const as = d.ashtama_shuddhi;
    bodyHtml += buildRuleCard(currentLang === "te" ? "6. అష్టమ శుద్ధి" : "6. 8th House", as?.has_shuddhi,
      as?.has_shuddhi ?
        (currentLang === "te" ? `8వ ఇల్లు (${te(as.ashtama_rasi, RASI_NAMES_TE) || as.ashtama_rasi}) ఖాళీగా ఉంది.` : `8th house (${as?.ashtama_rasi}) is vacant.`) :
        (currentLang === "te" ? `8వ ఇంట్లో (${te(as.ashtama_rasi, RASI_NAMES_TE) || as.ashtama_rasi}) గ్రహాలు ఉన్నాయి (${as?.planets_in_8th?.join(", ")}).` : `Planets in 8th (${as?.ashtama_rasi}): ${as?.planets_in_8th?.join(", ")}.`));

    // Lagna Shuddhi
    const ls = d.lagna_shuddhi;
    bodyHtml += buildRuleCard(currentLang === "te" ? "7. లగ్న శుద్ధి" : "7. Lagna", ls?.has_shuddhi,
      ls?.has_shuddhi ?
        (currentLang === "te" ? `లగ్నం (${te(ls.muhurta_lagna, RASI_NAMES_TE) || ls.muhurta_lagna}) ఖాళీగా ఉంది.` : `Lagna (${ls?.muhurta_lagna}) is vacant.`) :
        (currentLang === "te" ? `లగ్నంలో గ్రహాలు ఉన్నాయి (${ls?.planets_in_lagna?.join(", ")}).` : `Planets in Lagna: ${ls?.planets_in_lagna?.join(", ")}.`));

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
    const mahaPass = d.maha_doshas.filter(m => m.is_pass).length;
    const mahaScore = mahaPass * 10;
    bodyHtml += `
      <div class="dosha-panel dosha-panel--maha">
        <div class="dosha-panel__header dosha-panel__header--maha">
          <span>🔥 ${currentLang === "te" ? "ఏకవింశతి మహాదోషముల విశ్లేషణ (21 Maha Doshas)" : "21 Maha Doshas Evaluation"}</span>
          <span class="dosha-panel__score dosha-panel__score--maha">${mahaScore} / 210</span>
        </div>
        <div class="dosha-panel__body dosha-panel__body--maha">`;
    d.maha_doshas.forEach(m => {
      const mTitle = currentLang === "te" ? m.name_te : m.name_en;
      const mDesc = currentLang === "te" ? m.desc_te : m.desc_en;
      bodyHtml += `
        <div class="dosha-item ${m.is_pass ? 'dosha-item--pass' : 'dosha-item--fail-maha'}">
          <div class="dosha-item__header">
            <strong class="dosha-item__name">${mTitle}</strong>
            <span class="dosha-item__badge ${m.is_pass ? 'dosha-item__badge--pass' : 'dosha-item__badge--fail'}">${m.score}/10</span>
          </div>
          <div class="${m.is_pass ? 'dosha-item__desc--pass' : 'dosha-item__desc--fail'}">${mDesc}</div>
        </div>`;
    });
    bodyHtml += `</div></div>`;
  }

  // 11. 10 Dashavidha Doshas Evaluation
  if (d && d.dashavidha_doshas && d.dashavidha_doshas.length > 0) {
    const dashaPass = d.dashavidha_doshas.filter(m => m.is_pass).length;
    const dashaScore = dashaPass * 10;
    bodyHtml += `
      <div class="dosha-panel dosha-panel--dasha">
        <div class="dosha-panel__header dosha-panel__header--dasha">
          <span>⚡ ${currentLang === "te" ? "దశవిధ దోషముల విశ్లేషణ (10 Dashavidha Doshas)" : "10 Dashavidha Doshas Evaluation"}</span>
          <span class="dosha-panel__score dosha-panel__score--dasha">${dashaScore} / 100</span>
        </div>
        <div class="dosha-panel__body dosha-panel__body--dasha">`;
    d.dashavidha_doshas.forEach(m => {
      const mTitle = currentLang === "te" ? m.name_te : m.name_en;
      const mDesc = currentLang === "te" ? m.desc_te : m.desc_en;
      bodyHtml += `
        <div class="dosha-item ${m.is_pass ? 'dosha-item--pass' : 'dosha-item--fail-dasha'}">
          <div class="dosha-item__header">
            <strong class="dosha-item__name">${mTitle}</strong>
            <span class="dosha-item__badge ${m.is_pass ? 'dosha-item__badge--pass' : 'dosha-item__badge--fail'}">${m.score}/10</span>
          </div>
          <div class="${m.is_pass ? 'dosha-item__desc--pass' : 'dosha-item__desc--fail'}">${mDesc}</div>
        </div>`;
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

populateAllNakshatraDropdowns();
populateActivityDropdown();
updateContextualFields();
loadRegions();
loadMuhurtaCatalog();
