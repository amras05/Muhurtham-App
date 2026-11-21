// ============================================================
// Muhurtham App · Muhurta Finder component: PDF downloads and saved muhurtas.
// Split from finder.js (21 Nov 2026). Plain script: the page loads the finder-*.js files in order
// (see muhurta-finder.html); they share one global scope, and finder-init.js runs last.
// requires: js/config.js, js/i18n.js, js/regions.js, js/stars.js
// ============================================================

// ---- PDF downloads (plan R8): the server prints what is on screen, with correct Telugu ----

function eventTitle() {
  const rule = currentRule();
  return (rule?.title_en || lastData?.title_en) ? pickLang(rule?.title_en || lastData?.title_en, rule?.title_te || lastData?.title_te) : t("Muhurta");
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
    if (tab) n.insertAdjacentHTML("afterbegin", `<h3 class="pa-panel__print-title">${escapeHtml(t(tab[1]))}</h3>`);
  });
  PdfDownload.fromElement(box, {
    kind: "muhurta",
    title: el("mfModalTitle").textContent.trim(),
    subtitle: placeName(),
    filename: PdfDownload.fileName(r?._event?.id || lastData?.activity_id, r?.date),
  }, btn);
}

function downloadListPdf(btn) {
  let kind = "results", title = `${eventTitle()} · ${t("muhurtas found")}`;
  if (currentCategory === "yogas") {
    kind = "yogas"; title = t("Special yogas");
  } else if (currentCategory === "pitru" && pitruCalendarOn) {
    const m = el("mfPitruMode");
    kind = "pitru"; title = `${t("Shraddha calendar")} · ${m ? m.options[m.selectedIndex].text : ""}`;
  }
  const box = document.createElement("div");
  const status = el("mfStatus")?.textContent.trim();
  if (status) { const p = document.createElement("p"); p.textContent = status; box.appendChild(p); }
  box.insertAdjacentHTML("beforeend", el("summaryBar").outerHTML + el("dayGrid").outerHTML);
  const start = el("startDate")?.value || "";
  PdfDownload.fromElement(box, {
    kind, title,
    subtitle: [placeName(), kind === "pitru" ? "" : start && t("from {start}", { start: start })].filter(Boolean).join(" · "),
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

const PITRU_MODE_NAMES = { annual: ["Yearly shraddha"], after_death: ["Rites after a death"],
                           shannavati: ["96 shraddha days"] };

// Special Yogas / Shraddha calendar results on screen (plan F2): what to save, and its name.
// A death date is personal, so it is saved only when the person says yes.
async function toolSearchForSaving() {
  const req = JSON.parse(JSON.stringify(lastToolSearch.request));
  if (lastToolSearch.kind === "yogas") {
    return { kind: "yogas", request: req,
             label: [t("Special yogas"), t("from {start_date}", { start_date: req.start_date }), req.place_name].filter(Boolean).join(" · ") };
  }
  const m = PITRU_MODE_NAMES[req.mode] || [req.mode, req.mode];
  if (req.death_date && !(await AppShell.confirm(
        t("Also save the date and time of death? If you don't, you enter them again when you run this search."),
        { ok: t("Save them"), cancel: t("Don't save them") }))) {
    delete req.death_date;
    delete req.death_time;
  }
  return { kind: "pitru", request: req,
           label: [t(m), req.mode === "shannavati" ? String(req.year) : "", req.place_name].filter(Boolean).join(" · ") };
}

async function saveSearch(btn, withWindow) {
  let kind = "muhurta", req, label, r = null;
  if (lastToolSearch && !withWindow) {
    ({ kind, request: req, label } = await toolSearchForSaving());
  } else {
    req = requestForSaving();
    if (!req) { AppShell.toast(t("Run a search first."), "error"); return; }
    r = withWindow ? lastData?.results?.[openDayIdx] : null;
    label = [eventTitle(), r ? r.date + (r.window_start ? " " + String(r.window_start).slice(0, 5) : "") : t("from {start_date}", { start_date: req.start_date }),
             req.place_name].filter(Boolean).join(" · ");
  }
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/me/saved`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, label: label.slice(0, 120), request: req, chosen_window: r || null }) });
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error((d && typeof d.detail === "string" && d.detail) || `HTTP ${res.status}`);
    AppShell.toast(t("Saved as \"{label}\". Find it under My muhurtas.", { label: d.label }), "success");
  } catch (e) { AppShell.toast(t("Couldn't save: ") + e.message, "error"); }
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
    if (!rule) throw new Error(t("This muhurta is not available now."));
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
    setStatus(t("Opened \"{label}\".", { label: d.label }) + (d.engine_changed ? " " + t("The app has been updated since you saved this, so results may differ.") : ""));
    findMuhurtas();
  } catch (e) { setStatus(t("Couldn't open the saved muhurta: ") + e.message, true); }
}

// A saved Special Yogas or Shraddha calendar search (plan F2): fill its tab and run it again.
async function openSavedToolSearch(d) {
  const req = d.request || {};
  const opened = t("Opened \"{label}\".", { label: d.label }) +
    (d.engine_changed ? " " + t("The app has been updated since you saved this, so results may differ.") : "");
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
  if (el("mfPitruTabCal")?.hidden) throw new Error(t("The shraddha calendar is not available now."));
  setPitruMode(true);
  el("mfPitruMode").value = req.mode;
  updatePitruFields();
  el("mfPitruDeathDate").value = req.death_date || "";
  el("mfPitruDeathTime").value = req.death_time || "";
  if (req.years) el("mfPitruYears").value = req.years;
  if (req.year) el("mfPitruYear").value = req.year;
  if (req.mode !== "shannavati" && !req.death_date) {
    setStatus(opened + " " + t("The date of death was not saved: enter it and press Search."));
    el("mfPitruDeathDate").focus();
    return;
  }
  setStatus(opened);
  return findMuhurtas();
}
