// Dashboards (13 Nov 2026): the admin's (people, support, users' activity, user tools) and the super admin's
// (also system health, admins, sign-in and WhatsApp alerts, everyone's activity, every tool). No panchang here.
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var data = null, me = null, sys = null, settings = null;
  function isSuper() { return me && me.role === "super_admin"; }

  // Tools per role (the pages' own permissions are enforced by the server too).
  var TOOLS = [
    // [page, label, line, super admin only, permission the page needs] (English; Telugu from i18n/te.js)
    ["admin-users.html", "Users", "Search, disable or enable accounts", false, "users.view"],
    ["admin-content.html", "Content", "Announcements and utpata (omen) dates", false, "content.edit"],
    ["admin-muhurtas.html", "Muhurtas shown", "Which tabs and muhurtas users see", true],
    ["admin-stats.html", "Statistics", "Sign-ups, searches and use over time", true],
    ["admin-settings.html", "Settings", "Maintenance mode, limits and alerts", true],
    ["muhurta-finder.html", "Muhurta Finder", "Check a muhurta as users see it", false],
  ];

  var STATS = [
    ["users", "People"], ["active", "Active"], ["new_today", "New today"],
    ["new_week", "New this week"], ["signed_in_today", "Signed in today"],
    ["searches_today", "Searches today"], ["admins", "Admins"], ["disabled", "Disabled@@admin"],
  ];
  var ACTIONS = {
    signup: ["Started sign-up"], otp_verify: ["Verified mobile"], login: ["Logged in"],
    login_failed: ["Wrong password"], logout: ["Signed out"], logout_everywhere: ["Signed out everywhere"],
    password_reset: ["Reset password"], account_update: ["Updated account"], profile_update: ["Updated name"],
    "user.disable": ["Disabled a user"], "user.enable": ["Enabled a user"],
    "mobile.reveal": ["Viewed a mobile number"], mobile_change: ["Changed mobile"],
    "bootstrap.super_admin": ["Super admin created"],
  };

  function renderHead() {
    if (!me) return;
    $("dashTitle").textContent = isSuper() ? t("Super admin dashboard") : t("Admin dashboard");
    $("roleBadge").textContent = isSuper() ? t("Super admin") : t("Admin");
    var text = function (k, en) { return window.SiteConfig ? SiteConfig.text(k, en) : t(en); };
    $("dashLede").textContent = isSuper()
      ? text("dash_super_lede", "The whole system: health, people, admins and everyone's activity.")
      : text("dash_admin_lede", "People and support: new sign-ups, locked accounts and users' activity.");
    $("systemSection").hidden = !isSuper();
    // Admins: tiles only for pages their powers allow, and only the sections the super admin turned on
    // (Settings › Admin powers, plan D10/D11). The super admin sees everything.
    var perms = Array.isArray(me.permissions) ? me.permissions : null;
    var dash = (!isSuper() && window.SiteConfig && SiteConfig.data && SiteConfig.data.admin_dashboard) || {};
    [["stats", "cTitle"], ["attention", "aTitle"], ["activity", "rTitle"], ["tools", "tTitle"]].forEach(function (p) {
      var sec = $(p[1]) && $(p[1]).closest("section");
      if (sec) sec.hidden = dash[p[0]] === false;
    });
    // TOOLS rows: [page, label, line, super admin only, permission] (English; Telugu from i18n/te.js)
    $("tools").innerHTML = TOOLS.filter(function (tool) {
      return (!tool[3] || isSuper()) && (!tool[4] || !perms || perms.indexOf(tool[4]) !== -1);
    }).map(function (tool) {
      return '<a class="portal-tile" href="' + tool[0] + '"><strong>' + esc(t(tool[1])) + "</strong><span>" + esc(t(tool[2])) + "</span></a>";
    }).join("");
  }

  // Super admin only: database, sign-ins, WhatsApp, maintenance, version, accounts by role.
  function renderSystem() {
    if (!isSuper()) return;
    if (!sys) { return; }
    var db = sys.database || {}, k = sys.counts || {}, maint = settings && settings.maintenance_mode;
    var card = function (mod, label, value, note) {
      return '<div class="sys-card sys-card--' + mod + '"><span class="sys-card__label">' + label + "</span><b>" + value + "</b>" + (note ? "<small>" + note + "</small>" : "") + "</div>";
    };
    $("system").innerHTML = [
      card(db.ok ? "good" : "bad", t("Database"), db.ok ? t("Working") : t("Not reachable"),
           db.ok ? esc((db.latency_ms != null ? db.latency_ms + " ms · " : "") + "PostgreSQL " + (db.postgres || "")) : esc(db.error || "")),
      card("neutral", t("Signed in now"), esc(k.people_signed_in != null ? k.people_signed_in : "—"),
           esc(t("{sessions} devices", { sessions: (k.sessions || 0) }))),
      card(sys.whatsapp_configured ? "good" : "warn", t("WhatsApp codes"),
           sys.whatsapp_configured ? t("Set up") : t("Not set up"),
           esc(t("{otp_today} sent today", { otp_today: (k.otp_today || 0) })) + (sys.otp_dev_echo ? " · " + t("test mode") : "")),
      card(maint ? "warn" : "good", t("Maintenance mode"), maint ? t("On") : t("Off"),
           '<a href="admin-settings.html">' + t("Settings") + "</a>"),
      card("neutral", t("Accounts by role"), esc(k.role_user != null ? k.role_user : "—"),
           esc(t("users · {role_admin} admins · {role_super} super admins", { role_admin: (k.role_admin || 0), role_super: (k.role_super || 0) }))),
      card("neutral", t("Version"), esc(sys.app_version || "—"), esc((sys.app_env || "") + (db.migration ? " · migration " + db.migration : ""))),
    ].join("");
  }

  function render() {
    renderHead();
    renderSystem();
    if (!data) return;
    var c = data.counts;
    $("stats").innerHTML = STATS.filter(function (s) { return s[0] !== "admins" || isSuper(); }).map(function (s) {
      return '<div class="stat"><b>' + (c[s[0]] || 0) + "</b><span>" + t(s[1]) + "</span></div>";
    }).join("");
    var items = [];
    if (c.stuck_pending) items.push(["warn", t("{stuck_pending} sign-up(s) waiting more than an hour for the code", { stuck_pending: c.stuck_pending }), "admin-users.html?status=pending"]);
    if (c.locked) items.push(["warn", t("{locked} account(s) locked out after wrong passwords", { locked: c.locked }), "admin-users.html?status=locked"]);
    if (isSuper()) {   // system alerts are the super admin's
      if (c.otp_failed_today) items.push(["warn", t("{otp_failed_today} WhatsApp code(s) failed to send today", { otp_failed_today: c.otp_failed_today }), ""]);
      if (c.failed_logins_today) items.push(["", t("{failed_logins_today} wrong password attempt(s) today", { failed_logins_today: c.failed_logins_today }), ""]);
      if (sys && sys.database && !sys.database.ok) items.push(["warn", t("The database is not reachable"), ""]);
      if (sys && !sys.whatsapp_configured) items.push(["warn", t("WhatsApp sign-in codes are not set up"), ""]);
      if (settings && settings.maintenance_mode) items.push(["warn", t("Maintenance mode is on: users cannot open the app"), "admin-settings.html"]);
    }
    $("attention").innerHTML = items.length ? items.map(function (i) {
      return '<li class="' + (i[0] === "warn" ? "is-warn" : "") + '"><span>' + esc(i[1]) + "</span>" + (i[2] ? '<a href="' + i[2] + '">' + t("Open") + "</a>" : "") + "</li>";
    }).join("") : '<li class="empty-state">' + t("Nothing needs attention.") + "</li>";
    $("scopeNote").textContent = data.scope === "all" ? t("(everyone)") : t("(users)");
    $("activity").innerHTML = data.recent.length ? data.recent.map(function (r) {
      var a = ACTIONS[r.action] || [r.action, r.action];
      var tv = new Date(r.at);
      return "<li><time>" + esc(tv.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " + tv.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) +
        "</time><span><strong>" + esc(r.who) + "</strong> · " + esc(t(a)) + "</span></li>";
    }).join("") : '<li class="empty-state">' + t("No activity yet.") + "</li>";
  }

  async function getJson(url) {
    var res = await fetch(API_BASE + url);
    var body = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error((body && body.detail) || "HTTP " + res.status);
    return body;
  }

  async function loadSystem() {
    if (!isSuper()) return;
    try { sys = await getJson("/admin/system"); } catch (e) { sys = { database: { ok: false, error: e.message } }; }
    try { settings = await getJson("/admin/settings"); } catch (e) { console.error("Settings could not be read", e); }
    render();
  }

  async function load() {
    try {
      var res = await fetch(API_BASE + "/dashboard/summary");
      var body = await res.json().catch(function () { return null; });
      if (!res.ok) throw new Error((body && body.detail) || "HTTP " + res.status);
      data = body; render();
    } catch (e) { $("stats").innerHTML = '<p class="portal-hint">' + esc(e.message) + "</p>"; }
  }

  Auth.me().then(function (u) {
    if (!u) return;
    me = u; render(); loadSystem();
  });
  window.onLangChange = function () { render(); };
  if (window.SiteConfig) SiteConfig.onChange(function () { render(); });
  load();
  setInterval(function () { load(); loadSystem(); }, 60000);
})();
