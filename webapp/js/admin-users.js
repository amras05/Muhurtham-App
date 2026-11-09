// Users page (admin and super admin): search, masked mobiles with a logged reveal, disable / enable,
// several at once; the super admin also adds, edits and deletes people (plan R9).
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var rows = [], selected = {}, canCreate = false;
  var ROLE = { user: ["User", "వినియోగదారు"], admin: ["Admin", "నిర్వాహకులు"], super_admin: ["Super admin", "ప్రధాన నిర్వాహకులు"] };
  var STATUS = { active: ["Active", "సక్రియం"], disabled: ["Disabled", "నిలిపివేయబడింది"], pending: ["Sign-up not finished", "నమోదు పూర్తి కాలేదు"],
                 invited: ["Invited", "ఆహ్వానించబడ్డారు"] };

  function say(kind, text) { var b = $("usersMsg"); b.hidden = false; b.className = "auth-alert auth-alert--" + kind; b.textContent = text; b.scrollIntoView({ block: "nearest" }); }

  async function api(method, path, body) {
    var res = await fetch(API_BASE + path, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: data }));
    return data;
  }

  function when(iso) { return iso ? new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : tr("Never", "ఎప్పుడూ లేదు"); }
  function link(act, id, en, te, extra) { return '<button type="button" class="linkish" data-act="' + act + '" data-id="' + id + '"' + (extra || "") + ">" + tr(en, te) + "</button>"; }

  function render() {
    $("usersCount").textContent = tr(rows.length + " shown", rows.length + " మంది");
    $("addPersonBtn").hidden = !canCreate;
    $("peopleBody").innerHTML = rows.length ? rows.map(function (p) {
      var st = STATUS[p.status] || [p.status, p.status];
      var acts = [];
      if (p.can_manage && p.status === "active") acts.push(link("disable", p.id, "Disable", "నిలిపివేయండి"));
      if (p.can_manage && p.status === "disabled") acts.push(link("enable", p.id, "Enable", "ప్రారంభించండి"));
      if (p.can_change_role) acts.push(link("role", p.id, p.role === "admin" ? "Remove admin" : "Make admin",
        p.role === "admin" ? "నిర్వాహక హోదా తీసివేయండి" : "నిర్వాహకులుగా చేయండి", ' data-role="' + (p.role === "admin" ? "user" : "admin") + '"'));
      if (p.can_edit) acts.push(link("edit", p.id, "Edit", "మార్చండి"));
      if (p.can_delete) acts.push(link("delete", p.id, "Delete", "తొలగించండి"));
      var box = p.can_manage ? '<input type="checkbox" data-sel="' + p.id + '"' + (selected[p.id] ? " checked" : "") + ' aria-label="' + esc(tr("Select ", "ఎంచుకోండి ") + p.name) + '">' : "";
      return '<tr data-row="' + p.id + '"><td>' + box + "</td><td><strong>" + esc(p.name) + "</strong><small>" + tr(p.devices + " device(s) signed in", p.devices + " పరికరాల్లో లాగిన్") + "</small></td>" +
        '<td><span class="mob">' + esc(p.mobile_masked) + "</span> " + link("reveal", p.id, "Show", "చూపించు") + "</td>" +
        "<td>" + esc(tr(ROLE[p.role][0], ROLE[p.role][1])) + "</td>" +
        '<td><span class="status-chip status-chip--' + p.status + '">' + esc(tr(st[0], st[1])) + "</span>" +
        (p.locked ? ' <span class="status-chip status-chip--locked">' + tr("Locked", "లాక్") + "</span>" : "") +
        (p.disabled_reason ? "<small>" + esc(p.disabled_reason) + "</small>" : "") + "</td>" +
        "<td>" + esc(when(p.last_login_at)) + "<small>" + tr(p.login_count + " logins", p.login_count + " లాగిన్లు") + "</small></td>" +
        '<td class="acts">' + (acts.length ? acts.join("<br>") : "<small>—</small>") + "</td></tr>";
    }).join("") : '<tr><td colspan="7" class="portal-hint">' + tr("No one matches.", "ఎవరూ సరిపోలలేదు.") + "</td></tr>";
    renderBulk();
  }

  function renderBulk() {
    var ids = Object.keys(selected);
    $("bulkBar").hidden = ids.length === 0;
    $("bulkCount").textContent = tr(ids.length + " selected", ids.length + " మంది ఎంచుకున్నారు");
    $("bulkReason").placeholder = tr("Reason for disabling", "నిలిపివేయడానికి కారణం");
    var manageable = rows.filter(function (p) { return p.can_manage; });
    $("selAll").checked = manageable.length > 0 && manageable.every(function (p) { return selected[p.id]; });
  }

  async function load() {
    var q = new URLSearchParams();
    if ($("fQ").value.trim()) q.set("q", $("fQ").value.trim());
    if ($("fRole").value) q.set("role", $("fRole").value);
    if ($("fStatus").value) q.set("status", $("fStatus").value);
    try {
      var r = await api("GET", "/admin/people?" + q.toString());
      rows = r.people; canCreate = !!r.can_create;
      var shown = {}; rows.forEach(function (p) { shown[p.id] = true; });
      Object.keys(selected).forEach(function (id) { if (!shown[id]) delete selected[id]; });
      render();
    } catch (e) { say("error", e.message); }
  }

  $("filters").addEventListener("submit", function (e) { e.preventDefault(); load(); });

  // ── Add a person (super admin) ──
  $("addPersonBtn").addEventListener("click", function () { $("addPersonForm").hidden = false; $("apName").focus(); });
  $("apCancel").addEventListener("click", function () { $("addPersonForm").reset(); $("addPersonForm").hidden = true; });
  $("addPersonForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    try {
      await api("POST", "/admin/people", { name: $("apName").value.trim(), phone: $("apPhone").value.trim(),
                                           role: $("apRole").value, preferred_language: $("apLang").value });
      say("info", tr("Added. Ask them to open the login page, choose \"Forgot password\" and set a password with the WhatsApp code.",
                     "జోడించాము. లాగిన్ పేజీలో 'పాస్‌వర్డ్ మర్చిపోయారా' ఎంచుకుని వాట్సాప్ కోడ్‌తో పాస్‌వర్డ్ పెట్టుకోమని చెప్పండి."));
      $("addPersonForm").reset(); $("addPersonForm").hidden = true;
      $("fStatus").value = ""; load();
    } catch (err) { say("error", err.message); }
  });

  // ── Several at once ──
  $("peopleBody").addEventListener("change", function (e) {
    var id = e.target.getAttribute("data-sel");
    if (!id) return;
    if (e.target.checked) selected[id] = true; else delete selected[id];
    renderBulk();
  });
  $("selAll").addEventListener("change", function (e) {
    rows.forEach(function (p) { if (p.can_manage) { if (e.target.checked) selected[p.id] = true; else delete selected[p.id]; } });
    render();
  });
  $("bulkBar").addEventListener("submit", function (e) { e.preventDefault(); });
  $("bulkBar").addEventListener("click", async function (e) {
    var act = e.target.closest("[data-bulk]") && e.target.closest("[data-bulk]").getAttribute("data-bulk");
    if (!act) return;
    if (act === "clear") { selected = {}; render(); return; }
    var reason = $("bulkReason").value.trim();
    if (act === "disable" && reason.length < 3) { say("error", tr("Write a reason (at least 3 letters) before disabling.", "నిలిపివేసే ముందు కారణం రాయండి (కనీసం 3 అక్షరాలు).")); $("bulkReason").focus(); return; }
    try {
      var out = await api("POST", "/admin/people/bulk", { ids: Object.keys(selected), action: act, reason: act === "disable" ? reason : undefined });
      var msg = tr(out.done.length + " done.", out.done.length + " పూర్తయ్యాయి.");
      if (out.skipped.length) msg += " " + tr(out.skipped.length + " skipped: ", out.skipped.length + " వదిలేశాము: ") +
        out.skipped.map(function (s) { var p = rows.find(function (x) { return x.id === s.id; }); return (p ? p.name : s.id) + " (" + s.why + ")"; }).join("; ");
      say(out.skipped.length ? "error" : "info", msg);
      selected = {}; $("bulkReason").value = ""; load();
    } catch (err) { say("error", err.message); }
  });

  // ── Row actions ──
  function rowForm(row, html) {
    var cell = row.querySelector(".acts");
    var old = cell.querySelector(".row-form");
    if (old) old.remove();
    cell.insertAdjacentHTML("beforeend", '<form class="row-form">' + html + ' <button type="button" class="linkish" data-act="cancel">' + tr("Cancel", "రద్దు") + "</button></form>");
    var f = cell.querySelector(".row-form");
    var first = f.querySelector("input"); if (first) first.focus();
    return f;
  }

  $("peopleBody").addEventListener("click", async function (e) {
    var act = e.target.getAttribute("data-act"), id = e.target.getAttribute("data-id");
    if (!act) return;
    var row = e.target.closest("tr");
    var p = rows.find(function (x) { return x.id === id; });
    if (act === "cancel") { e.target.closest(".row-form").remove(); return; }
    if (act === "reveal") {
      try { var r = await api("GET", "/admin/people/" + id + "/mobile"); row.querySelector(".mob").textContent = r.mobile; e.target.remove(); }
      catch (err) { say("error", err.message); }
    } else if (act === "disable") {
      var f = rowForm(row, '<input required minlength="3" maxlength="200" placeholder="' + esc(tr("Reason (shown to admins)", "కారణం (నిర్వాహకులకు కనిపిస్తుంది)")) +
        '"><button class="btn btn--sm">' + tr("Disable", "నిలిపివేయండి") + "</button>");
      f.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        try {
          var out = await api("POST", "/admin/people/" + id + "/disable", { reason: f.querySelector("input").value.trim() });
          say("info", tr("Disabled. " + out.signed_out_devices + " device(s) signed out.", "నిలిపివేశాము. " + out.signed_out_devices + " పరికరాల నుండి సైన్ అవుట్."));
          load();
        } catch (err) { say("error", err.message); }
      });
    } else if (act === "enable") {
      try { await api("POST", "/admin/people/" + id + "/enable"); say("info", tr("Enabled.", "ప్రారంభించాము.")); load(); }
      catch (err) { say("error", err.message); }
    } else if (act === "role") {
      try {
        await api("POST", "/admin/people/" + id + "/role", { role: e.target.getAttribute("data-role") });
        say("info", tr("Role changed. It applies from their next click.", "పాత్ర మార్చాము. వారి తదుపరి చర్య నుండి అమలవుతుంది."));
        load();
      } catch (err) { say("error", err.message); }
    } else if (act === "edit" && p) {
      var ef = rowForm(row,
        '<input name="name" required minlength="2" maxlength="80" value="' + esc(p.name) + '" aria-label="' + esc(tr("Name", "పేరు")) + '">' +
        '<input name="phone" inputmode="tel" maxlength="20" placeholder="' + esc(tr("New mobile (leave empty to keep)", "కొత్త మొబైల్ (మార్చకపోతే ఖాళీగా)")) + '" aria-label="' + esc(tr("New mobile", "కొత్త మొబైల్")) + '">' +
        '<select name="lang" aria-label="' + esc(tr("Language", "భాష")) + '"><option value="">' + tr("Language: keep", "భాష: మార్చవద్దు") + '</option><option value="te">తెలుగు</option><option value="en">English</option></select>' +
        '<button class="btn btn--sm">' + tr("Save", "భద్రపరచండి") + "</button>");
      ef.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var body = { name: ef.name.value.trim() };
        if (ef.phone.value.trim()) body.phone = ef.phone.value.trim();
        if (ef.lang.value) body.preferred_language = ef.lang.value;
        try {
          var out = await api("PUT", "/admin/people/" + id, body);
          say("info", out.needs_confirmation
            ? tr("Saved. They are signed out and must confirm the new number: login page → \"Forgot password\".", "భద్రపరిచాము. వారు సైన్ అవుట్ అయ్యారు; కొత్త నంబర్‌ను 'పాస్‌వర్డ్ మర్చిపోయారా' ద్వారా నిర్ధారించుకోవాలి.")
            : tr("Saved.", "భద్రపరిచాము."));
          load();
        } catch (err) { say("error", err.message); }
      });
    } else if (act === "delete" && p) {
      var df = rowForm(row,
        "<small>" + esc(tr("This removes their name, mobile, family details and saved muhurtas. It can't be undone. Type their name to confirm:",
                           "ఇది వారి పేరు, మొబైల్, కుటుంబ వివరాలు, భద్రపరిచిన ముహూర్తాలను తొలగిస్తుంది. తిరిగి పొందలేము. నిర్ధారించడానికి వారి పేరు టైప్ చేయండి:")) + "</small>" +
        '<input required maxlength="80" placeholder="' + esc(p.name) + '" aria-label="' + esc(tr("Type the name to confirm", "నిర్ధారణకు పేరు టైప్ చేయండి")) + '">' +
        '<button class="btn btn--sm btn--danger">' + tr("Delete for good", "శాశ్వతంగా తొలగించండి") + "</button>");
      df.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        try {
          await api("POST", "/admin/people/" + id + "/delete", { confirm_name: df.querySelector("input").value.trim() });
          say("info", tr("Deleted. The activity log keeps a record that the account existed.", "తొలగించాము. ఖాతా ఉండేదని కార్యకలాపాల లాగ్‌లో నమోదు ఉంటుంది."));
          delete selected[id]; load();
        } catch (err) { say("error", err.message); }
      });
    }
  });

  var start = new URLSearchParams(window.location.search).get("status");
  if (start) $("fStatus").value = start;
  window.onLangChange = render;
  load();
})();
