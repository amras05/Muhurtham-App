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


// ---- Birth details toggle ----
function toggleBirth() {
  birthVisible = !birthVisible;
  el("birthDetailsSection").style.display = birthVisible ? "block" : "none";
  el("toggleBirthDetails").querySelector("span:first-child") || null;
}

// ---- Regions ----
let allRegions = [];

// ---- D1 Chart Builder ----
function buildD1ChartHTML(d1Array, centerLabel) {
  let rasiPlanets = Array.from({ length: 12 }, () => []);
  if (d1Array && d1Array.length > 0) {
    d1Array.forEach(item => {
      let pAbbr = PLANET_ABBRS[currentLang][item.planet] || item.planet;
      if (item.is_retro && item.planet !== "L" && item.planet !== "Mnd" && item.planet !== "Gk") {
        pAbbr += `<span style="color:#b71c1c;font-weight:700;font-size:11px;">${currentLang === "te" ? "(వ)" : "(R)"}</span>`;
      }
      if (item.is_combust && item.planet !== "L" && item.planet !== "Mnd" && item.planet !== "Gk") {
        pAbbr += `<span style="color:#d84315;font-weight:700;font-size:11px;">${currentLang === "te" ? "(మ)" : "(C)"}</span>`;
      }
      rasiPlanets[item.rasi_index].push(pAbbr);
    });
  }
  let html = `<div class="south-chart" style="grid-template-columns: repeat(4, 1fr); max-width: 400px; margin: 10px auto; font-size:12px;">`;
  html += `<div class="chart-center" style="font-size:13px; line-height:1.2;">${centerLabel}</div>`;
  for (let rasiIdx = 0; rasiIdx < 12; rasiIdx++) {
    const pos = CHART_GRID_POSITIONS[rasiIdx];
    const rasiName = D9_RASI_LABELS[currentLang][rasiIdx];
    const pList = rasiPlanets[rasiIdx].join(", ");
    html += `
      <div class="chart-cell" style="grid-row: ${pos.row}; grid-column: ${pos.col}; padding: 4px; font-size:12px; min-height: 60px; text-align:center;">
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
    const url = `${API_BASE}/muhurta/finder?date=${startDate}&lat=${lat}&lon=${lon}&tz_offset=${tz_offset}&place_name=${encodeURIComponent(place_name)}&days=${days}${birthParams}`;
    
    // Simulate progress
    let progress = 10;
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + 3, 90);
      el("progressFill").style.width = progress + "%";
    }, 500);

    const res = await fetch(url);
    clearInterval(progressInterval);

    if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);

    el("progressFill").style.width = "100%";
    el("progressText").textContent = currentLang === "te" ? "పూర్తయింది! ✓" : "Complete! ✓";

    const data = await res.json();
    lastData = data;

    setTimeout(() => {
      el("progressSection").style.display = "none";
      renderResults(data);
      setStatus("");
    }, 500);

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
  const results = data.results || [];

  // Summary
  const excellent = results.filter(r => r.verdict === "highly_favorable").length;
  const favorable = results.filter(r => r.verdict === "favorable").length;
  const unfavorable = results.filter(r => r.verdict === "unfavorable").length;
  const withMuhurta = results.filter(r => r.pushkara_info).length;

  el("summaryBar").innerHTML = `
    <div class="summary-stat">
      <div class="num" style="color: #1b5e20;">${excellent}</div>
      <div class="label" data-en="Excellent" data-te="ఉత్తమం">${currentLang === "te" ? "ఉత్తమం" : "Excellent"}</div>
    </div>
    <div class="summary-stat">
      <div class="num" style="color: #f57f17;">${favorable}</div>
      <div class="label" data-en="Favorable" data-te="మధ్యమం">${currentLang === "te" ? "మధ్యమం" : "Favorable"}</div>
    </div>
    <div class="summary-stat">
      <div class="num" style="color: #b71c1c;">${unfavorable}</div>
      <div class="label" data-en="Unfavorable" data-te="అశుభం">${currentLang === "te" ? "అశుభం" : "Unfavorable"}</div>
    </div>
    <div class="summary-stat">
      <div class="num" style="color: var(--gold);">${withMuhurta}</div>
      <div class="label" data-en="With Muhurta" data-te="ముహూర్తంతో">${currentLang === "te" ? "ముహూర్తంతో" : "With Muhurta"}</div>
    </div>
  `;

  // Day cards
  const grid = el("dayGrid");
  grid.innerHTML = "";

  results.forEach((r, idx) => {
    const vaaraTe = VAARA_NAMES[currentLang][r.panchang?.vaara] || r.panchang?.vaara || "—";
    const nakTe = te(r.panchang?.nakshatra || "", NAKSHATRA_NAMES_TE);
    const tithiRaw = r.panchang?.tithi || "—";
    const tName = tithiRaw.split(" ")[0];
    const pName = tithiRaw.includes("Shukla") ? "Shukla" : "Krishna";
    const tithiTe = currentLang === "te" ? `${te(tName, TITHI_NAMES_TE)} (${PAKSHA_NAMES.te[pName] || pName})` : tithiRaw;

    const verdictClass = r.verdict || "error";
    const verdictText = currentLang === "te" ?
      (r.verdict === "highly_favorable" ? "ఉత్తమ ముహూర్తం" : (r.verdict === "favorable" ? "మధ్యమ ముహూర్తం" : "అశుభం")) :
      (r.verdict === "highly_favorable" ? "Excellent" : (r.verdict === "favorable" ? "Favorable" : "Unfavorable"));

    const dateObj = new Date(r.date + "T00:00:00");
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });

    // Eval dots
    const d = r.detailed_eval;
    let dotsHtml = "";
    if (d) {
      const checks = [
        { label: currentLang === "te" ? "వారం" : "Vaara", pass: d.vaara?.is_pass },
        { label: currentLang === "te" ? "తిథి" : "Tithi", pass: d.tithi?.is_pass },
        { label: currentLang === "te" ? "నక్షత్రం" : "Nak", pass: d.nakshatra?.is_pass },
        { label: currentLang === "te" ? "యోగం" : "Yoga", pass: d.yoga?.is_pass },
        { label: currentLang === "te" ? "కరణం" : "Karana", pass: d.karana?.is_pass },
        { label: currentLang === "te" ? "అష్టమ శుద్ధి" : "8th", pass: d.ashtama_shuddhi?.has_shuddhi },
        { label: currentLang === "te" ? "లగ్న శుద్ధి" : "Lagna", pass: d.lagna_shuddhi?.has_shuddhi },
      ];
      if (d.tara) {
        checks.push({ label: currentLang === "te" ? "తార" : "Tara", pass: d.tara?.is_pass });
      }
      if (d.chandrabalam) {
        checks.push({ label: currentLang === "te" ? "చంద్రబలం" : "Chandra", pass: d.chandrabalam?.is_pass });
      }
      if (d.panchaka) {
        checks.push({ label: currentLang === "te" ? "పంచకం" : "Panchaka", pass: d.panchaka?.is_pass });
      }
      dotsHtml = `<div class="eval-dots">${checks.map(c =>
        `<span class="eval-dot ${c.pass ? 'pass' : 'fail'}">${c.pass ? '✓' : '✕'} ${c.label}</span>`
      ).join("")}</div>`;
    }

    // Pushkara mini card
    let pushMini = "";
    if (r.pushkara_info) {
      const pi = r.pushkara_info;
      const stmt = currentLang === "te" ? pi.statement_te : pi.statement_en;

      pushMini = `
        <div class="pushkara-mini">
          <strong>⏰ ${stmt}</strong>
          <div style="font-size: 11px; margin-top: 4px; color: #5d4037;">
            🏛️ ${currentLang === "te" ? "లగ్నాంతాలు:" : "Lagna:"} ${pi.lagna_duration || "—"}
            ${pi.pushkara_bhaga?.is_available ? `<br>📌 ${currentLang === "te" ? "పుష్కర భాగం:" : "P. Bhaga:"} ${pi.pushkara_bhaga.precise_time}` : ""}
            ${pi.pushkara_navamsha?.is_available ? `<br>📌 ${currentLang === "te" ? "పుష్కర నవాంశ:" : "P. Nav:"} ${pi.pushkara_navamsha.precise_time}` : ""}
          </div>
        </div>`;
    }

    grid.innerHTML += `
      <div class="day-card ${verdictClass}" onclick="openDayModal(${idx})">
        <div class="day-header">
          <div>
            <div class="day-date">${r.date} · ${currentLang === "te" ? vaaraTe : dayName}</div>
            <div class="day-vaara">${currentLang === "te" ? `రోజు ${r.day_offset}` : `Day ${r.day_offset}`}</div>
          </div>
          <div style="text-align: right;">
            <span class="verdict-badge ${verdictClass}">${verdictText}</span>
            <div style="font-size: 11px; color: #6b6152; margin-top: 4px;">${r.percentage}%</div>
          </div>
        </div>
        <div class="day-panchang">
          <div><strong>${currentLang === "te" ? "తిథి:" : "Tithi:"}</strong> ${tithiTe}</div>
          <div><strong>${currentLang === "te" ? "నక్షత్రం:" : "Nak:"}</strong> ${nakTe}</div>
          <div><strong>${currentLang === "te" ? "యోగం:" : "Yoga:"}</strong> ${r.panchang?.yoga || "—"}</div>
          <div><strong>${currentLang === "te" ? "కరణం:" : "Karana:"}</strong> ${r.panchang?.karana || "—"}</div>
        </div>
        ${dotsHtml}
        ${pushMini}
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
      <div style="background: #fff8e1; border: 1.5px solid #ffa000; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
        <h4 style="margin: 0 0 6px 0; color: #b71c1c; font-size: 14px;">☀️ ${currentLang === "te" ? "శుభ ముహూర్త సమయ నిర్ణయం" : "Recommended Time Prediction"}</h4>
        <div style="font-size: 16px; font-weight: 700; color: #1b5e20;">⏰ ${stmt}</div>
        <div style="font-size: 13px; font-weight: 600; color: #4e342e; margin-top: 6px; line-height: 1.6;">
          ${subDetails.join("<br>")}
        </div>
        ${avoidNote ? `<div style="font-size: 12px; font-weight: 600; color: #b71c1c; margin-top: 6px; background: #fff0f0; padding: 4px 8px; border-radius: 4px; border: 1px solid #ffcdd2;">⚠️ ${currentLang === "te" ? "గమనిక:" : "Note:"} ${avoidNote}</div>` : ''}
      </div>`;
  }

  // 2. Native Profile & Transit Strength (Janma Nakshatra, Janma Rasi, Tarabalam, Chandrabalam)
  const bd = lastData.birth_details;
  const cb = d?.chandrabalam || r.panchang?.chandrabalam;
  if (bd || cb) {
    const bNakTe = bd ? te(bd.janma_nakshatra || "", NAKSHATRA_NAMES_TE) : "";
    const bRasiTe = bd?.birth_moon_rasi ? (te(bd.birth_moon_rasi, RASI_NAMES_TE) || bd.birth_moon_rasi) : "";
    const cbDesc = cb ? (currentLang === "te" ? cb.desc_te : cb.desc_en) : "";
    bodyHtml += `
      <div style="background:#eef7ee; border:1.5px solid #81c784; padding:10px 14px; border-radius:8px; margin-bottom:16px; display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <strong style="color:#1b5e20; font-size:13px;">👤 ${currentLang === "te" ? "వ్యక్తిగత సమాచారం & గోచారం (Native & Transit)" : "Native Profile & Transit Details"}</strong>
          ${cb ? `<span style="background:${cb.is_pass ? '#c8e6c9' : '#ffcdd2'}; color:${cb.is_pass ? '#1b5e20' : '#b71c1c'}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">🌙 ${currentLang === "te" ? "చంద్రబలం:" : "Chandrabalam:"} ${cb.house ? cb.house + 'వ ఇల్లు' : 'అనుకూలం'}</span>` : ''}
        </div>
        <div style="font-size:12px; color:#2e7d32; display:flex; flex-wrap:wrap; gap:12px;">
          ${bd ? `<span><strong>${currentLang === "te" ? "జన్మ నక్షత్రం:" : "Janma Nakshatra:"}</strong> ${bNakTe || bd.janma_nakshatra} (${bd.janma_nakshatra_pada} పాదం)</span>` : ''}
          ${bd?.birth_moon_rasi ? `<span><strong>${currentLang === "te" ? "జన్మ రాశి:" : "Janma Rasi:"}</strong> ${bRasiTe}</span>` : ''}
          ${d?.tara ? `<span><strong>${currentLang === "te" ? "తారాబలం:" : "Tarabalam:"}</strong> ${te(d.tara.name, TARA_NAMES_TE) || d.tara.name}</span>` : ''}
        </div>
        ${cbDesc ? `<div style="font-size:11px; color:#33691e; border-top:1px dashed #a5d6a7; padding-top:4px; margin-top:2px;">ℹ️ ${cbDesc}</div>` : ''}
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
      <div style="background: linear-gradient(135deg, #fff9e6 0%, #fff1c6 100%); border: 1px solid #d4af37; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 13px; font-weight: 700; color: #5d4037; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
        <span style="color: #b71c1c;">🪔 ${samName}</span>
        <span>·</span>
        <span style="color: #4e342e;">${ayanam}</span>
        <span>·</span>
        <span style="color: #4e342e;">${ruthu}</span>
        <span>·</span>
        <span style="color: #1b5e20;">${maasa}</span>
        <span>·</span>
        <span style="color: #0d47a1;">${paksha}</span>
      </div>`;
  }

  // Panchang Grid
  bodyHtml += `
    <div style="background:var(--card-bg); padding:12px; border-radius:8px; border:1px solid var(--line); margin-bottom:16px;">
      <h4 style="margin:0 0 8px 0; color:var(--deep-maroon);">📌 ${currentLang === "te" ? "పంచాంగ వివరాలు" : "Panchang Details"}</h4>
      ${cmBanner}
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:8px; font-size:13px;">
        <div><strong>${currentLang === "te" ? "వారం:" : "Weekday:"}</strong> ${vaaraTe}</div>
        <div><strong>${currentLang === "te" ? "తిథి:" : "Tithi:"}</strong> ${r.panchang?.tithi}</div>
        <div><strong>${currentLang === "te" ? "నక్షత్రం:" : "Nakshatra:"}</strong> ${nakTe}</div>
        <div><strong>${currentLang === "te" ? "యోగం:" : "Yoga:"}</strong> ${r.panchang?.yoga}</div>
        <div><strong>${currentLang === "te" ? "కరణం:" : "Karana:"}</strong> ${r.panchang?.karana}</div>
        <div><strong>${currentLang === "te" ? "సూర్యోదయం:" : "Sunrise:"}</strong> ${r.panchang?.sunrise || "—"}</div>
        <div><strong>${currentLang === "te" ? "సూర్యాస్తమయం:" : "Sunset:"}</strong> ${r.panchang?.sunset || "—"}</div>
        <div><strong>${currentLang === "te" ? "అభిజిత్ ముహూర్తం:" : "Abhijit:"}</strong> ${r.panchang?.abhijit_muhurta ? (r.panchang.abhijit_muhurta.start + ' – ' + r.panchang.abhijit_muhurta.end) : '—'}</div>
        <div style="grid-column: 1 / -1; margin-top: 6px; padding: 6px 10px; border-radius: 6px; font-weight: 600; display: flex; align-items: center; gap: 6px;
          ${r.panchang?.abhijit_kala_muhurtham && r.panchang.abhijit_kala_muhurtham.status === 'auspicious' ? 
            'background: #fffde7; border: 1px solid #fdd835; color: #e65100;' : 
            'background: #fff0f0; border: 1px solid #ffcdd2; color: #b71c1c;'
          }">
          <span>${r.panchang?.abhijit_kala_muhurtham && r.panchang.abhijit_kala_muhurtham.status === 'auspicious' ? '✨' : '⚠️'}</span>
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
      <div style="background: ${isPass ? '#f1f8e9' : '#fff3e0'}; border: 1.5px solid ${isPass ? '#81c784' : '#ffb74d'}; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <h4 style="margin: 0; color: ${isPass ? '#1b5e20' : '#e65100'}; font-size: 14px;">
            ☸️ ${currentLang === "te" ? "పంచక రహిత విశ్లేషణ (Panchaka Rahitam)" : "Panchaka Rahitam Analysis"}
          </h4>
          <span style="background: ${isPass ? '#2e7d32' : '#e65100'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700;">
            ${isPass ? (currentLang === "te" ? "శుభ పంచకం (దోష రహితం)" : "Subha (Clean)") : (currentLang === "te" ? "అశుభ పంచకం" : "Dosha")}
          </span>
        </div>
        <div style="font-size: 12px; color: #424242; line-height: 1.5;">
          <div><strong>${currentLang === "te" ? "పంచక నిర్ణయ సూత్రం:" : "Formula:"}</strong> <code>${pan.formula || `(తిథి + వారం + నక్షత్రం + లగ్నం) % 9 = శేషం ${pan.remainder}`}</code></div>
          <div style="margin-top: 4px;"><strong>${currentLang === "te" ? "పంచక ఫలితం:" : "Classification:"}</strong> <span style="font-weight: 700; color: ${isPass ? '#1b5e20' : '#b71c1c'};">${panName}</span> — <em>${panEffect}</em></div>
          ${panPariharam && !isPass ? `
            <div style="margin-top: 6px; background: #ffffff; padding: 6px 10px; border-radius: 4px; border: 1px dashed #ff9800; font-size: 11px; color: #e65100;">
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
      <div style="background: #fafafa; border: 1px solid #e0e0e0; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
        <h4 style="margin: 0 0 8px 0; color: var(--maroon); font-size: 14px; display: flex; align-items: center; justify-content: space-between;">
          <span>⏳ ${currentLang === "te" ? "రోజు మొత్తంలో కాల విభజన (పంచధా కాల విభజన)" : "Daily 5-Fold Time Division (Kala Vibhajana)"}</span>
          <span style="font-size: 11px; font-weight: 500; color: #757575;">${currentLang === "te" ? "పగలు 5 భాగాలు + రాత్రి పవిత్ర కాలాలు" : "5 Day divisions + Night Sacred Periods"}</span>
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; font-size: 12px;">
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e0e0e0;">
            <div style="font-weight: 700; color: #e65100;">🌅 ${currentLang === "te" ? kv.pratah_kalam?.name_te : kv.pratah_kalam?.name_en}</div>
            <div style="font-weight: 600; color: #333; margin: 2px 0;">${kv.pratah_kalam?.start} – ${kv.pratah_kalam?.end}</div>
            <div style="font-size: 11px; color: #666;">${currentLang === "te" ? kv.pratah_kalam?.desc_te : kv.pratah_kalam?.desc_en}</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e0e0e0;">
            <div style="font-weight: 700; color: #2e7d32;">🌾 ${currentLang === "te" ? kv.sangava_kalam?.name_te : kv.sangava_kalam?.name_en}</div>
            <div style="font-weight: 600; color: #333; margin: 2px 0;">${kv.sangava_kalam?.start} – ${kv.sangava_kalam?.end}</div>
            <div style="font-size: 11px; color: #666;">${currentLang === "te" ? kv.sangava_kalam?.desc_te : kv.sangava_kalam?.desc_en}</div>
          </div>
          <div style="background: #fffde7; padding: 8px; border-radius: 6px; border: 1px solid #ffd54f;">
            <div style="font-weight: 700; color: #f57f17;">☀️ ${currentLang === "te" ? kv.madhyahnika_kalam?.name_te : kv.madhyahnika_kalam?.name_en} <span style="font-size: 10px; background: #fff; padding: 1px 4px; border-radius: 4px; border: 1px solid #fbc02d;">అభిజిత్</span></div>
            <div style="font-weight: 600; color: #333; margin: 2px 0;">${kv.madhyahnika_kalam?.start} – ${kv.madhyahnika_kalam?.end}</div>
            <div style="font-size: 11px; color: #666;">${currentLang === "te" ? kv.madhyahnika_kalam?.desc_te : kv.madhyahnika_kalam?.desc_en}</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e0e0e0;">
            <div style="font-weight: 700; color: #5d4037;">⛅ ${currentLang === "te" ? kv.aparahna_kalam?.name_te : kv.aparahna_kalam?.name_en}</div>
            <div style="font-weight: 600; color: #333; margin: 2px 0;">${kv.aparahna_kalam?.start} – ${kv.aparahna_kalam?.end}</div>
            <div style="font-size: 11px; color: #666;">${currentLang === "te" ? kv.aparahna_kalam?.desc_te : kv.aparahna_kalam?.desc_en}</div>
          </div>
          <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid #e0e0e0;">
            <div style="font-weight: 700; color: #ad1457;">🌇 ${currentLang === "te" ? kv.sayahna_kalam?.name_te : kv.sayahna_kalam?.name_en}</div>
            <div style="font-weight: 600; color: #333; margin: 2px 0;">${kv.sayahna_kalam?.start} – ${kv.sayahna_kalam?.end}</div>
            <div style="font-size: 11px; color: #666;">${currentLang === "te" ? kv.sayahna_kalam?.desc_te : kv.sayahna_kalam?.desc_en}</div>
          </div>
          <div style="background: #ede7f6; padding: 8px; border-radius: 6px; border: 1px solid #d1c4e9;">
            <div style="font-weight: 700; color: #4527a0;">🕉️ ${currentLang === "te" ? "రాత్రి విశేష కాలములు" : "Night Sacred Timings"}</div>
            <div style="font-size: 11px; color: #311b92; margin-top: 2px;">
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
      <div style="background: #ffffff; border: 1px solid #c59b27; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
        <h4 style="margin: 0 0 8px 0; color: var(--maroon); font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
          <span>🏛️ ${currentLang === "te" ? "ప్రతి లగ్న అంతము (సూర్యోదయం నుండి 12 లగ్నాలు)" : "Daily Lagna Schedule (Lagna Antyalu - All 12 Signs)"}</span>
          <span style="font-size: 11px; font-weight: 600; color: #b71c1c;">${currentLang === "te" ? "ముహూర్త లగ్నం హైలైట్ చేయబడినది" : "Muhurta Lagna Highlighted"}</span>
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 6px; font-size: 11px;">`;
    lsched.forEach(l => {
      const isCurrent = currentLagnaName && (l.lagna_name === currentLagnaName || l.lagna_name_te === currentLagnaName);
      const lName = currentLang === "te" ? l.lagna_name_te : l.lagna_name;
      const lCardStyle = isCurrent ? 
        "background: #fff8e1; border: 1.5px solid #ffa000; box-shadow: 0 2px 6px rgba(255,160,0,0.25);" : 
        "background: #fdfdfd; border: 1px solid #e0e0e0;";
      bodyHtml += `
        <div style="${lCardStyle} padding: 6px 8px; border-radius: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: ${isCurrent ? '#b71c1c' : '#333'}; font-size: 12px;">${lName}</strong>
            ${isCurrent ? `<span style="background: #1b5e20; color: #fff; padding: 1px 4px; border-radius: 3px; font-size: 9px; font-weight: 700;">ముహూర్తం</span>` : ''}
          </div>
          <div style="color: #616161; font-weight: 600; margin-top: 2px;">${l.start_time} – ${l.end_time}</div>
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
    <div style="background:#fff5f5; padding:12px; border-radius:8px; border:1px solid #ffcdd2; margin-bottom:16px;">
      <h4 style="margin:0 0 8px 0; color:#b71c1c;">⏳ ${currentLang === "te" ? "అశుభ సమయములు" : "Inauspicious Timings"}</h4>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:8px; font-size:13px; color:#5c0011;">
        <div><strong>${currentLang === "te" ? "రాహు కాలం:" : "Rahu:"}</strong> ${fmtP(ip.rahu_kalam)}</div>
        <div><strong>${currentLang === "te" ? "యమగండం:" : "Yama:"}</strong> ${fmtP(ip.yamagandam)}</div>
        <div><strong>${currentLang === "te" ? "గుళిక కాలం:" : "Gulika:"}</strong> ${fmtP(ip.gulika_kalam)}</div>
        <div><strong>${currentLang === "te" ? "దుర్ముహూర్తం:" : "Dur:"}</strong> ${fmtP(ip.durmuhurtam)}</div>
        <div><strong>${currentLang === "te" ? "వర్జ్యం:" : "Varjyam:"}</strong> ${fmtP(ip.varjyam)}</div>
      </div>
      <div style="font-size: 11px; color: #7f0000; margin-top: 8px; background: #ffebee; padding: 6px 10px; border-radius: 4px; border: 1px dashed #ef9a9a; line-height: 1.4;">
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
    <div style="background:#ffffff; padding:12px; border-radius:8px; border:1px solid var(--maroon); margin-bottom:16px;">
      <h4 style="margin:0 0 6px 0; color:var(--deep-maroon); text-align:center;">📊 ${currentLang === "te" ? `ముహూర్త D1 చక్రం (${r.date})` : `Muhurta D1 Chart (${r.date})`}</h4>
      ${buildD1ChartHTML(r.d1_chart, chartLabel)}
    </div>`;

  // 9. Rule Evaluation Grid
  if (d) {
    bodyHtml += `<h4 style="margin:16px 0 8px 0; color:var(--deep-maroon);">📜 ${currentLang === "te" ? "ముహూర్త నియమ విశ్లేషణ" : "Muhurta Rules Evaluation"}</h4>`;
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
      <div style="margin-top: 16px; border: 1.5px solid #b71c1c; border-radius: 8px; overflow: hidden;">
        <div style="background: #b71c1c; color: #ffffff; padding: 10px 14px; font-weight: 700; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
          <span>🔥 ${currentLang === "te" ? "ఏకవింశతి మహాదోషముల విశ్లేషణ (21 Maha Doshas)" : "21 Maha Doshas Evaluation"}</span>
          <span style="background: #ffffff; color: #b71c1c; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 800;">${mahaScore} / 210</span>
        </div>
        <div style="padding: 10px; background: #fff8f8; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px;">`;
    d.maha_doshas.forEach(m => {
      const mTitle = currentLang === "te" ? m.name_te : m.name_en;
      const mDesc = currentLang === "te" ? m.desc_te : m.desc_en;
      const badgeClass = m.is_pass ? "background:#e8f5e9; color:#2e7d32; border:1px solid #a5d6a7;" : "background:#ffebee; color:#c62828; border:1px solid #ef9a9a;";
      bodyHtml += `
        <div style="background:#ffffff; border:1px solid ${m.is_pass ? '#c8e6c9' : '#ffcdd2'}; border-radius:6px; padding:8px 10px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="color:#2c3e50; font-size:13px;">${mTitle}</strong>
            <span style="${badgeClass} padding:1px 6px; border-radius:4px; font-size:11px; font-weight:700;">${m.score}/10</span>
          </div>
          <div style="color:${m.is_pass ? '#388e3c' : '#d32f2f'}; font-size:11px; font-weight:500;">${mDesc}</div>
        </div>`;
    });
    bodyHtml += `</div></div>`;
  }

  // 11. 10 Dashavidha Doshas Evaluation
  if (d && d.dashavidha_doshas && d.dashavidha_doshas.length > 0) {
    const dashaPass = d.dashavidha_doshas.filter(m => m.is_pass).length;
    const dashaScore = dashaPass * 10;
    bodyHtml += `
      <div style="margin-top: 16px; border: 1.5px solid #e65100; border-radius: 8px; overflow: hidden;">
        <div style="background: #e65100; color: #ffffff; padding: 10px 14px; font-weight: 700; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
          <span>⚡ ${currentLang === "te" ? "దశవిధ దోషముల విశ్లేషణ (10 Dashavidha Doshas)" : "10 Dashavidha Doshas Evaluation"}</span>
          <span style="background: #ffffff; color: #e65100; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 800;">${dashaScore} / 100</span>
        </div>
        <div style="padding: 10px; background: #fffde7; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px;">`;
    d.dashavidha_doshas.forEach(m => {
      const mTitle = currentLang === "te" ? m.name_te : m.name_en;
      const mDesc = currentLang === "te" ? m.desc_te : m.desc_en;
      const badgeClass = m.is_pass ? "background:#e8f5e9; color:#2e7d32; border:1px solid #a5d6a7;" : "background:#ffebee; color:#c62828; border:1px solid #ef9a9a;";
      bodyHtml += `
        <div style="background:#ffffff; border:1px solid ${m.is_pass ? '#c8e6c9' : '#ffe0b2'}; border-radius:6px; padding:8px 10px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="color:#2c3e50; font-size:13px;">${mTitle}</strong>
            <span style="${badgeClass} padding:1px 6px; border-radius:4px; font-size:11px; font-weight:700;">${m.score}/10</span>
          </div>
          <div style="color:${m.is_pass ? '#388e3c' : '#d32f2f'}; font-size:11px; font-weight:500;">${mDesc}</div>
        </div>`;
    });
    bodyHtml += `</div></div>`;
  }

  // 12. Muhurta Dosha Pariharams (ముహూర్తములో దోషాలకు పరిహారములు)
  const pariharas = d?.pariharas;
  if (pariharas && pariharas.length > 0) {
    bodyHtml += `
      <div style="background: #f3e5f5; border: 1.5px solid #8e24aa; border-radius: 8px; overflow: hidden; margin-top: 16px; margin-bottom: 16px;">
        <div style="background: #8e24aa; color: #ffffff; padding: 10px 14px; font-weight: 700; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
          <span>🛡️ ${currentLang === "te" ? "ముహూర్తములో దోషాలకు పరిహారములు (Muhurta Dosha Remedies)" : "Muhurta Dosha Cancellation Remedies (Pariharams)"}</span>
          <span style="background: #ffffff; color: #8e24aa; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800;">${pariharas.length} ${currentLang === "te" ? "పరిహారములు వర్తించును" : "Active Remedies"}</span>
        </div>
        <div style="padding: 10px; background: #faf5fb; display: flex; flex-direction: column; gap: 8px;">`;
    pariharas.forEach(pr => {
      const prTitle = currentLang === "te" ? pr.name_te : pr.name_en;
      const prDesc = currentLang === "te" ? pr.desc_te : pr.desc_en;
      bodyHtml += `
        <div style="background: #ffffff; border: 1px solid #ce93d8; border-radius: 6px; padding: 8px 12px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="color: #4a148c; font-size: 13px;">✨ ${prTitle}</strong>
            <span style="background: #e1bee7; color: #4a148c; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">${pr.status}</span>
          </div>
          ${pr.shloka ? `<div style="font-family: serif; color: #6a1b9a; font-style: italic; margin-bottom: 4px; font-size: 11px;">"${pr.shloka}"</div>` : ''}
          <div style="color: #333; line-height: 1.4;">${prDesc}</div>
        </div>`;
    });
    bodyHtml += `</div></div>`;
  }

  // 13. Special Yogas
  if (r.special_yogas?.length > 0) {
    bodyHtml += `<div style="margin-top: 12px;">`;
    r.special_yogas.forEach(y => {
      const yName = currentLang === "te" ? y.name_te : y.name_en;
      const yDesc = currentLang === "te" ? y.desc_te : y.desc_en;
      let bg = "#fff8e1", border = "#c59b27", color = "#4a0e17";
      if (y.type === "bad") { bg = "#ffebee"; border = "#e57373"; color = "#b71c1c"; }
      bodyHtml += `<div style="background:${bg}; border:1px solid ${border}; color:${color}; padding:6px 10px; border-radius:6px; margin-top:6px; font-size:12px; font-weight:600;">✨ ${yName} — <span style="font-weight:400;">${yDesc}</span></div>`;
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

loadRegions();
