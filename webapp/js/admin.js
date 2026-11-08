// Admin dashboard (admin and super admin): Today card, counts, needs attention, recent activity.
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var data = null;

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

  function render() {
    if (!data) return;
    var c = data.counts;
    $("stats").innerHTML = STATS.map(function (s) {
      return '<div class="stat"><b>' + (c[s[0]] || 0) + "</b><span>" + tr(s[1], s[2]) + "</span></div>";
    }).join("");
    var items = [];
    if (c.stuck_pending) items.push(["warn", tr(c.stuck_pending + " sign-up(s) waiting more than an hour for the code", c.stuck_pending + " నమోదులు కోడ్ కోసం గంటకు పైగా ఆగాయి"), "admin-users.html?status=pending"]);
    if (c.locked) items.push(["warn", tr(c.locked + " account(s) locked out after wrong passwords", c.locked + " ఖాతాలు తప్పు పాస్‌వర్డ్‌లతో లాక్ అయ్యాయి"), "admin-users.html?status=locked"]);
    if (c.otp_failed_today) items.push(["warn", tr(c.otp_failed_today + " WhatsApp code(s) failed to send today", "ఈ రోజు " + c.otp_failed_today + " వాట్సాప్ కోడ్‌లు వెళ్లలేదు"), ""]);
    if (c.failed_logins_today) items.push(["", tr(c.failed_logins_today + " wrong password attempt(s) today", "ఈ రోజు " + c.failed_logins_today + " తప్పు పాస్‌వర్డ్ ప్రయత్నాలు"), ""]);
    $("attention").innerHTML = items.length ? items.map(function (i) {
      return '<li class="' + (i[0] === "warn" ? "is-warn" : "") + '"><span>' + esc(i[1]) + "</span>" + (i[2] ? '<a href="' + i[2] + '">' + tr("Open", "చూడండి") + "</a>" : "") + "</li>";
    }).join("") : '<li><span>' + tr("Nothing needs attention.", "గమనించవలసినది ఏదీ లేదు.") + "</span></li>";
    $("scopeNote").textContent = data.scope === "all" ? tr("(everyone)", "(అందరూ)") : tr("(users)", "(వినియోగదారులు)");
    $("activity").innerHTML = data.recent.length ? data.recent.map(function (r) {
      var a = ACTIONS[r.action] || [r.action, r.action];
      var t = new Date(r.at);
      return "<li><time>" + esc(t.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " + t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) +
        "</time><span><strong>" + esc(r.who) + "</strong> · " + esc(tr(a[0], a[1])) + "</span></li>";
    }).join("") : '<li class="portal-hint">' + tr("No activity yet.", "ఇంకా కార్యకలాపాలు లేవు.") + "</li>";
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
    $("roleBadge").textContent = u.role === "super_admin" ? tr("Super admin", "ప్రధాన నిర్వాహకులు") : tr("Admin", "నిర్వాహకులు");
  });
  window.onLangChange = function () { render(); Today.render(); };
  Today.mount("todayCard");
  load();
  setInterval(load, 60000);
})();
