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
      return { ok: false, status: 0, data: { detail: t("Could not reach the server. Check your connection.") } };
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
    if (r && r.status === 429) return t("Too many attempts. Please wait and try again.");
    return t("Something went wrong. Please try again.");
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
    // The Stitch design's five items (19 Nov 2026); Today's Panchang is the users' landing page.
    { href: "panchang-lookup.html", en: "Today's Panchang" },
    { href: "muhurta-finder.html", en: "Muhurta Darshini" },
    { href: "muhurtas.html", en: "All muhurtas" },
    { href: "muhurta-finder.html#parishilana", en: "Muhurta Parishilana" },
    { href: "family.html", en: "Family vault & settings" },
    { href: "admin.html", en: "Dashboard", roles: ["admin", "super_admin"] },
    // Reachable from the pages above; hidden from the menu unless Settings › Menu shows them.
    { href: "panchang-month.html", en: "Monthly Panchang", show: false },
    { href: "home.html", en: "Home", roles: ["user"], show: false },
    { href: "saved.html", en: "My muhurtas", show: false },
    // group "admin": shown together under one "Admin" menu (Experience Plan U1)
    { href: "admin-users.html", perm: "users.view", en: "Users", roles: ["admin", "super_admin"], group: "admin" },
    { href: "admin-content.html", perm: "content.edit", en: "Content", roles: ["admin", "super_admin"], group: "admin" },
    { href: "admin-muhurtas.html", en: "Muhurtas", roles: ["super_admin"], group: "admin" },
    { href: "admin-stats.html", perm: "system.view", en: "Statistics", roles: ["super_admin"], group: "admin" },
    { href: "admin-settings.html", en: "Settings", roles: ["super_admin"], group: "admin" },
  ];
  var BUILT = ["saved.html", "family.html", "home.html", "admin.html", "panchang-lookup.html", "panchang-month.html", "muhurta-finder.html",
               "muhurtas.html", "muhurta-finder.html#parishilana", "admin-users.html", "admin-content.html", "admin-muhurtas.html", "admin-stats.html", "admin-settings.html"];   // add admin pages as they are built

  // The super admin's menu settings (order, shown, names; plan D4) laid over NAV. Who may see a page
  // (roles) stays in NAV and on the server.
  // A menu label: the super admin's own wording (Settings › Menu) in the current language when set, else the
  // page name in English through i18n/te.js (21 Nov 2026). A custom English name without a Telugu one stays as typed.
  function navLabel(n) {
    if (typeof currentLang !== "undefined" && currentLang === "te") return n.te || (n.custom_en ? n.en : t(n.en));
    return n.en;
  }

  function navItems() {
    var cfg = window.SiteConfig && SiteConfig.data && SiteConfig.data.nav;
    if (!cfg || !cfg.items) return NAV.filter(function (n) { return n.show !== false; });
    var byHref = {};
    NAV.forEach(function (n) { byHref[n.href] = n; });
    var out = [];
    cfg.items.forEach(function (c) {
      var n = byHref[c.href];
      if (!n) return;
      if (c.show === false && n.href !== "admin-settings.html") return;
      out.push(Object.assign({}, n, { en: c.en || n.en, te: c.te || "", custom_en: !!c.en, show: true }));
      delete byHref[c.href];
    });
    Object.keys(byHref).forEach(function (h) { if (byHref[h].show !== false) out.push(byHref[h]); });   // pages added to the code later
    return out;
  }
  // Admin pages also follow the admin's powers (plan D10); the server checks the same permissions.
  function hasPerm(p) {
    var perms = currentUser && currentUser.permissions;
    return !Array.isArray(perms) || perms.indexOf(p) !== -1;
  }
  if (window.SiteConfig) SiteConfig.onChange(function () { if (currentUser) renderNav(); });
  window.addEventListener("hashchange", function () { if (currentUser) renderNav(); });

  function renderNav() {
    var links = document.querySelector(".app-shell__nav .app-shell__links");
    if (!links || !currentUser) return;
    var here = window.location.pathname.split("/").pop() || "";
    var allowed = navItems().filter(function (n) {
      return (!n.roles || n.roles.indexOf(currentUser.role) !== -1) && BUILT.indexOf(n.href) !== -1 &&
             (!n.perm || hasPerm(n.perm));
    });
    var link = function (cls) {
      return function (n) {
        var hash = window.location.hash || "";
        var isHere = n.href.indexOf("#") !== -1 ? n.href === here + hash : (n.href === here && hash !== "#parishilana");
        return '<a class="' + cls + '" href="' + n.href + '"' + (isHere ? ' aria-current="page"' : "") + ">" + esc(navLabel(n)) + "</a>";
      };
    };
    var admin = allowed.filter(function (n) { return n.group === "admin"; });
    var current = admin.filter(function (n) { return n.href === here; })[0];
    links.innerHTML = allowed.filter(function (n) { return !n.group; }).map(link("app-shell__link")).join("") +
      (admin.length
        ? '<div class="nav-group">' +
            '<button type="button" class="app-shell__link nav-group__btn' + (current ? " is-current" : "") + '" id="navAdminBtn" aria-haspopup="true" aria-expanded="false" aria-controls="navAdminPanel">' +
              esc(t("Admin@@auth")) + ' <span aria-hidden="true">▾</span></button>' +
            '<div class="nav-group__panel" id="navAdminPanel" hidden>' + admin.map(link("nav-group__item")).join("") + "</div>" +
          "</div>"
        : "");
    renderCrumbs(current);
    bindNavGroup();
    var brand = document.querySelector(".app-shell__brand");
    if (brand) brand.setAttribute("href", "/");
  }

  // "Dashboard › Users" above the title of the pages inside the Admin menu.
  function renderCrumbs(current) {
    var main = document.getElementById("mainContent");
    if (!main || !current) return;
    var crumbs = document.getElementById("crumbs");
    if (!crumbs) {
      crumbs = document.createElement("nav");
      crumbs.id = "crumbs";
      crumbs.className = "crumbs";
      main.insertBefore(crumbs, main.firstChild);
    }
    crumbs.setAttribute("aria-label", t("You are here"));
    crumbs.innerHTML = '<a href="admin.html">' + esc(t("Dashboard")) + '</a><span aria-hidden="true">›</span>' +
      '<span aria-current="page">' + esc(navLabel(current)) + "</span>";
  }

  // One set of listeners for the Admin menu; the menu itself is redrawn on every language change.
  var navGroupBound = false;
  function bindNavGroup() {
    if (navGroupBound) return;
    navGroupBound = true;
    function setOpen(open) {
      var btn = document.getElementById("navAdminBtn"), panel = document.getElementById("navAdminPanel");
      if (!btn || !panel) return;
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    }
    document.addEventListener("click", function (e) {
      var panel = document.getElementById("navAdminPanel");
      if (!panel) return;
      if (e.target.closest && e.target.closest("#navAdminBtn")) return setOpen(panel.hidden);
      if (!panel.hidden && !panel.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      var panel = document.getElementById("navAdminPanel"), btn = document.getElementById("navAdminBtn");
      if (e.key === "Escape" && panel && !panel.hidden) { setOpen(false); btn.focus(); }
    });
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
        esc(t("Alerts") + (unread ? " (" + unread + ")" : "")) + '">' + Icon("bell") + '' +
        (unread ? '<span class="alert-bell__count">' + (unread > 9 ? "9+" : unread) + "</span>" : "") + "</button>" +
        '<div class="alert-bell__panel" ' + (open ? "" : "hidden") + "><ul>" +
        (items.length ? items.map(function (x) {
          return '<li class="' + (isNew(x) ? "is-new" : "") + '"><span>' + esc(tr(x.en, x.te)) + "</span><small>" + esc(when(x.at)) + "</small></li>";
        }).join("") : "<li>" + t("Nothing in the last 7 days.") + "</li>") +
        '</ul><a class="account-menu__item" href="admin-settings.html">' + t("Choose alerts") + "</a></div>";
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
      slot.innerHTML = '<a class="account-login" href="' + esc(loginHref()) + '">' + t("Log in") + "</a>";
      return;
    }
    var roleLabel = { super_admin: t("Super admin"), admin: t("Admin") }[currentUser.role];
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
          '<a class="account-menu__item" href="account.html">' + t("My account") + "</a>" +
          '<button type="button" class="account-menu__item" data-action="logout">' + t("Sign out") + "</button>" +
          '<button type="button" class="account-menu__item" data-action="logout-all">' + t("Sign out on all devices") + "</button>" +
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
      if (window.AppShell) AppShell.toast(t("Signed out."), "success");
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
