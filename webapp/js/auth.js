// ============================================================
// Muhurtham App · web sign-in (shared by every page)
//
// The session lives in HttpOnly cookies set by /auth/web/*; this script never sees a
// token. Every request sends `X-Muhurtham-Client: web` (the server requires it on
// cookie-signed changes). An expired access cookie is renewed once via /auth/web/refresh.
// Pages show the account menu in any element with id="accountSlot".
// ============================================================
window.Auth = (function () {
  var HEADERS = { "Content-Type": "application/json", "X-Muhurtham-Client": "web" };
  var NO_RETRY = ["/auth/web/login", "/auth/web/verify-otp", "/auth/web/refresh", "/auth/web/logout"];
  var currentUser = null;
  var refreshing = null;

  // Every same-origin request from any page script (finder, panchang…) carries the web header the
  // server requires on cookie-signed changes, and renews an expired session once on 401.
  var nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var sameOrigin = url.indexOf("://") === -1 || url.indexOf(window.location.origin + "/") === 0;
    if (!sameOrigin || url.indexOf("/auth/web/") !== -1) return nativeFetch(input, init);
    init = Object.assign({ credentials: "same-origin" }, init || {});
    var headers = new Headers(init.headers || (typeof input !== "string" && input.headers) || {});
    headers.set("X-Muhurtham-Client", "web");
    init.headers = headers;
    var res = await nativeFetch(input, init);
    if (res.status === 401 && url.indexOf("/auth/") === -1) {
      var renewed = await refreshOnce();
      if (renewed.ok) return nativeFetch(input, init);
      window.location.href = "login.html?next=" + encodeURIComponent((window.location.pathname.split("/").pop() || "") + window.location.hash);
    }
    return res;
  };

  function base() { return typeof API_BASE !== "undefined" ? API_BASE : ""; }
  function tr(en, te) { return (typeof currentLang !== "undefined" && currentLang === "te") ? te : en; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  async function raw(method, path, body) {
    var res;
    try {
      res = await fetch(base() + path, {
        method: method, credentials: "same-origin", headers: HEADERS,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      return { ok: false, status: 0, data: { detail: tr("Could not reach the server. Check your connection.", "సర్వర్‌ను చేరుకోలేకపోయాం. ఇంటర్నెట్ చూడండి.") } };
    }
    var data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    return { ok: res.ok, status: res.status, data: data };
  }

  // Renew once per tab. 409 = another tab renewed a moment ago and the browser already holds its new
  // cookies (plan F2): wait a little so they land, then the caller retries its request.
  function refreshOnce() {
    if (!refreshing) {
      refreshing = raw("POST", "/auth/web/refresh").then(function (r) {
        if (r.status !== 409) return r;
        return new Promise(function (done) { setTimeout(function () { done({ ok: true, status: 200, data: null }); }, 400); });
      }).finally(function () { refreshing = null; });
    }
    return refreshing;
  }

  // A request that renews the session once if the access cookie has expired.
  async function call(method, path, body) {
    var r = await raw(method, path, body);
    if (r.status === 401 && NO_RETRY.indexOf(path) === -1) {
      var renewed = await refreshOnce();
      if (renewed.ok) r = await raw(method, path, body);
    }
    return r;
  }

  // Readable message from an error reply (FastAPI detail string or validation list).
  function errorText(r) {
    var d = r && r.data && r.data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length) {
      var f = d[0];
      var field = Array.isArray(f.loc) ? f.loc[f.loc.length - 1] : "";
      return (field ? field + ": " : "") + (f.msg || "invalid value");
    }
    if (r && r.status === 429) return tr("Too many attempts. Please wait and try again.", "చాలా ప్రయత్నాలు. కొద్దిసేపు ఆగి మళ్లీ ప్రయత్నించండి.");
    return tr("Something went wrong. Please try again.", "ఏదో పొరపాటు జరిగింది. మళ్లీ ప్రయత్నించండి.");
  }

  async function me() {
    var r = await call("GET", "/auth/web/me");
    currentUser = r.ok ? r.data : null;
    return currentUser;
  }

  async function logout(everywhere) {
    await call("POST", "/auth/web/logout", { everywhere: !!everywhere });
    currentUser = null;
    renderMenu();
  }

  // ---- Account menu in the page header ----
  function loginHref() {
    var here = window.location.pathname.split("/").pop() || "panchang-lookup.html";
    return "login.html?next=" + encodeURIComponent(here + window.location.hash);
  }

  // Header links for this role (the server enforces the same rules).
  var NAV = [
    { href: "home.html", en: "Home", te: "హోమ్", roles: ["user"] },
    { href: "admin.html", en: "Dashboard", te: "డాష్‌బోర్డ్", roles: ["admin", "super_admin"] },
    { href: "panchang-lookup.html", en: "Panchang", te: "పంచాంగం" },
    { href: "muhurta-finder.html", en: "Muhurta Finder", te: "ముహూర్త శోధన" },
    { href: "family.html", en: "My family", te: "నా కుటుంబం" },
    { href: "saved.html", en: "My muhurtas", te: "నా ముహూర్తాలు" },
    { href: "admin-users.html", en: "Users", te: "వినియోగదారులు", roles: ["admin", "super_admin"] },
    { href: "admin-content.html", en: "Content", te: "విషయాలు", roles: ["admin", "super_admin"] },
    { href: "admin-muhurtas.html", en: "Muhurtas", te: "ముహూర్తాలు", roles: ["super_admin"] },
    { href: "admin-stats.html", en: "Statistics", te: "గణాంకాలు", roles: ["super_admin"] },
    { href: "admin-settings.html", en: "Settings", te: "సెట్టింగులు", roles: ["super_admin"] },
  ];
  var BUILT = ["saved.html", "family.html", "home.html", "admin.html", "panchang-lookup.html", "muhurta-finder.html", "admin-users.html", "admin-content.html", "admin-muhurtas.html", "admin-stats.html", "admin-settings.html"];   // add admin pages as they are built

  function renderNav() {
    var links = document.querySelector(".app-shell__nav .app-shell__links");
    if (!links || !currentUser) return;
    var here = window.location.pathname.split("/").pop() || "";
    links.innerHTML = NAV.filter(function (n) {
      return (!n.roles || n.roles.indexOf(currentUser.role) !== -1) && BUILT.indexOf(n.href) !== -1;
    }).map(function (n) {
      return '<a class="app-shell__link" href="' + n.href + '"' + (n.href === here ? ' aria-current="page"' : "") + ">" + esc(tr(n.en, n.te)) + "</a>";
    }).join("");
    var brand = document.querySelector(".app-shell__brand");
    if (brand) brand.setAttribute("href", "/");
  }

  // ── Super admin alert bell (plan R11): /admin/alerts, unread = newer than when this account last
  // opened it (users.alerts_seen_at, plan F2 / M4), so every browser shows the same count ──
  var Bell = (function () {
    var items = [], open = false, timer = null, seenAt = 0;
    function isNew(x) { return Date.parse(x.at) > seenAt; }     // compare times: items carry different UTC offsets
    async function markSeen() {
      seenAt = Date.now();                        // clear the count at once; the server keeps the real time
      var r = await call("POST", "/admin/alerts/seen");
      if (r.ok && r.data && r.data.seen_at) seenAt = Date.parse(r.data.seen_at);
    }
    function when(iso) { return new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    function draw() {
      var box = document.getElementById("alertBell");
      if (!box) return;
      var unread = items.filter(isNew).length;
      box.innerHTML = '<button type="button" class="alert-bell__btn" id="alertBellBtn" aria-haspopup="true" aria-expanded="' + open + '" aria-label="' +
        esc(tr("Alerts", "హెచ్చరికలు") + (unread ? " (" + unread + ")" : "")) + '"><span aria-hidden="true">🔔</span>' +
        (unread ? '<span class="alert-bell__count">' + (unread > 9 ? "9+" : unread) + "</span>" : "") + "</button>" +
        '<div class="alert-bell__panel" ' + (open ? "" : "hidden") + "><ul>" +
        (items.length ? items.map(function (x) {
          return '<li class="' + (isNew(x) ? "is-new" : "") + '"><span>' + esc(tr(x.en, x.te)) + "</span><small>" + esc(when(x.at)) + "</small></li>";
        }).join("") : "<li>" + tr("Nothing in the last 7 days.", "గత 7 రోజుల్లో ఏమీ లేదు.") + "</li>") +
        '</ul><a class="account-menu__item" href="admin-settings.html">' + tr("Choose alerts", "హెచ్చరికలు ఎంచుకోండి") + "</a></div>";
      document.getElementById("alertBellBtn").addEventListener("click", function () {
        open = !open;
        draw();
        if (open) markSeen();
      });
    }
    async function load() {
      try {
        var r = await call("GET", "/admin/alerts");
        if (r.ok) { items = r.data.items || []; seenAt = r.data.seen_at ? Date.parse(r.data.seen_at) : 0; draw(); }
      } catch (e) { /* the bell is optional; the page works without it */ }
    }
    function mount() {
      draw(); load();
      if (timer) return;                       // renderMenu runs again on language change
      timer = setInterval(load, 5 * 60 * 1000);
      document.addEventListener("click", function (e) { if (open && !e.target.closest("#alertBell")) { open = false; draw(); } });
    }
    return { mount: mount };
  })();

  function renderMenu() {
    renderNav();
    var slot = document.getElementById("accountSlot");
    if (!slot) return;
    if (!currentUser) {
      slot.innerHTML = '<a class="account-login" href="' + esc(loginHref()) + '">' + tr("Log in", "లాగిన్") + "</a>";
      return;
    }
    var roleLabel = { super_admin: tr("Super admin", "ప్రధాన నిర్వాహకులు"), admin: tr("Admin", "నిర్వాహకులు") }[currentUser.role];
    slot.innerHTML =
      (currentUser.role === "super_admin" ? '<div class="alert-bell" id="alertBell"></div>' : "") +
      '<div class="account-menu">' +
        '<button type="button" class="account-menu__button" id="accountMenuBtn" aria-haspopup="true" aria-expanded="false">' +
          '<span class="account-menu__avatar" aria-hidden="true">' + esc((currentUser.name || "?").trim().charAt(0).toUpperCase()) + "</span>" +
          '<span class="account-menu__name">' + esc(currentUser.name) + "</span>" +
        "</button>" +
        '<div class="account-menu__panel" id="accountMenuPanel" hidden>' +
          '<div class="account-menu__who"><strong>' + esc(currentUser.name) + "</strong>" +
            "<span>" + esc(String(currentUser.phone || "").length === 10 ? "+91 " + currentUser.phone : "+" + currentUser.phone) + "</span>" +
            (roleLabel ? '<span class="account-menu__role">' + esc(roleLabel) + "</span>" : "") +
          "</div>" +
          '<a class="account-menu__item" href="account.html">' + tr("My account", "నా ఖాతా") + "</a>" +
          '<button type="button" class="account-menu__item" data-action="logout">' + tr("Sign out", "సైన్ అవుట్") + "</button>" +
          '<button type="button" class="account-menu__item" data-action="logout-all">' + tr("Sign out on all devices", "అన్ని పరికరాల నుండి సైన్ అవుట్") + "</button>" +
        "</div>" +
      "</div>";
    if (currentUser.role === "super_admin") Bell.mount();
    var btn = document.getElementById("accountMenuBtn");
    var panel = document.getElementById("accountMenuPanel");
    btn.addEventListener("click", function () {
      panel.hidden = !panel.hidden;
      btn.setAttribute("aria-expanded", String(!panel.hidden));
    });
    panel.addEventListener("click", async function (e) {
      var action = e.target.getAttribute("data-action");
      if (!action) return;
      await logout(action === "logout-all");
      if (window.AppShell) AppShell.toast(tr("Signed out.", "సైన్ అవుట్ అయ్యారు."), "success");
    });
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !slot.contains(e.target)) {
        panel.hidden = true;
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Pages that draw their header after load (panchang) get the menu once #accountSlot appears.
  function whenSlotReady(fn) {
    if (document.getElementById("accountSlot")) return fn();
    var obs = new MutationObserver(function () {
      if (document.getElementById("accountSlot")) { obs.disconnect(); fn(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  async function init() {
    if (document.body && document.body.hasAttribute("data-no-account-menu")) return;
    await me();
    whenSlotReady(renderMenu);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return {
    raw: raw, call: call, me: me, logout: logout, errorText: errorText, renderMenu: renderMenu,
    user: function () { return currentUser; },
    login: function (phone, password) { return raw("POST", "/auth/web/login", { phone: phone, password: password }); },
    verify: function (phone, otp) { return raw("POST", "/auth/web/verify-otp", { phone: phone, otp: otp }); },
    signup: function (d) { return raw("POST", "/auth/signup", d); },
    resend: function (phone) { return raw("POST", "/auth/resend-otp", { phone: phone }); },
    forgot: function (phone) { return raw("POST", "/auth/otp/send", { phone: phone, purpose: "reset_password" }); },
    reset: function (d) { return raw("POST", "/auth/password/reset", d); },
  };
})();
