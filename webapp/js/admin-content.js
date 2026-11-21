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
  var KIND_EN = { earthquake: "Earthquake", comet: "Comet", meteor: "Meteor shower", thunderbolt: "Thunderbolt", flood: "Flood", fire: "Fire", other: "Other" };
  var omens = [], kinds = [], states = [], anns = [];
  function day(iso) { return new Date(iso + "T12:00:00").toLocaleDateString(currentLang === "te" ? "te-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  function when(iso) { return iso ? new Date(iso).toLocaleString(currentLang === "te" ? "te-IN" : "en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; }

  function renderOmens() {
    var today = new Date().toISOString().slice(0, 10);
    $("omens").innerHTML = omens.map(function (o) {
      var past = (o.end_date || o.event_date) < today;
      return "<li><div><strong>" + esc(day(o.event_date)) + (o.end_date ? " – " + esc(day(o.end_date)) : "") + ' · <span class="omen-kind">' +
        esc(t(KIND_EN[o.kind] || o.kind)) + "</span>" + (past ? ' <span class="status-chip status-chip--disabled">' + t("past") + "</span>" : "") +
        "</strong><small>" + esc(tr(o.description_en || o.description_te, o.description_te || o.description_en)) + " · " + (o.region ? esc(t("only in {region}", { region: o.region })) : t("everywhere")) +
        "</small><small>" + t("Source: ") + esc(o.source) + " · " + t("added by ") + esc(o.added_by) + "</small></div>" +
        '<button type="button" class="btn btn--sm btn--ghost" data-omen="' + o.id + '">' + t("Remove") + "</button></li>";
    }).join("") || '<li class="empty-state">' + t("No omens recorded for the last 90 days or ahead.") + "</li>";
    var sel = $("omKind"), cur = sel.value;
    sel.innerHTML = kinds.map(function (k) { return '<option value="' + k + '">' + esc(t(KIND_EN[k] || k)) + "</option>"; }).join("");
    if (cur) sel.value = cur;
    // Omens by state (plan F2, G2): a state's omen applies only to searches in that state.
    var rs = $("omRegion"), rcur = rs.value;
    rs.innerHTML = '<option value="">' + esc(t("Everywhere")) + "</option>" +
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
    if (!(await AppShell.confirm(t("Remove this omen? Muhurtas on these dates will no longer fail #15."),
                                 { ok: t("Remove"), cancel: t("Keep it"), danger: true }))) return;
    try { await api("DELETE", "/admin/omens/" + id); say("info", t("Omen removed.")); loadOmens(); }
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
        ? t("Omen added. Muhurta searches in {where} on these dates now fail Mahadosha #15.", { where: where })
        : t("Omen added. Muhurta searches on these dates now fail Mahadosha #15."));
      loadOmens();
    } catch (err) { say("error", err.message); }
  });

  var STATUS = { showing: ["Showing", "active"], scheduled: ["Scheduled", "pending"], ended: ["Ended", "disabled"] };
  var AUD = { all: ["Everyone"], users: ["Users"], admins: ["Admins"] };
  function renderAnns() {
    $("anns").innerHTML = anns.map(function (a) {
      var st = STATUS[a.status];
      return "<li><div><strong>" + esc(tr(a.title_en || a.title_te, a.title_te || a.title_en)) + ' <span class="status-chip status-chip--' + st[2] + '">' + t(st) + "</span></strong>" +
        "<small>" + esc(t(AUD[a.audience])) + " · " + esc(when(a.starts_at)) + (a.ends_at ? " → " + esc(when(a.ends_at)) : "") + " · " + esc(a.added_by) + "</small></div>" +
        (a.status !== "ended" ? '<button type="button" class="btn btn--sm btn--ghost" data-ann="' + a.id + '">' + t("Stop showing") + "</button>" : "") + "</li>";
    }).join("") || '<li class="empty-state">' + t("No announcements yet.") + "</li>";
  }
  async function loadAnns() {
    try { anns = (await api("GET", "/admin/announcements")).announcements; renderAnns(); }
    catch (e) { $("anns").innerHTML = "<li>" + esc(e.message) + "</li>"; }
  }
  $("anns").addEventListener("click", async function (e) {
    var id = e.target.getAttribute("data-ann");
    if (!id) return;
    try { await api("POST", "/admin/announcements/" + id + "/end"); say("info", t("Announcement stopped.")); loadAnns(); }
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
      say("info", t("Announcement published."));
      loadAnns();
    } catch (err) { say("error", err.message); }
  });

  window.onLangChange = function () { renderOmens(); renderAnns(); };
  loadOmens(); loadAnns();
})();
