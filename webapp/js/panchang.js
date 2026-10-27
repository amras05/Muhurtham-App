// ============================================================
// Muhurtham App · component: panchang lookup panel
// ============================================================

async function getPanchang() {
  const regionId = el("regionSelect").value;
  const date = el("dateInput").value;
  if (!regionId || !date) {
    setStatus("Pick a region and a date first.", true);
    return;
  }

  let lat, lon, tz_offset, place_name;

  if (regionId === "custom") {
    const query = el("customPlaceInput").value.trim();
    if (!query) {
      setStatus("Please enter a place name to search.", true);
      return;
    }
    el("goButton").disabled = true;
    setStatus("Geocoding custom location...");
    try {
      const geoRes = await fetch(`${API_BASE}/geocode?place=${encodeURIComponent(query)}`);
      if (!geoRes.ok) {
        const text = await geoRes.text();
        throw new Error(text || `Geocoding failed with HTTP ${geoRes.status}`);
      }
      const geo = await geoRes.json();
      lat = geo.lat;
      lon = geo.lon;
      tz_offset = geo.tz_offset;
      place_name = geo.label;
    } catch (e) {
      setStatus(`Geocoding error: ${e.message}`, true);
      el("goButton").disabled = false;
      return;
    }
  } else {
    const r = allRegions.find(x => x.id === regionId);
    if (!r) {
      setStatus("Selected region not found.", true);
      return;
    }
    lat = r.lat;
    lon = r.lon;
    tz_offset = r.tz_offset;
    place_name = r.label;
  }

  el("goButton").disabled = true;
  setStatus("Fetching panchang & activities…");
  el("results").style.display = "none";

  try {
    // const method = el("methodSelect").value;
    const res = await fetch(`${API_BASE}/panchang/day-summary?date=${date}&lat=${lat}&lon=${lon}&tz_offset=${tz_offset}&place_name=${encodeURIComponent(place_name)}`); // &method=${method}
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    const data = await res.json();
    lastPanchang = data;
    render(data);
    setStatus("");
  } catch (e) {
    setStatus(`Error: ${e.message}`, true);
  } finally {
    el("goButton").disabled = false;
  }
}

function fmtPair(obj) {
  if (!obj) return "—";
  return `${obj.start} – ${obj.end}`;
}

