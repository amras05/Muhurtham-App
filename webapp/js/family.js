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
  var REL = { self: ["Me"], spouse: ["Spouse"], son: ["Son"], daughter: ["Daughter"],
    father: ["Father"], mother: ["Mother"], brother: ["Brother"], sister: ["Sister"],
    grandchild: ["Grandchild"], other: ["Other"] };
  var people = [], editing = null, mode = "birth", lookupTimer = null, events = [], catalog = [];
  var STATUS = { planned: ["Planned"], done: ["Done"], cancelled: ["Cancelled"] };

  function name(list, idx) { var x = idx && list[idx - 1]; return x ? tr(x.en, x.te) : ""; }
  function opts(list, placeholder) {
    return '<option value="">' + esc(placeholder) + "</option>" + list.map(function (x) { return '<option value="' + x.id + '">' + esc(tr(x.en + " · " + x.te, x.te + " (" + x.en + ")")) + "</option>"; }).join("");
  }
  function fillSelects() {
    var keep = {};
    ["fJanma", "fJpada", "fRasi", "fLagna", "fNama", "fNpada", "fPlace"].forEach(function (k) { keep[k] = $(k).value; });
    var notKnown = t("— Not known —");
    var padas = [1, 2, 3, 4].map(function (n) { return { id: n, en: "Pada " + n, te: n + "వ పాదం" }; });
    $("fJanma").innerHTML = opts(NAKSHATRAS_27, notKnown); $("fNama").innerHTML = opts(NAKSHATRAS_27, notKnown);
    $("fRasi").innerHTML = opts(RASIS_12, notKnown); $("fLagna").innerHTML = opts(RASIS_12, notKnown);
    $("fJpada").innerHTML = opts(padas, "—"); $("fNpada").innerHTML = opts(padas, "—");
    $("fPlace").innerHTML = '<option value="">' + esc(t("— Choose the birth place —")) + "</option>" +
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
      if (p.janma_nak) star.push(t("Janma: ") + name(NAKSHATRAS_27, p.janma_nak) + (p.janma_pada ? " " + p.janma_pada : ""));
      if (p.janma_rasi) star.push(t("Rashi: ") + name(RASIS_12, p.janma_rasi));
      if (p.birth_lagna) star.push(t("Lagna: ") + name(RASIS_12, p.birth_lagna));
      if (p.nama_nak) star.push(t("Nama: ") + name(NAKSHATRAS_27, p.nama_nak) + (p.nama_pada ? " " + p.nama_pada : ""));
      var b = p.birth || {};
      var born = b.date ? t("Born ") + b.date + (b.time ? " " + b.time : b.time_unknown ? t(" (time not known)") : "") + (b.place ? " · " + b.place : "") : "";
      return '<li data-id="' + esc(p.id) + '"><div><strong>' + esc(p.display_name) + "</strong><small>" + esc(tr.apply(null, REL[p.relation] || [p.relation, p.relation])) +
        (p.gotra ? " · " + t("gotra ") + esc(p.gotra) : "") + (p.is_eldest ? " · " + t("eldest") : "") + "</small>" +
        "<span>" + esc(star.join(" · ") || t("No star yet")) + "</span>" + (born ? "<small>" + esc(born) + "</small>" : "") +
        (p.birth_unreadable ? '<small class="vis-off">' + t("Birth details can't be opened (the data key changed).") + "</small>" : "") +
        eventsHTML(p) +
        '</div><div class="acts"><button type="button" class="btn btn--sm btn--ghost" data-edit="' + esc(p.id) + '">' + t("Edit") + "</button>" +
        '<button type="button" class="btn btn--sm btn--ghost" data-remove="' + esc(p.id) + '">' + t("Remove") + "</button></div></li>";
    }).join("") : '<li class="empty-state"><p>' + t("No one saved yet. Add yourself first, then your family.") +
      '</p><button type="button" class="btn btn--sm" onclick="document.getElementById(\'famAdd\').click()">' + t("Add a person") + "</button></li>";
  }

  // ── Events per person (plan R2) ──
  function title(id) { var r = catalog.find(function (x) { return x.id === id; }); return r ? tr(r.title_en, r.title_te || r.title_en) : id; }
  function eventsHTML(p) {
    var mine = events.filter(function (e) { return e.profile_id === p.id; });
    return '<ul class="fam-events">' + mine.map(function (e) {
      return '<li class="' + (e.status === "cancelled" ? "is-cancelled" : "") + '"><span>' + esc(title(e.activity_id)) + " · " + esc(e.event_date) + (e.event_time ? " " + esc(e.event_time) : "") +
        ' · <span class="status-chip status-chip--' + (e.status === "done" ? "active" : e.status === "planned" ? "pending" : "disabled") + '">' + esc(t(STATUS[e.status])) + "</span>" +
        (e.notes ? "<small> " + esc(e.notes) + "</small>" : "") + '</span><span><button type="button" class="linkish" data-ev-edit="' + esc(e.id) + '">' + t("Edit") +
        '</button> <button type="button" class="linkish" data-ev-remove="' + esc(e.id) + '">' + t("Remove") + "</button></span></li>";
    }).join("") + '<li><button type="button" class="linkish" data-ev-add="' + esc(p.id) + '">+ ' + t("Add an event (marriage, upanayana…)") + "</button></li></ul>";
  }
  function eventForm(li, e, profileId) {
    var old = document.querySelector(".fam-ev-form"); if (old) old.remove();
    var opts = catalog.map(function (r) { return '<option value="' + esc(r.id) + '"' + (e && e.activity_id === r.id ? " selected" : "") + ">" + esc(tr(r.title_en, (r.title_te || r.title_en))) + "</option>"; }).join("");
    li.insertAdjacentHTML("beforeend", '<form class="fam-ev-form row-form">' +
      '<select name="activity" aria-label="' + esc(t("Muhurta")) + '">' + opts + "</select>" +
      '<input type="date" name="date" required value="' + esc(e ? e.event_date : "") + '" aria-label="' + esc(t("Date")) + '">' +
      '<input type="time" name="time" value="' + esc(e && e.event_time || "") + '" aria-label="' + esc(t("Time")) + '">' +
      '<select name="status" aria-label="' + esc(t("Status")) + '">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (e && e.status === k ? " selected" : "") + ">" + esc(t(STATUS[k])) + "</option>"; }).join("") + "</select>" +
      '<input name="notes" maxlength="500" placeholder="' + esc(t("Notes (optional)")) + '" value="' + esc(e && e.notes || "") + '">' +
      '<button class="btn btn--sm">' + t("Save") + '</button> <button type="button" class="linkish" data-ev-cancel="1">' + t("Cancel") + "</button></form>");
    var f = li.querySelector(".fam-ev-form");
    if (!e) { var v = catalog.find(function (r) { return r.id === "vivaha"; }); if (v) f.activity.value = "vivaha"; }
    f.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var body = { profile_id: profileId, activity_id: f.activity.value, event_date: f.date.value, event_time: f.time.value || null,
                   status: f.status.value, notes: f.notes.value.trim() || null };
      try { await api(e ? "PUT" : "POST", e ? "/me/family/events/" + e.id : "/me/family/events", body); say("info", t("Event saved.")); load(); }
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
    $("famFormTitle").textContent = p ? t("Edit ") + p.display_name : t("Add a person");
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
          $("fNamaHint").textContent = t("Set from the first syllable \"{matched_syllable}\". Change it below if your family uses another.", { matched_syllable: d.result.matched_syllable });
        } else { $("fNamaHint").textContent = t("No nakshatra matches this name's first syllable. Pick it directly."); }
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
    if (!body.display_name) { say("error", t("Enter the name.")); return; }
    if ($("fDob").value) {
      var reg = (allRegions || []).find(function (r) { return r.id === $("fPlace").value; });
      body.birth = { date: $("fDob").value, time: $("fTunk").checked ? null : ($("fTob").value || null), time_unknown: $("fTunk").checked || !$("fTob").value,
                     place: reg ? reg.label : null, lat: reg ? reg.lat : null, lon: reg ? reg.lon : null, tz: reg ? reg.tz_offset : null };
    }
    if (mode === "birth" && !body.birth) { say("error", t("Enter the birth date, or choose \"I know the nakshatra\".")); return; }
    if (mode === "birth") { body.janma_nak = null; body.janma_pada = null; body.janma_rasi = null; body.birth_lagna = null; }
    try {
      var saved = await api(editing ? "PUT" : "POST", editing ? "/me/family/" + editing : "/me/family", body);
      var w = (saved.warnings || []).join("; ");
      say(w ? "error" : "info", t("Saved {display_name}.", { display_name: saved.display_name }) + (w ? " " + w : ""));
      $("famForm").hidden = true; editing = null; load();
    } catch (err) { say("error", err.message); }
  });

  $("famList").addEventListener("click", async function (e) {
    var tv = e.target, li = tv.closest("li[data-id]");
    if (tv.getAttribute("data-ev-add")) { eventForm(tv.closest("li"), null, tv.getAttribute("data-ev-add")); return; }
    if (tv.getAttribute("data-ev-edit")) { var ev = events.find(function (x) { return x.id === tv.getAttribute("data-ev-edit"); }); if (ev) eventForm(tv.closest("li"), ev, ev.profile_id); return; }
    if (tv.getAttribute("data-ev-cancel")) { tv.closest(".fam-ev-form").remove(); return; }
    if (tv.getAttribute("data-ev-remove")) {
      if (tv.getAttribute("data-confirm") !== "1") { tv.setAttribute("data-confirm", "1"); tv.textContent = t("Remove for good?"); return; }
      try { await api("DELETE", "/me/family/events/" + tv.getAttribute("data-ev-remove")); say("info", t("Event removed.")); load(); }
      catch (err) { say("error", err.message); }
      return;
    }
    var id = e.target.getAttribute("data-edit");
    if (id) { openForm(people.find(function (p) { return p.id === id; })); return; }
    id = e.target.getAttribute("data-remove");
    if (!id) return;
    if (e.target.getAttribute("data-confirm") !== "1") {
      e.target.setAttribute("data-confirm", "1"); e.target.textContent = t("Remove for good?");
      e.target.classList.add("btn--danger"); return;
    }
    try { await api("DELETE", "/me/family/" + id); say("info", t("Removed.")); load(); }
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
