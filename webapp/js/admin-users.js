// Users page (admin and super admin): search, masked mobiles with a logged reveal, disable / enable.
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var rows = [];
  var ROLE = { user: ["User", "వినియోగదారు"], admin: ["Admin", "నిర్వాహకులు"], super_admin: ["Super admin", "ప్రధాన నిర్వాహకులు"] };
  var STATUS = { active: ["Active", "సక్రియం"], disabled: ["Disabled", "నిలిపివేయబడింది"], pending: ["Sign-up not finished", "నమోదు పూర్తి కాలేదు"] };

  function say(kind, text) { var b = $("usersMsg"); b.hidden = false; b.className = "auth-alert auth-alert--" + kind; b.textContent = text; }

  async function api(method, path, body) {
    var res = await fetch(API_BASE + path, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: data }));
    return data;
  }

  function when(iso) { return iso ? new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : tr("Never", "ఎప్పుడూ లేదు"); }

  function render() {
    $("usersCount").textContent = tr(rows.length + " shown", rows.length + " మంది");
    $("peopleBody").innerHTML = rows.length ? rows.map(function (p) {
      var st = STATUS[p.status] || [p.status, p.status];
      var actions = !p.can_manage ? '<small>' + tr("—", "—") + "</small>" :
        (p.status === "active" ? '<button type="button" class="linkish" data-act="disable" data-id="' + p.id + '">' + tr("Disable", "నిలిపివేయండి") + "</button>" :
         p.status === "disabled" ? '<button type="button" class="linkish" data-act="enable" data-id="' + p.id + '">' + tr("Enable", "ప్రారంభించండి") + "</button>" : "");
      return '<tr data-row="' + p.id + '"><td><strong>' + esc(p.name) + "</strong><small>" + tr(p.devices + " device(s) signed in", p.devices + " పరికరాల్లో లాగిన్") + "</small></td>" +
        '<td><span class="mob">' + esc(p.mobile_masked) + '</span> <button type="button" class="linkish" data-act="reveal" data-id="' + p.id + '">' + tr("Show", "చూపించు") + "</button></td>" +
        "<td>" + esc(tr(ROLE[p.role][0], ROLE[p.role][1])) + "</td>" +
        '<td><span class="status-chip status-chip--' + p.status + '">' + esc(tr(st[0], st[1])) + "</span>" +
        (p.locked ? ' <span class="status-chip status-chip--locked">' + tr("Locked", "లాక్") + "</span>" : "") +
        (p.disabled_reason ? "<small>" + esc(p.disabled_reason) + "</small>" : "") + "</td>" +
        "<td>" + esc(when(p.last_login_at)) + "<small>" + tr(p.login_count + " logins", p.login_count + " లాగిన్లు") + "</small></td>" +
        '<td class="acts">' + actions + (p.can_change_role ? '<br><button type="button" class="linkish" data-act="role" data-role="' +
          (p.role === "admin" ? "user" : "admin") + '" data-id="' + p.id + '">' + (p.role === "admin" ? tr("Remove admin", "నిర్వాహక హోదా తీసివేయండి") : tr("Make admin", "నిర్వాహకులుగా చేయండి")) + "</button>" : "") + "</td></tr>";
    }).join("") : '<tr><td colspan="6" class="portal-hint">' + tr("No one matches.", "ఎవరూ సరిపోలలేదు.") + "</td></tr>";
  }

  async function load() {
    var q = new URLSearchParams();
    if ($("fQ").value.trim()) q.set("q", $("fQ").value.trim());
    if ($("fRole").value) q.set("role", $("fRole").value);
    if ($("fStatus").value) q.set("status", $("fStatus").value);
    try { rows = (await api("GET", "/admin/people?" + q.toString())).people; render(); }
    catch (e) { say("error", e.message); }
  }

  $("filters").addEventListener("submit", function (e) { e.preventDefault(); load(); });

  $("peopleBody").addEventListener("click", async function (e) {
    var act = e.target.getAttribute("data-act"), id = e.target.getAttribute("data-id");
    if (!act) return;
    var row = document.querySelector('tr[data-row="' + id + '"]');
    if (act === "reveal") {
      try { var r = await api("GET", "/admin/people/" + id + "/mobile"); row.querySelector(".mob").textContent = r.mobile; e.target.remove(); }
      catch (err) { say("error", err.message); }
    } else if (act === "disable") {
      var cell = row.querySelector(".acts");
      if (cell.querySelector(".row-form")) return;
      cell.insertAdjacentHTML("beforeend", '<form class="row-form"><input required minlength="3" maxlength="200" placeholder="' +
        esc(tr("Reason (shown to admins)", "కారణం (నిర్వాహకులకు కనిపిస్తుంది)")) + '"><button class="btn btn--sm">' + tr("Disable", "నిలిపివేయండి") +
        '</button><button type="button" class="linkish" data-act="cancel">' + tr("Cancel", "రద్దు") + "</button></form>");
      var f = cell.querySelector(".row-form");
      f.querySelector("input").focus();
      f.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        try {
          var out = await api("POST", "/admin/people/" + id + "/disable", { reason: f.querySelector("input").value.trim() });
          say("info", tr("Disabled. " + out.signed_out_devices + " device(s) signed out.", "నిలిపివేశాము. " + out.signed_out_devices + " పరికరాల నుండి సైన్ అవుట్."));
          load();
        } catch (err) { say("error", err.message); }
      });
    } else if (act === "role") {
      try {
        await api("POST", "/admin/people/" + id + "/role", { role: e.target.getAttribute("data-role") });
        say("info", tr("Role changed. It applies from their next click.", "పాత్ర మార్చాము. వారి తదుపరి చర్య నుండి అమలవుతుంది."));
        load();
      } catch (err) { say("error", err.message); }
    } else if (act === "cancel") {
      e.target.closest(".row-form").remove();
    } else if (act === "enable") {
      try { await api("POST", "/admin/people/" + id + "/enable"); say("info", tr("Enabled.", "ప్రారంభించాము.")); load(); }
      catch (err) { say("error", err.message); }
    }
  });

  var start = new URLSearchParams(window.location.search).get("status");
  if (start) $("fStatus").value = start;
  window.onLangChange = render;
  load();
})();
