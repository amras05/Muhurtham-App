// Admin content: the omen (utpata) calendar for Mahadosha #15, and home-page announcements.
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function say(kind, text) { var b = $("contentMsg"); b.hidden = false; b.className = "auth-alert auth-alert--" + kind; b.textContent = text; b.scrollIntoView({ block: "nearest" }); }
  async function api(method, path, body) {
    var res = await fetch(API_BASE + path, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: data }));
    return data;
  }
  var KIND_TE = { earthquake: "భూకంపం", comet: "తోకచుక్క", meteor: "ఉల్కాపాతం", thunderbolt: "పిడుగు", flood: "వరద", fire: "అగ్ని ప్రమాదం", other: "ఇతర" };
  var KIND_EN = { earthquake: "Earthquake", comet: "Comet", meteor: "Meteor shower", thunderbolt: "Thunderbolt", flood: "Flood", fire: "Fire", other: "Other" };
  var omens = [], kinds = [], states = [], anns = [];
  function day(iso) { return new Date(iso + "T12:00:00").toLocaleDateString(currentLang === "te" ? "te-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  function when(iso) { return iso ? new Date(iso).toLocaleString(currentLang === "te" ? "te-IN" : "en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; }

  function renderOmens() {
    var today = new Date().toISOString().slice(0, 10);
    $("omens").innerHTML = omens.map(function (o) {
      var past = (o.end_date || o.event_date) < today;
      return "<li><div><strong>" + esc(day(o.event_date)) + (o.end_date ? " – " + esc(day(o.end_date)) : "") + ' · <span class="omen-kind">' +
        esc(tr(KIND_EN[o.kind] || o.kind, KIND_TE[o.kind] || o.kind)) + "</span>" + (past ? ' <span class="status-chip status-chip--disabled">' + tr("past", "గతం") + "</span>" : "") +
        "</strong><small>" + esc(tr(o.description_en || o.description_te, o.description_te || o.description_en)) + " · " + (o.region ? esc(tr("only in " + o.region, o.region + "లో మాత్రమే")) : tr("everywhere", "అన్ని ప్రాంతాలు")) +
        "</small><small>" + tr("Source: ", "ఆధారం: ") + esc(o.source) + " · " + tr("added by ", "జోడించినవారు ") + esc(o.added_by) + "</small></div>" +
        '<button type="button" class="btn btn--sm btn--ghost" data-omen="' + o.id + '">' + tr("Remove", "తొలగించండి") + "</button></li>";
    }).join("") || '<li class="empty-state">' + tr("No omens recorded for the last 90 days or ahead.", "గత 90 రోజులు లేదా రాబోయే రోజులకు ఉత్పాతాలు నమోదు కాలేదు.") + "</li>";
    var sel = $("omKind"), cur = sel.value;
    sel.innerHTML = kinds.map(function (k) { return '<option value="' + k + '">' + esc(tr(KIND_EN[k] || k, KIND_TE[k] || k)) + "</option>"; }).join("");
    if (cur) sel.value = cur;
    // Omens by state (plan F2, G2): a state's omen applies only to searches in that state.
    var rs = $("omRegion"), rcur = rs.value;
    rs.innerHTML = '<option value="">' + esc(tr("Everywhere", "అన్ని ప్రాంతాలు")) + "</option>" +
      states.map(function (st) { return '<option value="' + esc(st) + '">' + esc(st) + "</option>"; }).join("");
    rs.value = rcur;
  }
  async function loadOmens() {
    try { var r = await api("GET", "/admin/omens"); omens = r.omens; kinds = r.kinds; states = r.states || []; renderOmens(); }
    catch (e) { $("omens").innerHTML = "<li>" + esc(e.message) + "</li>"; }
  }
  $("omens").addEventListener("click", async function (e) {
    var id = e.target.getAttribute("data-omen");
    if (!id) return;
    if (!(await AppShell.confirm(tr("Remove this omen? Muhurtas on these dates will no longer fail #15.", "ఈ ఉత్పాతాన్ని తొలగించాలా? ఈ తేదీల ముహూర్తాలు ఇక #15 వల్ల తిరస్కరించబడవు."),
                                 { ok: tr("Remove", "తొలగించు"), cancel: tr("Keep it", "ఉంచు"), danger: true }))) return;
    try { await api("DELETE", "/admin/omens/" + id); say("info", tr("Omen removed.", "ఉత్పాతం తొలగించాము.")); loadOmens(); }
    catch (err) { say("error", err.message); }
  });
  $("omenForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    try {
      await api("POST", "/admin/omens", {
        event_date: $("omFrom").value, end_date: $("omTo").value || null, kind: $("omKind").value,
        description_en: $("omEn").value.trim() || null, description_te: $("omTe").value.trim() || null,
        region: $("omRegion").value || null, source: $("omSource").value.trim(),
      });
      var where = $("omRegion").value;
      e.target.reset();
      say("info", where
        ? tr("Omen added. Muhurta searches in " + where + " on these dates now fail Mahadosha #15.", "ఉత్పాతం జోడించాము. ఈ తేదీలలో " + where + "లోని ముహూర్తాలు ఇప్పుడు మహాదోషం #15 వల్ల తిరస్కరించబడతాయి.")
        : tr("Omen added. Muhurta searches on these dates now fail Mahadosha #15.", "ఉత్పాతం జోడించాము. ఈ తేదీల ముహూర్తాలు ఇప్పుడు మహాదోషం #15 వల్ల తిరస్కరించబడతాయి."));
      loadOmens();
    } catch (err) { say("error", err.message); }
  });

  var STATUS = { showing: ["Showing", "చూపుతోంది", "active"], scheduled: ["Scheduled", "షెడ్యూల్", "pending"], ended: ["Ended", "ముగిసింది", "disabled"] };
  var AUD = { all: ["Everyone", "అందరికీ"], users: ["Users", "వినియోగదారులు"], admins: ["Admins", "నిర్వాహకులు"] };
  function renderAnns() {
    $("anns").innerHTML = anns.map(function (a) {
      var st = STATUS[a.status];
      return "<li><div><strong>" + esc(tr(a.title_en || a.title_te, a.title_te || a.title_en)) + ' <span class="status-chip status-chip--' + st[2] + '">' + tr(st[0], st[1]) + "</span></strong>" +
        "<small>" + esc(tr(AUD[a.audience][0], AUD[a.audience][1])) + " · " + esc(when(a.starts_at)) + (a.ends_at ? " → " + esc(when(a.ends_at)) : "") + " · " + esc(a.added_by) + "</small></div>" +
        (a.status !== "ended" ? '<button type="button" class="btn btn--sm btn--ghost" data-ann="' + a.id + '">' + tr("Stop showing", "చూపడం ఆపండి") + "</button>" : "") + "</li>";
    }).join("") || '<li class="empty-state">' + tr("No announcements yet.", "ఇంకా ప్రకటనలు లేవు.") + "</li>";
  }
  async function loadAnns() {
    try { anns = (await api("GET", "/admin/announcements")).announcements; renderAnns(); }
    catch (e) { $("anns").innerHTML = "<li>" + esc(e.message) + "</li>"; }
  }
  $("anns").addEventListener("click", async function (e) {
    var id = e.target.getAttribute("data-ann");
    if (!id) return;
    try { await api("POST", "/admin/announcements/" + id + "/end"); say("info", tr("Announcement stopped.", "ప్రకటన ఆపాము.")); loadAnns(); }
    catch (err) { say("error", err.message); }
  });
  $("annForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var ends = $("anEnds").value;
    try {
      await api("POST", "/admin/announcements", {
        title_en: $("anTitleEn").value.trim() || null, title_te: $("anTitleTe").value.trim() || null,
        body_en: $("anBodyEn").value.trim() || null, body_te: $("anBodyTe").value.trim() || null,
        audience: $("anAudience").value,
        ends_at: ends ? new Date(ends + "T23:59:59").toISOString() : null,   // end of that day, local time
      });
      e.target.reset();
      say("info", tr("Announcement published.", "ప్రకటన ప్రచురించాము."));
      loadAnns();
    } catch (err) { say("error", err.message); }
  });

  window.onLangChange = function () { renderOmens(); renderAnns(); };
  loadOmens(); loadAnns();
})();
