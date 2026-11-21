// ============================================================
// Gayathri Jyothirnidhe · site settings on every page (Super Admin Control Plan S3–S7, 13 Nov 2026)
// Reads the public settings (/app/config) the super admin changes on the Settings page and applies
// the brand and theme. Pages read the rest through window.SiteConfig:
//   SiteConfig.data            the last settings (from this browser's cache first, then the server)
//   SiteConfig.ready           a promise for the server's settings
//   SiteConfig.onChange(fn)    called whenever new settings arrive
//   SiteConfig.text(key, en)      an editable text, or the page's own wording when it is empty
// Load it right after config.js (it needs API_BASE).
// ============================================================
window.SiteConfig = (function () {
  var CACHE_KEY = "gj_site_config_v1";
  var listeners = [];
  var data = null;

  // Ready-made themes. "primary"/"gold" may be replaced by the super admin's own colours.
  var THEMES = {
    sanctuary: {},   // the colours in variables.css
    classic: { "--color-primary": "#6f1725", "--color-primary-strong": "#4d0d17", "--color-accent": "#8a6400", "--color-gold": "#c59b27",
               "--color-gold-soft": "#f3d27a", "--color-gold-bg": "#fff8e1", "--color-bg": "#fbfaf8", "--color-surface-muted": "#f5f1ea",
               "--color-surface-strong": "#ece5d8", "--color-border": "#ded6cc", "--color-border-strong": "#c9bfb2" },
    saffron: { "--color-primary": "#a14a00", "--color-primary-strong": "#7a3600", "--color-accent": "#7a5200", "--color-gold": "#e0a526",
               "--color-gold-soft": "#f7d27a", "--color-gold-bg": "#fff3dc", "--color-bg": "#fdf8f0", "--color-surface-muted": "#f8efe1",
               "--color-surface-strong": "#f0e2cc", "--color-border": "#ead9c0", "--color-border-strong": "#d6bf9e" },
  };

  function darker(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var c = function (v) { return Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, "0"); };
    return "#" + c(r) + c(g) + c(b);
  }

  function applyTheme(theme) {
    var root = document.documentElement.style;
    var all = {};
    Object.keys(THEMES).forEach(function (k) { Object.keys(THEMES[k]).forEach(function (v) { all[v] = 1; }); });
    ["--color-primary", "--color-primary-strong", "--color-gold", "--color-gold-soft"].forEach(function (v) { all[v] = 1; });
    Object.keys(all).forEach(function (v) { root.removeProperty(v); });   // back to variables.css first
    if (!theme) return;
    var set = THEMES[theme.preset] || {};
    Object.keys(set).forEach(function (v) { root.setProperty(v, set[v]); });
    if (theme.primary) { root.setProperty("--color-primary", theme.primary); root.setProperty("--color-primary-strong", darker(theme.primary, 0.75)); }
    if (theme.gold) { root.setProperty("--color-gold", theme.gold); root.setProperty("--color-gold-soft", theme.gold); }
  }

  function applyBrand(brand) {
    if (!brand) return;
    document.querySelectorAll(".brand-name").forEach(function (el) { el.textContent = brand.name_te || brand.name_en; });
    document.querySelectorAll(".brand-tag").forEach(function (el) { el.textContent = brand.tagline_te || brand.tagline_en || ""; });
    if (window.Icon) document.querySelectorAll(".brand-mark").forEach(function (el) { el.innerHTML = Icon(brand.icon || "sun"); });
    var t = document.title || "";
    var i = t.lastIndexOf(" · ");
    if (brand.name_en) document.title = (i >= 0 ? t.slice(0, i) : t) + " · " + brand.name_en;
  }

  // Buttons marked data-share-kind="pdf|image|text" follow Settings › Finder and sharing (plan D6).
  function applySharing(sharing) {
    var s = sharing || { pdf: false, image: true, text: true };
    document.querySelectorAll("[data-share-kind]").forEach(function (el) { el.hidden = !s[el.getAttribute("data-share-kind")]; });
  }
  function sharingOn(kind) {
    var s = data && data.sharing;
    return s ? !!s[kind] : kind !== "pdf";
  }

  // Elements with data-text-key take the super admin's wording (Settings › Texts, plan D8). Without it they
  // show the page's own wording: the data-i18n English through i18n/te.js (21 Nov 2026), or, for elements not
  // moved yet, their data-en / data-te. The page's own English is kept in data-orig so an emptied box brings it back.
  function applyTexts(texts) {
    var lang = (typeof currentLang !== "undefined" && currentLang === "te") ? "te" : "en";
    document.querySelectorAll("[data-text-key]").forEach(function (el) {
      if (el.hasAttribute("data-i18n") && el.dataset.i18nKey === undefined) {
        el.dataset.i18nKey = el.getAttribute("data-i18n") || el.textContent.replace(/\s+/g, " ").trim();   // before any override text
      }
      if (!el.hasAttribute("data-orig")) {
        el.setAttribute("data-orig", el.dataset.i18nKey || el.getAttribute("data-en") || el.textContent.trim());
      }
      var c = texts && texts[el.getAttribute("data-text-key")];
      var custom = c && (c[lang] || "").trim();
      if (custom) { el.textContent = custom; return; }
      if (lang === "te" && el.hasAttribute("data-te")) { el.textContent = el.getAttribute("data-te"); return; }
      el.textContent = typeof t === "function" ? t(el.getAttribute("data-orig")) : el.getAttribute("data-orig");
    });
    var line = texts && texts.site_footer, foot = document.getElementById("siteFooter");
    var footText = line ? ((line[lang] || "").trim() || (line.en || "").trim()) : "";
    var updated = updatedLine(data && data.build, lang);
    if (footText || updated) {
      if (!foot) { foot = document.createElement("footer"); foot.id = "siteFooter"; foot.className = "site-footer"; document.body.appendChild(foot); }
      foot.textContent = "";
      if (footText) { var t = document.createElement("div"); t.textContent = footText; foot.appendChild(t); }
      if (updated) { var u = document.createElement("small"); u.className = "site-footer__updated"; u.textContent = updated; foot.appendChild(u); }
    } else if (foot) foot.remove();
  }

  // "App updated: 21 Nov 2026, 10:32 am IST" from /app/config's build (the deploy time; on a developer's
  // machine the last commit's time). Shown in India time, whatever the viewer's own time zone.
  function updatedLine(build, lang) {
    var when = build && (build.deployed_at || build.committed_at);
    var d = when ? new Date(when) : null;
    if (!d || isNaN(d.getTime())) return "";
    var stamp;
    try {
      stamp = d.toLocaleString(lang === "te" ? "te-IN" : "en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short",
                                                                  year: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (e) {
      console.error("Update time could not be formatted", e);
      return "";
    }
    return (typeof t === "function" ? t("App updated: {stamp} IST", { stamp: stamp }) : "App updated: " + stamp + " IST") + (build.commit ? " · " + build.commit : "");
  }

  function apply() {
    if (!data) return;
    applyTheme(data.theme);
    var run = function () {
      applyBrand(data.brand);
      applySharing(data.sharing);
      applyTexts(data.texts);
      listeners.forEach(function (fn) { try { fn(data); } catch (e) { console.error("Site settings listener failed", e); } });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true }); else run();
  }

  try { data = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (e) { data = null; }
  if (data) applyTheme(data.theme);   // colours before the page paints

  function fetchConfig() {
    var base = (typeof API_BASE !== "undefined" && API_BASE) || "";
    return fetch(base + "/app/config").then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (fresh) {
      data = fresh;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch (e) { /* private window: no cache */ }
      apply();
      return fresh;
    }).catch(function (e) {
      console.error("Site settings could not be loaded; using the built-in look.", e);
      return data;
    });
  }

  var ready = fetchConfig();
  if (data) apply();

  return {
    get data() { return data; },
    ready: ready,
    reload: function () { return fetchConfig(); },
    sharingOn: sharingOn,
    applyTexts: function () { if (data) applyTexts(data.texts); },
    onChange: function (fn) { listeners.push(fn); if (data) { try { fn(data); } catch (e) { console.error(e); } } },
    // The super admin's wording for `key` in the current language (Settings › Texts), else the page's own
    // English through i18n/te.js (21 Nov 2026: one label, not an English and a Telugu one).
    text: function (key, en) {
      var c = data && data.texts && data.texts[key];
      var lang = (typeof currentLang !== "undefined" && currentLang === "te") ? "te" : "en";
      var custom = c && (c[lang] || "").trim();
      return custom || (typeof t === "function" ? t(en) : en);
    },
  };
})();
