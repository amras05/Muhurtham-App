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
    // [page, en, te, line en, line te, super admin only, permission the page needs]
    ["admin-users.html", "Users", "వినియోగదారులు", "Search, disable or enable accounts", "వెతకండి, ఖాతాలను నిలిపివేయండి లేదా ప్రారంభించండి", false, "users.view"],
    ["admin-content.html", "Content", "విషయాలు", "Announcements and utpata (omen) dates", "ప్రకటనలు, ఉత్పాత తేదీలు", false, "content.edit"],
    ["admin-muhurtas.html", "Muhurtas shown", "చూపే ముహూర్తాలు", "Which tabs and muhurtas users see", "వినియోగదారులకు కనిపించే ట్యాబ్‌లు, ముహూర్తాలు", true],
    ["admin-stats.html", "Statistics", "గణాంకాలు", "Sign-ups, searches and use over time", "నమోదులు, శోధనలు, వినియోగం", true],
    ["admin-settings.html", "Settings", "సెట్టింగులు", "Maintenance mode, limits and alerts", "నిర్వహణ మోడ్, పరిమితులు, హెచ్చరికలు", true],
    ["muhurta-finder.html", "Muhurta Finder", "ముహూర్త శోధన", "Check a muhurta as users see it", "వినియోగదారులు చూసినట్లే ముహూర్తం చూడండి", false],
  ];

  var STATS = [
    ["users", "People", "వినియోగదారులు"], ["active", "Active", "సక్రియం"], ["new_today", "New today", "ఈ రోజు కొత్తవారు"],
    ["new_week", "New this week", "ఈ వారం కొత్తవారు"], ["signed_in_today", "Signed in today", "ఈ రోజు లాగిన్"],
    ["searches_today", "Searches today", "ఈ రోజు శోధనలు"], ["admins", "Admins", "నిర్వాహకులు"], ["disabled", "Disabled", "నిలిపివేసినవి"],
  ];
  var ACTIONS = {
    signup: ["Started sign-up", "నమోదు ప్రారంభం"], otp_verify: ["Verified mobile", "మొబైల్ ధృవీకరణ"], login: ["Logged in", "లాగిన్"],
    login_failed: ["Wrong password", "తప్పు పాస్‌వర్డ్"], logout: ["Signed out", "సైన్ అవుట్"], logout_everywhere: ["Signed out everywhere", "అన్ని చోట్ల సైన్ అవుట్"],
    password_reset: ["Reset password", "పాస్‌వర్డ్ రీసెట్"], account_update: ["Updated account", "ఖాతా మార్పు"], profile_update: ["Updated name", "పేరు మార్పు"],
    "user.disable": ["Disabled a user", "వినియోగదారును నిలిపారు"], "user.enable": ["Enabled a user", "వినియోగదారును ప్రారంభించారు"],
    "mobile.reveal": ["Viewed a mobile number", "మొబైల్ నంబర్ చూశారు"], mobile_change: ["Changed mobile", "మొబైల్ మార్పు"],
    "bootstrap.super_admin": ["Super admin created", "ప్రధాన నిర్వాహకులు సృష్టించబడ్డారు"],
  };

  function renderHead() {
    if (!me) return;
    $("dashTitle").textContent = isSuper() ? tr("Super admin dashboard", "ప్రధాన నిర్వాహక డాష్‌బోర్డ్") : tr("Admin dashboard", "నిర్వాహక డాష్‌బోర్డ్");
    $("roleBadge").textContent = isSuper() ? tr("Super admin", "ప్రధాన నిర్వాహకులు") : tr("Admin", "నిర్వాహకులు");
    var text = function (k, en, te) { return window.SiteConfig ? SiteConfig.text(k, en, te) : tr(en, te); };
    $("dashLede").textContent = isSuper()
      ? text("dash_super_lede", "The whole system: health, people, admins and everyone's activity.", "మొత్తం వ్యవస్థ: స్థితి, వినియోగదారులు, నిర్వాహకులు, అందరి కార్యకలాపాలు.")
      : text("dash_admin_lede", "People and support: new sign-ups, locked accounts and users' activity.", "వినియోగదారులు, సహాయం: కొత్త నమోదులు, లాక్ అయిన ఖాతాలు, వినియోగదారుల కార్యకలాపాలు.");
    $("systemSection").hidden = !isSuper();
    // Admins: tiles only for pages their powers allow, and only the sections the super admin turned on
    // (Settings › Admin powers, plan D10/D11). The super admin sees everything.
    var perms = Array.isArray(me.permissions) ? me.permissions : null;
    var dash = (!isSuper() && window.SiteConfig && SiteConfig.data && SiteConfig.data.admin_dashboard) || {};
    [["stats", "cTitle"], ["attention", "aTitle"], ["activity", "rTitle"], ["tools", "tTitle"]].forEach(function (p) {
      var sec = $(p[1]) && $(p[1]).closest("section");
      if (sec) sec.hidden = dash[p[0]] === false;
    });
    $("tools").innerHTML = TOOLS.filter(function (t) {
      return (!t[5] || isSuper()) && (!t[6] || !perms || perms.indexOf(t[6]) !== -1);
    }).map(function (t) {
      return '<a class="portal-tile" href="' + t[0] + '"><strong>' + esc(tr(t[1], t[2])) + "</strong><span>" + esc(tr(t[3], t[4])) + "</span></a>";
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
      card(db.ok ? "good" : "bad", tr("Database", "డేటాబేస్"), db.ok ? tr("Working", "పనిచేస్తోంది") : tr("Not reachable", "అందుబాటులో లేదు"),
           db.ok ? esc((db.latency_ms != null ? db.latency_ms + " ms · " : "") + "PostgreSQL " + (db.postgres || "")) : esc(db.error || "")),
      card("neutral", tr("Signed in now", "ఇప్పుడు లాగిన్‌లో"), esc(k.people_signed_in != null ? k.people_signed_in : "—"),
           esc(tr((k.sessions || 0) + " devices", (k.sessions || 0) + " పరికరాలు"))),
      card(sys.whatsapp_configured ? "good" : "warn", tr("WhatsApp codes", "వాట్సాప్ కోడ్‌లు"),
           sys.whatsapp_configured ? tr("Set up", "సిద్ధంగా ఉంది") : tr("Not set up", "సెటప్ కాలేదు"),
           esc(tr((k.otp_today || 0) + " sent today", "ఈ రోజు " + (k.otp_today || 0) + " పంపారు")) + (sys.otp_dev_echo ? " · " + tr("test mode", "పరీక్ష మోడ్") : "")),
      card(maint ? "warn" : "good", tr("Maintenance mode", "నిర్వహణ మోడ్"), maint ? tr("On", "ఆన్") : tr("Off", "ఆఫ్"),
           '<a href="admin-settings.html">' + tr("Settings", "సెట్టింగులు") + "</a>"),
      card("neutral", tr("Accounts by role", "పాత్రల వారీగా ఖాతాలు"), esc(k.role_user != null ? k.role_user : "—"),
           esc(tr("users · " + (k.role_admin || 0) + " admins · " + (k.role_super || 0) + " super admins",
                  "వినియోగదారులు · " + (k.role_admin || 0) + " నిర్వాహకులు · " + (k.role_super || 0) + " ప్రధాన"))),
      card("neutral", tr("Version", "వెర్షన్"), esc(sys.app_version || "—"), esc((sys.app_env || "") + (db.migration ? " · migration " + db.migration : ""))),
    ].join("");
  }

  function render() {
    renderHead();
    renderSystem();
    if (!data) return;
    var c = data.counts;
    $("stats").innerHTML = STATS.filter(function (s) { return s[0] !== "admins" || isSuper(); }).map(function (s) {
      return '<div class="stat"><b>' + (c[s[0]] || 0) + "</b><span>" + tr(s[1], s[2]) + "</span></div>";
    }).join("");
    var items = [];
    if (c.stuck_pending) items.push(["warn", tr(c.stuck_pending + " sign-up(s) waiting more than an hour for the code", c.stuck_pending + " నమోదులు కోడ్ కోసం గంటకు పైగా ఆగాయి"), "admin-users.html?status=pending"]);
    if (c.locked) items.push(["warn", tr(c.locked + " account(s) locked out after wrong passwords", c.locked + " ఖాతాలు తప్పు పాస్‌వర్డ్‌లతో లాక్ అయ్యాయి"), "admin-users.html?status=locked"]);
    if (isSuper()) {   // system alerts are the super admin's
      if (c.otp_failed_today) items.push(["warn", tr(c.otp_failed_today + " WhatsApp code(s) failed to send today", "ఈ రోజు " + c.otp_failed_today + " వాట్సాప్ కోడ్‌లు వెళ్లలేదు"), ""]);
      if (c.failed_logins_today) items.push(["", tr(c.failed_logins_today + " wrong password attempt(s) today", "ఈ రోజు " + c.failed_logins_today + " తప్పు పాస్‌వర్డ్ ప్రయత్నాలు"), ""]);
      if (sys && sys.database && !sys.database.ok) items.push(["warn", tr("The database is not reachable", "డేటాబేస్ అందుబాటులో లేదు"), ""]);
      if (sys && !sys.whatsapp_configured) items.push(["warn", tr("WhatsApp sign-in codes are not set up", "వాట్సాప్ లాగిన్ కోడ్‌లు సెటప్ కాలేదు"), ""]);
      if (settings && settings.maintenance_mode) items.push(["warn", tr("Maintenance mode is on: users cannot open the app", "నిర్వహణ మోడ్ ఆన్‌లో ఉంది: వినియోగదారులు యాప్ తెరవలేరు"), "admin-settings.html"]);
    }
    $("attention").innerHTML = items.length ? items.map(function (i) {
      return '<li class="' + (i[0] === "warn" ? "is-warn" : "") + '"><span>' + esc(i[1]) + "</span>" + (i[2] ? '<a href="' + i[2] + '">' + tr("Open", "చూడండి") + "</a>" : "") + "</li>";
    }).join("") : '<li class="empty-state">' + tr("Nothing needs attention.", "గమనించవలసినది ఏదీ లేదు.") + "</li>";
    $("scopeNote").textContent = data.scope === "all" ? tr("(everyone)", "(అందరూ)") : tr("(users)", "(వినియోగదారులు)");
    $("activity").innerHTML = data.recent.length ? data.recent.map(function (r) {
      var a = ACTIONS[r.action] || [r.action, r.action];
      var t = new Date(r.at);
      return "<li><time>" + esc(t.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " + t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) +
        "</time><span><strong>" + esc(r.who) + "</strong> · " + esc(tr(a[0], a[1])) + "</span></li>";
    }).join("") : '<li class="empty-state">' + tr("No activity yet.", "ఇంకా కార్యకలాపాలు లేవు.") + "</li>";
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
