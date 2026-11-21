// ============================================================
// Muhurtham App · Muhurta Finder component: PDF downloads and saved muhurtas.
// Split from finder.js (21 Nov 2026). Plain script: the page loads the finder-*.js files in order
// (see muhurta-finder.html); they share one global scope, and finder-init.js runs last.
// requires: js/config.js, js/i18n.js, js/regions.js, js/stars.js
// ============================================================

// ---- PDF downloads (plan R8): the server prints what is on screen, with correct Telugu ----

function eventTitle() {
  const rule = currentRule();
  return T(rule?.title_en || lastData?.title_en || "Muhurta", rule?.title_te || lastData?.title_te || "ముహూర్తం");
}

function placeName() {
  return chosenPlace ? chosenPlace.label : "";
}

function downloadDetailPdf(btn) {
  const r = lastData?.results?.[openDayIdx];
  // The PDF holds every tab (21 Nov 2026), in order, without the tab bar.
  const box = el("mfModalBody").cloneNode(true);
  box.querySelectorAll(".pa-tabs").forEach(n => n.remove());
  box.querySelectorAll(".pa-panel").forEach(n => {
    n.hidden = false;
    const tab = PA_TABS.find(t => `paPanel_${t[0]}` === n.id);
    if (tab) n.insertAdjacentHTML("afterbegin", `<h3 class="pa-panel__print-title">${escapeHtml(T(tab[1], tab[2]))}</h3>`);
  });
  PdfDownload.fromElement(box, {
    kind: "muhurta",
    title: el("mfModalTitle").textContent.trim(),
    subtitle: placeName(),
    filename: PdfDownload.fileName(r?._event?.id || lastData?.activity_id, r?.date),
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