function render(data) {
  const p = data.panchang || data;
  el("results").style.display = "block";

  // Chandramana header
  const cm = p.chandramana || {};
  const monthTe = te(cm.month_name, MONTH_NAMES_TE);
  const dayLabel = currentLang === "te" ? "రోజు" : "Day";
  const samNameTe = cm.samvatsara_telugu ? ` (${cm.samvatsara_telugu})` : '';
  el("samvatsaraName").textContent = `${cm.samvatsara_name || '—'}${samNameTe} ${currentLang === "te" ? "నామ సంవత్సరం" : "Nama Samvatsara"}`;
  
  const ayanamText = currentLang === "te" ? (cm.ayanam_te || cm.ayanam_en || "") : (cm.ayanam_en || "");
  const ruthuText = currentLang === "te" ? (cm.ruthu_te || cm.ruthu_en || "") : (cm.ruthu_en || "");
  const arInfo = (ayanamText || ruthuText) ? ` · ${ayanamText} · ${ruthuText}` : "";
  el("chandraMonth").textContent = `${monthTe} · ${dayLabel} ${cm.day || ''} (${currentLang === "te" ? "చాంద్రమానం / అమాంత" : "Chandramana / Amanta"})${arInfo}`;
  el("adhikaBadge").style.display = cm.is_adhika_masa ? "inline-block" : "none";
  el("adhikaBadge").textContent = currentLang === "te" ? "అధిక మాసం" : "Adhika Masa";

  // ---- Panchaka Rahitam ----
  renderPanchakaRahitam(p);

  // ---- Daily 5-Fold Division (Kala Vibhajana) ----
  renderKalaVibhajana(p);

  // ---- Daily Lagna Schedule ----
  renderLagnaSchedule(p);

  // Five elements
  const vaara = p.vaara;
  el("vVaara").textContent = currentLang === "te" ? (VAARA_NAMES.te[vaara] || vaara) : vaara;

  const tithiName = te(p.tithi.name, TITHI_NAMES_TE);
  const pakshaName = PAKSHA_NAMES[currentLang][p.tithi.paksha] || p.tithi.paksha;
  el("vTithi").textContent = `${tithiName} (${pakshaName}, #${p.tithi.number})`;
  el("vTithiEnd").textContent = `${p.tithi.start_time} → ${p.tithi.end_time}`;

  const nakName = te(p.nakshatra.name, NAKSHATRA_NAMES_TE);
  const padaLabel = currentLang === "te" ? "పాదం" : "pada";
  el("vNakshatra").textContent = `${nakName} · ${padaLabel} ${p.nakshatra.pada}`;
  el("vNakshatraEnd").textContent = `${p.nakshatra.start_time} → ${p.nakshatra.end_time}`;

  // Nakshatra Padas
  const padasDiv = el("vNakshatraPadas");
  padasDiv.innerHTML = "";
  if (p.nakshatra.padas && p.nakshatra.padas.length > 0) {
    const titleText = currentLang === "te" ? "పాదాల సమయాలు:" : "Pada Timings:";
    let html = `<div class="padas-title">${titleText}</div>`;
    p.nakshatra.padas.forEach(pd => {
      const label = currentLang === "te" ? `పాదం ${pd.pada}` : `Pada ${pd.pada}`;
      html += `<div class="padas-row">
    <span class="padas-row__label">${label}</span>
    <span class="padas-row__time">${pd.start_time} → ${pd.end_time}</span>
  </div>`;
    });
    padasDiv.innerHTML = html;
  }

  const yogaName = te(p.yoga.name, YOGA_NAMES_TE);
  el("vYoga").textContent = yogaName;
  el("vYogaEnd").textContent = `${p.yoga.start_time} → ${p.yoga.end_time}`;

  const karanaName = te(p.karana.name, KARANA_NAMES_TE);
  el("vKarana").textContent = karanaName;
  el("vKaranaEnd").textContent = `${p.karana.start_time} → ${p.karana.end_time}`;

  const rasiIdx = (p.lagna_rasi || p.lagna_rasi_index || 1) - 1;
  el("vLagna").textContent = RASI_NAMES[currentLang][rasiIdx] || "—";
  el("vSunrise").textContent = p.sunrise;
  el("vSunset").textContent = p.sunset;

  // Inauspicious
  el("vRahu").textContent = fmtPair(p.rahu_kalam);
  el("vYamagandam").textContent = fmtPair(p.yamagandam);
  el("vGulika").textContent = fmtPair(p.gulika_kalam);

  if (p.durmuhurtam && p.durmuhurtam.length > 0) {
    el("vDurmuhurtam").textContent = p.durmuhurtam.map(d => `${d.start} – ${d.end}`).join("  &  ");
  } else {
    el("vDurmuhurtam").textContent = "—";
  }

  el("vVarjyam").textContent = fmtPair(p.varjyam);

  // Auspicious
  el("vAbhijit").textContent = fmtPair(p.abhijit_muhurta);
  
  if (p.abhijit_kala_muhurtham) {
    const isClean = p.abhijit_kala_muhurtham.status === "auspicious";
    el("vAbhijitKala").textContent = currentLang === "te" ? p.abhijit_kala_muhurtham.msg_te : p.abhijit_kala_muhurtham.msg_en;
    el("vAbhijitKala").style.color = isClean ? "#e65100" : "#d32f2f";
  } else {
    el("vAbhijitKala").textContent = "—";
    el("vAbhijitKala").style.color = "inherit";
  }

  el("vBrahma").textContent = fmtPair(p.brahma_muhurta);
  el("vGodhuli").textContent = fmtPair(p.godhuli_muhurta);

  if (p.amrit_kalam && p.amrit_kalam.length > 0) {
    el("vAmrit").textContent = p.amrit_kalam.map(a => `${a.start} – ${a.end}`).join("  &  ");
  } else {
    el("vAmrit").textContent = "—";
  }

  // ---- Render Special Muhurta Yogas ----
  renderSpecialYogas(p);

  // ---- Render Activity Verdicts ----
  renderFavorableActivities(data);
  renderAvoidActivities(data);
}

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
            ☸️ ${currentLang === "te" ? "పంచక రహిత విశ్లేషణ (Panchaka Rahitam)" : "Panchaka Rahitam Analysis"}
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
              <strong>🌿 ${currentLang === "te" ? "శాస్త్రోక్త పరిహారం:" : "Classical Remedy:"}</strong> ${panPariharam}
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
  } else if (kvDiv) {
    kvDiv.innerHTML = "";
  }
}

function renderLagnaSchedule(p) {
  const lsDiv = el("vLagnaScheduleSection");
  const lsched = p.lagna_schedule;
  if (lsched && lsched.length > 0 && lsDiv) {
    let items = lsched.map(l => {
      const lName = currentLang === "te" ? l.lagna_name_te : l.lagna_name;
      return `<div class="lagna-item">
          <div class="lagna-item__name">${lName}</div>
          <div class="lagna-item__time">${l.start_time} – ${l.end_time}</div>
        </div>`;
    }).join("");

    lsDiv.innerHTML = `
      <div class="lagna-section">
        <h4 class="lagna-section__title">
          <span>🏛️ ${currentLang === "te" ? "ప్రతి లగ్న అంతము (సూర్యోదయం నుండి 12 లగ్నాలు)" : "Daily Lagna Schedule (Lagna Antyalu - All 12 Signs)"}</span>
        </h4>
        <div class="lagna-grid">${items}</div>
      </div>`;
  } else if (lsDiv) {
    lsDiv.innerHTML = "";
  }
}

function renderSpecialYogas(p) {
  const yogasDiv = el("vSpecialYogas");
  yogasDiv.innerHTML = "";
  if (p.special_yogas && p.special_yogas.length > 0) {
    p.special_yogas.forEach(y => {
      const title = currentLang === "te" ? y.name_te : y.name_en;
      const desc = currentLang === "te" ? y.desc_te : y.desc_en;
      let variant = "good";
      if (y.type === "bad") variant = "bad";
      else if (y.type === "info") variant = "info";
      yogasDiv.innerHTML += `
        <div class="yoga-item yoga-item--${variant}">
          <div class="yoga-item__name">✨ ${title}</div>
          <div class="yoga-item__desc">${desc}</div>
        </div>
      `;
    });
  } else {
    yogasDiv.innerHTML = `<div class="empty-msg">${currentLang === "te" ? "ఈ రోజున సాధారణ యోగాలు ఉన్నవి" : "Standard daily yogas apply."}</div>`;
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
