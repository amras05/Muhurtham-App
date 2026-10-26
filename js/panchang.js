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

  // Panchaka Rahitam
  const panDiv = el("vPanchakaSection");
  const pan = p.panchaka_rahitam;
  if (pan && panDiv) {
    const panName = currentLang === "te" ? pan.name_te : pan.name_en;
    const panEffect = currentLang === "te" ? pan.effect_te : pan.effect_en;
    const panPariharam = currentLang === "te" ? pan.pariharam_te : pan.pariharam_en;
    const isPass = pan.is_pass;
    panDiv.innerHTML = `
      <div style="background: ${isPass ? '#f1f8e9' : '#fff3e0'}; border: 1.5px solid ${isPass ? '#81c784' : '#ffb74d'}; padding: 12px; border-radius: 8px; margin-top: 16px;">
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
  } else if (panDiv) {
    panDiv.innerHTML = "";
  }

  // Daily 5-Fold Division (Kala Vibhajana)
  const kvDiv = el("vKalaVibhajanaSection");
  const kv = p.kala_vibhajana;
  if (kv && kvDiv) {
    kvDiv.innerHTML = `
      <div style="background: #fafafa; border: 1px solid #e0e0e0; padding: 12px; border-radius: 8px; margin-top: 16px;">
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
  } else if (kvDiv) {
    kvDiv.innerHTML = "";
  }

  // Daily Lagna Schedule
  const lsDiv = el("vLagnaScheduleSection");
  const lsched = p.lagna_schedule;
  if (lsched && lsched.length > 0 && lsDiv) {
    let lHtml = `
      <div style="background: #ffffff; border: 1px solid #c59b27; padding: 12px; border-radius: 8px; margin-top: 16px;">
        <h4 style="margin: 0 0 8px 0; color: var(--maroon); font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
          <span>🏛️ ${currentLang === "te" ? "ప్రతి లగ్న అంతము (సూర్యోదయం నుండి 12 లగ్నాలు)" : "Daily Lagna Schedule (Lagna Antyalu - All 12 Signs)"}</span>
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 6px; font-size: 11px;">`;
    lsched.forEach(l => {
      const lName = currentLang === "te" ? l.lagna_name_te : l.lagna_name;
      lHtml += `
        <div style="background: #fdfdfd; border: 1px solid #e0e0e0; padding: 6px 8px; border-radius: 6px;">
          <strong style="color: #333; font-size: 12px;">${lName}</strong>
          <div style="color: #616161; font-weight: 600; margin-top: 2px;">${l.start_time} – ${l.end_time}</div>
        </div>`;
    });
    lHtml += `</div></div>`;
    lsDiv.innerHTML = lHtml;
  } else if (lsDiv) {
    lsDiv.innerHTML = "";
  }

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

  const padasDiv = el("vNakshatraPadas");
  padasDiv.innerHTML = "";
  if (p.nakshatra.padas && p.nakshatra.padas.length > 0) {
    const titleText = currentLang === "te" ? "పాదాల సమయాలు:" : "Pada Timings:";
    let html = `<div style="font-weight:600; margin-bottom: 6px; color: var(--marigold);">${titleText}</div>`;
    p.nakshatra.padas.forEach(pd => {
      const label = currentLang === "te" ? `పాదం ${pd.pada}` : `Pada ${pd.pada}`;
      html += `<div style="display:flex; justify-content:space-between; margin-bottom:4px;">
    <span style="color:#6b6152;">${label}</span>
    <span style="font-weight:600; color:var(--maroon);">${pd.start_time} → ${pd.end_time}</span>
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

  // Render Special Muhurta Yogas
  const yogasDiv = el("vSpecialYogas");
  yogasDiv.innerHTML = "";
  if (p.special_yogas && p.special_yogas.length > 0) {
    p.special_yogas.forEach(y => {
      const title = currentLang === "te" ? y.name_te : y.name_en;
      const desc = currentLang === "te" ? y.desc_te : y.desc_en;
      let bg = "#fff8e1", border = "#c59b27", color = "#4a0e17";
      if (y.type === "bad") {
        bg = "#ffebee"; border = "#e57373"; color = "#b71c1c";
      } else if (y.type === "info") {
        bg = "#e3f2fd"; border = "#64b5f6"; color = "#0d47a1";
      }
      yogasDiv.innerHTML += `
        <div style="background:${bg}; border:1px solid ${border}; color:${color}; padding:10px 14px; border-radius:8px; margin-bottom:8px;">
          <div style="font-weight:700; font-size:14px;">✨ ${title}</div>
          <div style="font-size:13px; margin-top:2px;">${desc}</div>
        </div>
      `;
    });
  } else {
    yogasDiv.innerHTML = `<div style="font-size:13px; color:#6b6152; padding: 4px 0;">${currentLang === "te" ? "ఈ రోజున సాధారణ యోగాలు ఉన్నవి" : "Standard daily yogas apply."}</div>`;
  }

  // Render Favorable Activities
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
    favDiv.innerHTML = `<div style="font-size:13px; color:#6b6152; padding: 4px 0;">${currentLang === "te" ? "అనుకూలమైన ముహూర్తాలు ఏవీ లేవు" : "No favorable activities found for this date."}</div>`;
  }

  // Render Avoid/Mixed Activities
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
    avoidDiv.innerHTML = `<div style="font-size:13px; color:#6b6152; padding: 4px 0;">${currentLang === "te" ? "నిషిద్ధ పనులు ఏవీ లేవు" : "No activities to avoid."}</div>`;
  }
}
