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
      say("info", t("Saved. Every page follows within 15 seconds."));
      loadLog(true);
    } catch (err) { say("error", err.message); }
  });

  async function loadSystem() {
    try {
      var s = await api("GET", "/admin/system"), d = s.database || {}, c = s.counts || {};
      var rows = [
        [t("Database"), d.ok ? t("Reachable") + " · " + d.latency_ms + " ms · PostgreSQL " + d.postgres : t("Not reachable") + " (" + d.error + ")"],
        [t("Migration"), d.migration || "—"],
        [t("People signed in"), (c.people_signed_in || 0) + " · " + (c.sessions || 0) + t(" devices")],
        [t("Accounts"), (c.role_user || 0) + t(" users · ") + (c.role_admin || 0) + t(" admins · ") + (c.role_super || 0) + t(" super admin")],
        [t("Codes sent today"), String(c.otp_today || 0)],
        ["WhatsApp", s.whatsapp_configured ? t("Connected") : t("Not set up") + (s.otp_dev_echo ? t(" (codes print in the server terminal)") : "")],
        [t("Environment"), s.app_env + " · v" + s.app_version],
      ];
      $("system").innerHTML = rows.map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("");
    } catch (e) { $("system").innerHTML = "<dt>" + esc(e.message) + "</dt><dd></dd>"; }
  }

  async function loadAdmins() {
    try {
      var list = (await api("GET", "/admin/people?role=admin")).people.concat((await api("GET", "/admin/people?role=super_admin")).people);
      $("admins").innerHTML = list.map(function (p) {
        return "<li><div><strong>" + esc(p.name) + "</strong><small>" + esc(p.mobile_masked) + " · " + (p.role === "super_admin" ? t("Super admin") : t("Admin")) +
          " · " + t("last login ") + esc(p.last_login_at ? new Date(p.last_login_at).toLocaleDateString() : t("never")) + "</small></div>" +
          (p.can_change_role ? '<button type="button" class="btn btn--sm btn--ghost" data-demote="' + p.id + '">' + t("Remove admin") + "</button>" : "") + "</li>";
      }).join("") || '<li class="empty-state">' + t("No admins yet.") + "</li>";
    } catch (e) { $("admins").innerHTML = "<li>" + esc(e.message) + "</li>"; }
  }
  $("admins").addEventListener("click", async function (e) {
    var id = e.target.getAttribute("data-demote");
    if (!id) return;
    try { await api("POST", "/admin/people/" + id + "/role", { role: "user" }); say("info", t("Admin removed.")); loadAdmins(); loadLog(true); }
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
      }).join("") || '<tr><td colspan="4" class="empty-state">' + t("Nothing logged.") + "</td></tr>";
      $("logMore").hidden = !nextBefore;
    } catch (e) { $("logBody").innerHTML = '<tr><td colspan="4">' + esc(e.message) + "</td></tr>"; }
  }
  $("logAction").addEventListener("change", function () { loadLog(true); });
  $("logMore").addEventListener("click", function () { loadLog(false); });

  // ── Notifications (plan R11) ──
  var nf = null;
  function renderNotify() {
    if (!nf) return;
    var wa = nf.whatsapp_configured ? t("WhatsApp is connected (template \"{template}\").", { template: nf.template })
      : t("WhatsApp is not set up on this server.") + (nf.dev_echo ? " " + t("Codes print in the server terminal (development).") : "");
    $("nfStatus").textContent = wa + (nf.otp_sending ? "" : " " + t("Codes are paused."));
    var L = nf.limits;
    $("nfLimits").innerHTML = [
      [t("Per mobile"), t("{per_mobile_15min} in 15 minutes, {per_mobile_day} a day", { per_mobile_15min: L.per_mobile_15min, per_mobile_day: L.per_mobile_day })],
      [t("Per network address"), t("{per_ip_hour} an hour", { per_ip_hour: L.per_ip_hour })],
      [t("Wait before resending"), L.resend_wait_seconds + t(" seconds")],
      [t("A code works for"), L.code_minutes + t(" minutes")],
      [t("Lock after wrong passwords"), t("{wrong_passwords_before_lock} tries, for {lock_minutes} minutes", { wrong_passwords_before_lock: L.wrong_passwords_before_lock, lock_minutes: L.lock_minutes })],
    ].map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("");
  }
  async function loadNotify() {
    try {
      nf = await api("GET", "/admin/notifications");
      $("nfSending").checked = !!nf.otp_sending; $("nfLang").value = nf.otp_language || "en";
      var a = nf.admin_alerts || {};
      $("nfSignup").checked = a.signup !== false; $("nfLocked").checked = a.locked !== false;
      $("nfDisabled").checked = a.disabled !== false; $("nfSummary").checked = a.daily_summary !== false;
      renderNotify();
    } catch (e) { $("nfStatus").textContent = e.message; }
  }
  $("notifyForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!$("nfSending").checked && nf && nf.otp_sending &&
        !(await AppShell.confirm(t("Pause all login codes? Nobody can sign up or reset a password until you switch it on again."),
                                 { ok: t("Pause codes"), cancel: t("Keep sending"), danger: true }))) return;
    try {
      await api("PUT", "/admin/settings", { otp_sending: $("nfSending").checked, otp_language: $("nfLang").value,
        admin_alerts: { signup: $("nfSignup").checked, locked: $("nfLocked").checked, disabled: $("nfDisabled").checked, daily_summary: $("nfSummary").checked } });
      say("info", t("Notifications saved."));
      loadNotify(); loadLog(true);
    } catch (err) { say("error", err.message); }
  });
  $("nfTest").addEventListener("click", async function () {
    var b = $("nfTest"); b.disabled = true;
    try {
      var r = await api("POST", "/admin/notifications/test");
      say(r.sent ? "info" : "error", r.sent
        ? t("Test code sent to {to}. You don't need to enter it.", { to: r.to }) + (r.dev_echo ? " " + t("(Development: it printed in the server terminal.)") : "")
        : t("The test message could not be sent. Check the WhatsApp token, phone number id and template on the server."));
      loadLog(true);
    } catch (err) { say("error", err.message); }
    finally { b.disabled = false; }
  });

  window.onLangChange = function () { loadSystem(); loadAdmins(); renderNotify(); };
  loadSettings(); loadSystem(); loadAdmins(); loadLog(true); loadNotify();
})();
