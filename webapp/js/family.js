// My family (plan R1): add, edit and remove saved people. Star from birth details (worked out on the
// server when saving) or picked; nama nakshatra from the naming name. Uses js/stars.js and js/regions.js.
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function say(kind, text) { var b = $("famMsg"); b.hidden = false; b.className = "auth-alert auth-alert--" + kind; b.textContent = text; b.scrollIntoView({ block: "nearest" }); }
  async function api(method, path, body) {
    var res = await fetch(API_BASE + path, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: data }));
    return data;
  }
  var REL = { self: ["Me", "నేను"], spouse: ["Spouse", "భార్య / భర్త"], son: ["Son", "కుమారుడు"], daughter: ["Daughter", "కుమార్తె"],
    father: ["Father", "తండ్రి"], mother: ["Mother", "తల్లి"], brother: ["Brother", "సోదరుడు"], sister: ["Sister", "సోదరి"],
    grandchild: ["Grandchild", "మనవడు / మనవరాలు"], other: ["Other", "ఇతరులు"] };
  var people = [], editing = null, mode = "birth", lookupTimer = null, events = [], catalog = [];
  var STATUS = { planned: ["Planned", "నిర్ణయించినది"], done: ["Done", "జరిగింది"], cancelled: ["Cancelled", "రద్దు"] };

  function name(list, idx) { var x = idx && list[idx - 1]; return x ? tr(x.en, x.te) : ""; }
  function opts(list, placeholder) {
    return '<option value="">' + esc(placeholder) + "</option>" + list.map(function (x) { return '<option value="' + x.id + '">' + esc(tr(x.en + " · " + x.te, x.te + " (" + x.en + ")")) + "</option>"; }).join("");
  }
  function fillSelects() {
    var keep = {};
    ["fJanma", "fJpada", "fRasi", "fLagna", "fNama", "fNpada", "fPlace"].forEach(function (k) { keep[k] = $(k).value; });
    var notKnown = tr("— Not known —", "— తెలియదు —");
    var padas = [1, 2, 3, 4].map(function (n) { return { id: n, en: "Pada " + n, te: n + "వ పాదం" }; });
    $("fJanma").innerHTML = opts(NAKSHATRAS_27, notKnown); $("fNama").innerHTML = opts(NAKSHATRAS_27, notKnown);
    $("fRasi").innerHTML = opts(RASIS_12, notKnown); $("fLagna").innerHTML = opts(RASIS_12, notKnown);
    $("fJpada").innerHTML = opts(padas, "—"); $("fNpada").innerHTML = opts(padas, "—");
    $("fPlace").innerHTML = '<option value="">' + esc(tr("— Choose the birth place —", "— జన్మస్థలం ఎంచుకోండి —")) + "</option>" +
      (typeof allRegions !== "undefined" ? allRegions : []).filter(function (r) { return r.id !== "custom"; })
        .map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.label) + "</option>"; }).join("");
    Object.keys(keep).forEach(function (k) { $(k).value = keep[k]; });
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll(".fam-modes [data-mode]").forEach(function (b) {
      var on = b.getAttribute("data-mode") === m;
      b.classList.toggle("btn--ghost", !on); b.setAttribute("aria-selected", String(on));
    });
    document.querySelectorAll(".fam-birth").forEach(function (x) { x.hidden = m !== "birth"; });
    document.querySelectorAll(".fam-picked").forEach(function (x) { x.hidden = m !== "picked"; });
  }

  function render() {
    $("famList").innerHTML = people.length ? people.map(function (p) {
      var star = [];
      if (p.janma_nak) star.push(tr("Janma: ", "జన్మ: ") + name(NAKSHATRAS_27, p.janma_nak) + (p.janma_pada ? " " + p.janma_pada : ""));
      if (p.janma_rasi) star.push(tr("Rashi: ", "రాశి: ") + name(RASIS_12, p.janma_rasi));
      if (p.birth_lagna) star.push(tr("Lagna: ", "లగ్నం: ") + name(RASIS_12, p.birth_lagna));
      if (p.nama_nak) star.push(tr("Nama: ", "నామ: ") + name(NAKSHATRAS_27, p.nama_nak) + (p.nama_pada ? " " + p.nama_pada : ""));
      var b = p.birth || {};
      var born = b.date ? tr("Born ", "జననం ") + b.date + (b.time ? " " + b.time : b.time_unknown ? tr(" (time not known)", " (సమయం తెలియదు)") : "") + (b.place ? " · " + b.place : "") : "";
      return '<li data-id="' + esc(p.id) + '"><div><strong>' + esc(p.display_name) + "</strong><small>" + esc(tr.apply(null, REL[p.relation] || [p.relation, p.relation])) +
        (p.gotra ? " · " + tr("gotra ", "గోత్రం ") + esc(p.gotra) : "") + (p.is_eldest ? " · " + tr("eldest", "జ్యేష్ఠ") : "") + "</small>" +
        "<span>" + esc(star.join(" · ") || tr("No star yet", "నక్షత్రం లేదు")) + "</span>" + (born ? "<small>" + esc(born) + "</small>" : "") +
        (p.birth_unreadable ? '<small class="vis-off">' + tr("Birth details can't be opened (the data key changed).", "జన్మ వివరాలు తెరవలేకపోయాము (డేటా కీ మారింది).") + "</small>" : "") +
        eventsHTML(p) +
        '</div><div class="acts"><button type="button" class="btn btn--sm btn--ghost" data-edit="' + esc(p.id) + '">' + tr("Edit", "మార్చండి") + "</button>" +
        '<button type="button" class="btn btn--sm btn--ghost" data-remove="' + esc(p.id) + '">' + tr("Remove", "తొలగించండి") + "</button></div></li>";
    }).join("") : '<li class="portal-hint">' + tr("No one saved yet. Add yourself first, then your family.", "ఇంకా ఎవరూ లేరు. ముందు మిమ్మల్ని, తర్వాత కుటుంబ సభ్యులను జోడించండి.") + "</li>";
  }

  // ── Events per person (plan R2) ──
  function title(id) { var r = catalog.find(function (x) { return x.id === id; }); return r ? tr(r.title_en, r.title_te || r.title_en) : id; }
  function eventsHTML(p) {
    var mine = events.filter(function (e) { return e.profile_id === p.id; });
    return '<ul class="fam-events">' + mine.map(function (e) {
      return '<li class="' + (e.status === "cancelled" ? "is-cancelled" : "") + '"><span>' + esc(title(e.activity_id)) + " · " + esc(e.event_date) + (e.event_time ? " " + esc(e.event_time) : "") +
        ' · <span class="status-chip status-chip--' + (e.status === "done" ? "active" : e.status === "planned" ? "pending" : "disabled") + '">' + esc(tr(STATUS[e.status][0], STATUS[e.status][1])) + "</span>" +
        (e.notes ? "<small> " + esc(e.notes) + "</small>" : "") + '</span><span><button type="button" class="linkish" data-ev-edit="' + esc(e.id) + '">' + tr("Edit", "మార్చండి") +
        '</button> <button type="button" class="linkish" data-ev-remove="' + esc(e.id) + '">' + tr("Remove", "తొలగించండి") + "</button></span></li>";
    }).join("") + '<li><button type="button" class="linkish" data-ev-add="' + esc(p.id) + '">+ ' + tr("Add an event (marriage, upanayana…)", "కార్యక్రమం జోడించండి (వివాహం, ఉపనయనం…)") + "</button></li></ul>";
  }
  function eventForm(li, e, profileId) {
    var old = document.querySelector(".fam-ev-form"); if (old) old.remove();
    var opts = catalog.map(function (r) { return '<option value="' + esc(r.id) + '"' + (e && e.activity_id === r.id ? " selected" : "") + ">" + esc(tr(r.title_en, (r.title_te || r.title_en))) + "</option>"; }).join("");
    li.insertAdjacentHTML("beforeend", '<form class="fam-ev-form row-form">' +
      '<select name="activity" aria-label="' + esc(tr("Muhurta", "ముహూర్తం")) + '">' + opts + "</select>" +
      '<input type="date" name="date" required value="' + esc(e ? e.event_date : "") + '" aria-label="' + esc(tr("Date", "తేదీ")) + '">' +
      '<input type="time" name="time" value="' + esc(e && e.event_time || "") + '" aria-label="' + esc(tr("Time", "సమయం")) + '">' +
      '<select name="status" aria-label="' + esc(tr("Status", "స్థితి")) + '">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (e && e.status === k ? " selected" : "") + ">" + esc(tr(STATUS[k][0], STATUS[k][1])) + "</option>"; }).join("") + "</select>" +
      '<input name="notes" maxlength="500" placeholder="' + esc(tr("Notes (optional)", "గమనికలు (ఐచ్ఛికం)")) + '" value="' + esc(e && e.notes || "") + '">' +
      '<button class="btn btn--sm">' + tr("Save", "భద్రపరచండి") + '</button> <button type="button" class="linkish" data-ev-cancel="1">' + tr("Cancel", "రద్దు") + "</button></form>");
    var f = li.querySelector(".fam-ev-form");
    if (!e) { var v = catalog.find(function (r) { return r.id === "vivaha"; }); if (v) f.activity.value = "vivaha"; }
    f.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var body = { profile_id: profileId, activity_id: f.activity.value, event_date: f.date.value, event_time: f.time.value || null,
                   status: f.status.value, notes: f.notes.value.trim() || null };
      try { await api(e ? "PUT" : "POST", e ? "/me/family/events/" + e.id : "/me/family/events", body); say("info", tr("Event saved.", "కార్యక్రమం భద్రపరిచాము.")); load(); }
      catch (err) { say("error", err.message); }
    });
  }

  async function load() {
    try {
      var both = await Promise.all([api("GET", "/me/family"), api("GET", "/me/family/events")]);
      people = both[0].family; events = both[1].events; render();
    }
    catch (e) { $("famList").innerHTML = '<li class="portal-hint">' + esc(e.message) + "</li>"; }
  }

  function openForm(p) {
    editing = p ? p.id : null;
    $("famForm").reset(); fillSelects(); $("fNamaHint").textContent = "";
    $("famFormTitle").textContent = p ? tr("Edit ", "మార్చండి: ") + p.display_name : tr("Add a person", "వ్యక్తిని జోడించండి");
    if (p) {
      $("fName").value = p.display_name; $("fRel").value = p.relation; $("fGender").value = p.gender || ""; $("fGotra").value = p.gotra || "";
      $("fEldest").checked = !!p.is_eldest;
      $("fJanma").value = p.janma_nak || ""; $("fJpada").value = p.janma_pada || ""; $("fRasi").value = p.janma_rasi || ""; $("fLagna").value = p.birth_lagna || "";
      $("fNama").value = p.nama_nak || ""; $("fNpada").value = p.nama_pada || "";
      var b = p.birth || {};
      $("fDob").value = b.date || ""; $("fTob").value = b.time || ""; $("fTunk").checked = !!b.time_unknown;
      var reg = (allRegions || []).find(function (r) { return r.label === b.place || (r.lat === b.lat && r.lon === b.lon); });
      $("fPlace").value = reg ? reg.id : "";
      setMode(p.star_source === "birth" ? "birth" : "picked");
    } else {
      $("fRel").value = people.some(function (x) { return x.relation === "self"; }) ? "spouse" : "self";
      setMode("birth");
    }
    $("famForm").hidden = false; $("fName").focus();
  }

  $("famAdd").addEventListener("click", function () { openForm(null); });
  $("famCancel").addEventListener("click", function () { $("famForm").hidden = true; editing = null; });
  document.querySelector(".fam-modes").addEventListener("click", function (e) { var m = e.target.closest("[data-mode]"); if (m) setMode(m.getAttribute("data-mode")); });

  $("fNamaName").addEventListener("input", function () {
    clearTimeout(lookupTimer);
    var v = this.value.trim();
    if (!v) { $("fNamaHint").textContent = ""; return; }
    lookupTimer = setTimeout(async function () {
      try {
        var d = await api("GET", "/muhurta/nama-nakshatra/lookup?name=" + encodeURIComponent(v));
        if (d.matched && d.result) {
          $("fNama").value = d.result.nakshatra_index; $("fNpada").value = d.result.pada;
          $("fNamaHint").textContent = tr("Set from the first syllable \"" + d.result.matched_syllable + "\". Change it below if your family uses another.",
                                          "మొదటి అక్షరం \"" + d.result.matched_syllable + "\" ఆధారంగా పెట్టాము. మీ పద్ధతి వేరైతే కింద మార్చండి.");
        } else { $("fNamaHint").textContent = tr("No nakshatra matches this name's first syllable. Pick it directly.", "ఈ పేరు మొదటి అక్షరానికి నక్షత్రం సరిపోలలేదు. నేరుగా ఎంచుకోండి."); }
      } catch (err) { $("fNamaHint").textContent = err.message; }
    }, 300);
  });

  $("famForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var num = function (id) { return parseInt($(id).value) || null; };
    var body = { display_name: $("fName").value.trim(), relation: $("fRel").value, gender: $("fGender").value || null,
      gotra: $("fGotra").value.trim() || null, is_eldest: $("fEldest").checked, star_source: mode,
      janma_nak: num("fJanma"), janma_pada: num("fJpada"), janma_rasi: num("fRasi"), birth_lagna: num("fLagna"),
      nama_nak: num("fNama"), nama_pada: num("fNpada") };
    if (!body.display_name) { say("error", tr("Enter the name.", "పేరు నమోదు చేయండి.")); return; }
    if ($("fDob").value) {
      var reg = (allRegions || []).find(function (r) { return r.id === $("fPlace").value; });
      body.birth = { date: $("fDob").value, time: $("fTunk").checked ? null : ($("fTob").value || null), time_unknown: $("fTunk").checked || !$("fTob").value,
                     place: reg ? reg.label : null, lat: reg ? reg.lat : null, lon: reg ? reg.lon : null, tz: reg ? reg.tz_offset : null };
    }
    if (mode === "birth" && !body.birth) { say("error", tr("Enter the birth date, or choose \"I know the nakshatra\".", "పుట్టిన తేదీ ఇవ్వండి, లేదా 'నాకు నక్షత్రం తెలుసు' ఎంచుకోండి.")); return; }
    if (mode === "birth") { body.janma_nak = null; body.janma_pada = null; body.janma_rasi = null; body.birth_lagna = null; }
    try {
      var saved = await api(editing ? "PUT" : "POST", editing ? "/me/family/" + editing : "/me/family", body);
      var w = (saved.warnings || []).join("; ");
      say(w ? "error" : "info", tr("Saved " + saved.display_name + ".", saved.display_name + " భద్రపరిచాము.") + (w ? " " + w : ""));
      $("famForm").hidden = true; editing = null; load();
    } catch (err) { say("error", err.message); }
  });

  $("famList").addEventListener("click", async function (e) {
    var t = e.target, li = t.closest("li[data-id]");
    if (t.getAttribute("data-ev-add")) { eventForm(t.closest("li"), null, t.getAttribute("data-ev-add")); return; }
    if (t.getAttribute("data-ev-edit")) { var ev = events.find(function (x) { return x.id === t.getAttribute("data-ev-edit"); }); if (ev) eventForm(t.closest("li"), ev, ev.profile_id); return; }
    if (t.getAttribute("data-ev-cancel")) { t.closest(".fam-ev-form").remove(); return; }
    if (t.getAttribute("data-ev-remove")) {
      if (t.getAttribute("data-confirm") !== "1") { t.setAttribute("data-confirm", "1"); t.textContent = tr("Remove for good?", "శాశ్వతంగా తొలగించాలా?"); return; }
      try { await api("DELETE", "/me/family/events/" + t.getAttribute("data-ev-remove")); say("info", tr("Event removed.", "కార్యక్రమం తొలగించాము.")); load(); }
      catch (err) { say("error", err.message); }
      return;
    }
    var id = e.target.getAttribute("data-edit");
    if (id) { openForm(people.find(function (p) { return p.id === id; })); return; }
    id = e.target.getAttribute("data-remove");
    if (!id) return;
    if (e.target.getAttribute("data-confirm") !== "1") {
      e.target.setAttribute("data-confirm", "1"); e.target.textContent = tr("Remove for good?", "శాశ్వతంగా తొలగించాలా?");
      e.target.classList.add("btn--danger"); return;
    }
    try { await api("DELETE", "/me/family/" + id); say("info", tr("Removed.", "తొలగించాము.")); load(); }
    catch (err) { say("error", err.message); }
  });

  window.onLangChange = function () { fillSelects(); render(); };
  fillSelects(); setMode("birth");
  loadRegions().then(fillSelects).catch(function () { /* the birth place list stays empty; picking the star still works */ });
  api("GET", "/muhurta/catalog").then(function (c) {
    catalog = (c.all_activities || []).slice().sort(function (a, b) { return a.title_en.localeCompare(b.title_en); });
    render();
  }).catch(function () { /* event titles fall back to ids */ });
  load();
})();
