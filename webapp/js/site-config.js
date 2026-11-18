// ============================================================
// Gayatri Jyotirnidhi · site settings on every page (Super Admin Control Plan S3–S7, 13 Nov 2026)
// Reads the public settings (/app/config) the super admin changes on the Settings page and applies
// the brand and theme. Pages read the rest through window.SiteConfig:
//   SiteConfig.data            the last settings (from this browser's cache first, then the server)
//   SiteConfig.ready           a promise for the server's settings
//   SiteConfig.onChange(fn)    called whenever new settings arrive
//   SiteConfig.text(key, en, te)  an editable text, or the page's own wording when it is empty
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

  // Elements with data-text-key take the super admin's wording (Settings › Texts, plan D8). Their own
  // data-en / data-te are kept in data-orig-* so an emptied box brings the page's wording back.
  function applyTexts(texts) {
    var lang = (typeof currentLang !== "undefined" && currentLang === "te") ? "te" : "en";
    document.querySelectorAll("[data-text-key]").forEach(function (el) {
      ["en", "te"].forEach(function (l) {
        if (!el.hasAttribute("data-orig-" + l)) el.setAttribute("data-orig-" + l, el.getAttribute("data-" + l) || el.textContent);
        var t = texts && texts[el.getAttribute("data-text-key")];
        var v = t && (t[l] || "").trim();
        el.setAttribute("data-" + l, v || el.getAttribute("data-orig-" + l));
      });
      el.textContent = el.getAttribute("data-" + lang);
    });
    var line = texts && texts.site_footer, foot = document.getElementById("siteFooter");
    var footText = line ? ((line[lang] || "").trim() || (line.en || "").trim()) : "";
    if (footText) {
      if (!foot) { foot = document.createElement("footer"); foot.id = "siteFooter"; foot.className = "site-footer"; document.body.appendChild(foot); }
      foot.textContent = footText;
    } else if (foot) foot.remove();
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
    text: function (key, en, te) {
      var t = data && data.texts && data.texts[key];
      var lang = (typeof currentLang !== "undefined" && currentLang === "te") ? "te" : "en";
      var custom = t && (t[lang] || "").trim();
      return custom || (lang === "te" ? te : en);
    },
  };
})();
