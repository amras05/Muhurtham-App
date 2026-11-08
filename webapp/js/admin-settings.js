// Super admin settings: app switches, system health, admins, full activity log.
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function say(kind, text) { var b = $("setMsg"); b.hidden = false; b.className = "auth-alert auth-alert--" + kind; b.textContent = text; }
  async function api(method, path, body) {
    var res = await fetch(API_BASE + path, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: data }));
    return data;
  }
  var nextBefore = null, logItems = [];

  async function loadSettings() {
    try {
      var s = await api("GET", "/admin/settings");
      $("stSignup").checked = !!s.signup_open;
      $("stMaint").checked = !!s.maintenance_mode;
      $("stMsg").value = s.maintenance_message || "";
    } catch (e) { say("error", e.message); }
  }
  $("settingsForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    try {
      await api("PUT", "/admin/settings", { signup_open: $("stSignup").checked, maintenance_mode: $("stMaint").checked,
                                            maintenance_message: $("stMsg").value.trim() || undefined });
      say("info", tr("Saved. Every page follows within 15 seconds.", "భద్రపరచాము. 15 సెకన్లలో అన్ని పేజీలకు అమలవుతుంది."));
      loadLog(true);
    } catch (err) { say("error", err.message); }
  });

  async function loadSystem() {
    try {
      var s = await api("GET", "/admin/system"), d = s.database || {}, c = s.counts || {};
      var rows = [
        [tr("Database", "డేటాబేస్"), d.ok ? tr("Reachable", "అందుబాటులో ఉంది") + " · " + d.latency_ms + " ms · PostgreSQL " + d.postgres : tr("Not reachable", "అందుబాటులో లేదు") + " (" + d.error + ")"],
        [tr("Migration", "మైగ్రేషన్"), d.migration || "—"],
        [tr("People signed in", "లాగిన్ అయినవారు"), (c.people_signed_in || 0) + " · " + (c.sessions || 0) + tr(" devices", " పరికరాలు")],
        [tr("Accounts", "ఖాతాలు"), (c.role_user || 0) + tr(" users · ", " వినియోగదారులు · ") + (c.role_admin || 0) + tr(" admins · ", " నిర్వాహకులు · ") + (c.role_super || 0) + tr(" super admin", " ప్రధాన")],
        [tr("Codes sent today", "ఈ రోజు పంపిన కోడ్‌లు"), String(c.otp_today || 0)],
        ["WhatsApp", s.whatsapp_configured ? tr("Connected", "అనుసంధానమైంది") : tr("Not set up", "సెటప్ కాలేదు") + (s.otp_dev_echo ? tr(" (codes print in the server terminal)", " (కోడ్‌లు సర్వర్ టెర్మినల్‌లో)") : "")],
        [tr("Environment", "వాతావరణం"), s.app_env + " · v" + s.app_version],
      ];
      $("system").innerHTML = rows.map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("");
    } catch (e) { $("system").innerHTML = "<dt>" + esc(e.message) + "</dt><dd></dd>"; }
  }

  async function loadAdmins() {
    try {
      var list = (await api("GET", "/admin/people?role=admin")).people.concat((await api("GET", "/admin/people?role=super_admin")).people);
      $("admins").innerHTML = list.map(function (p) {
        return "<li><div><strong>" + esc(p.name) + "</strong><small>" + esc(p.mobile_masked) + " · " + (p.role === "super_admin" ? tr("Super admin", "ప్రధాన నిర్వాహకులు") : tr("Admin", "నిర్వాహకులు")) +
          " · " + tr("last login ", "చివరి లాగిన్ ") + esc(p.last_login_at ? new Date(p.last_login_at).toLocaleDateString() : tr("never", "లేదు")) + "</small></div>" +
          (p.can_change_role ? '<button type="button" class="btn btn--sm btn--ghost" data-demote="' + p.id + '">' + tr("Remove admin", "నిర్వాహక హోదా తీసివేయండి") + "</button>" : "") + "</li>";
      }).join("") || "<li>" + tr("No admins yet.", "ఇంకా నిర్వాహకులు లేరు.") + "</li>";
    } catch (e) { $("admins").innerHTML = "<li>" + esc(e.message) + "</li>"; }
  }
  $("admins").addEventListener("click", async function (e) {
    var id = e.target.getAttribute("data-demote");
    if (!id) return;
    try { await api("POST", "/admin/people/" + id + "/role", { role: "user" }); say("info", tr("Admin removed.", "నిర్వాహక హోదా తీసివేశాము.")); loadAdmins(); loadLog(true); }
    catch (err) { say("error", err.message); }
  });

  async function loadLog(reset) {
    if (reset) { logItems = []; nextBefore = null; }
    var q = new URLSearchParams({ limit: "50" });
    if ($("logAction").value) q.set("action", $("logAction").value);
    if (nextBefore) q.set("before", String(nextBefore));
    try {
      var r = await api("GET", "/admin/audit?" + q.toString());
      logItems = logItems.concat(r.items);
      nextBefore = r.next_before;
      var sel = $("logAction"), cur = sel.value;
      if (sel.options.length <= 1) r.actions.forEach(function (a) { var o = document.createElement("option"); o.value = a; o.textContent = a; sel.appendChild(o); });
      sel.value = cur;
      $("logBody").innerHTML = logItems.map(function (l) {
        var t = new Date(l.at);
        return "<tr><td>" + esc(t.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) + "</td><td>" + esc(l.who) +
          (l.role ? "<small>" + esc(l.role) + "</small>" : "") + "</td><td>" + esc(l.action) + "</td><td>" + esc(l.details || "") + (l.ip ? "<small>" + esc(l.ip) + "</small>" : "") + "</td></tr>";
      }).join("") || '<tr><td colspan="4" class="portal-hint">' + tr("Nothing logged.", "ఏమీ లేదు.") + "</td></tr>";
      $("logMore").hidden = !nextBefore;
    } catch (e) { $("logBody").innerHTML = '<tr><td colspan="4">' + esc(e.message) + "</td></tr>"; }
  }
  $("logAction").addEventListener("change", function () { loadLog(true); });
  $("logMore").addEventListener("click", function () { loadLog(false); });

  window.onLangChange = function () { loadSystem(); loadAdmins(); };
  loadSettings(); loadSystem(); loadAdmins(); loadLog(true);
})();
