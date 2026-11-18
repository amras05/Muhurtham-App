// ============================================================
// Gayatri Jyotirnidhi · Settings page tabs (Super Admin Control Plan, step S2, 13 Nov 2026)
// Every adjustable setting from /admin/config, grouped in tabs. Each card: the fields, Save (a summary of
// the changes is shown first), Reset to default and its change history. The server checks every value
// again, so a refused value shows the server's reason. The older sections stay under the "System" tab.
// ============================================================
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  var TABS = [
    ["brand", "Brand and look", "బ్రాండ్, రూపం", ["brand", "theme"]],
    ["menu", "Menu and pages", "మెనూ, పేజీలు", ["nav", "landing"]],
    ["panchang", "Panchang", "పంచాంగం", ["panchang"]],
    ["places", "Places", "ప్రదేశాలు", ["places"]],
    ["finder", "Finder and sharing", "శోధన, పంచుకోవడం", ["finder", "sharing", "godavari"]],
    ["texts", "Texts", "పాఠ్యాలు", ["texts"]],
    ["security", "Accounts and security", "ఖాతాలు, భద్రత", ["security"]],
    ["admins", "Admin powers", "నిర్వాహకుల అధికారాలు", ["admin_powers", "admin_dashboard"]],
    ["system", "System", "వ్యవస్థ", []],
  ];
  var SECTION_LABELS = {
    live: ["Live cards (lagna, bad time, good time)", "ప్రత్యక్ష కార్డులు"], timeline: ["24-hour timeline", "24 గంటల కాల చక్రం"],
    times: ["Good and bad time lists", "శుభ, అశుభ సమయాల జాబితా"], yogas_panchaka: ["Special yogas and panchaka", "విశేష యోగాలు, పంచకం"],
    chandrabalam: ["Chandrabalam for each rashi", "రాశి వారి చంద్రబలం"], lagnas: ["The 12 lagnas", "12 లగ్నాలు"],
    dos: ["Good for / avoid today", "అనుకూల, వర్జ్యములు"], shloka: ["Today's shloka", "నేటి శ్లోకం"],
    cta: ["Muhurta Finder banner", "ముహూర్త శోధన బ్యానర్"], more: ["More details", "మరిన్ని వివరాలు"],
  };
  var POWER_LABELS = {
    users_view: ["See the Users page", "వినియోగదారుల పేజీ చూడడం"], users_view_mobile: ["See full mobile numbers", "పూర్తి మొబైల్ నంబర్లు చూడడం"],
    users_disable: ["Disable and enable users", "వినియోగదారులను నిలిపివేయడం, ప్రారంభించడం"], content_edit: ["Edit announcements and utpata dates", "ప్రకటనలు, ఉత్పాత తేదీలు మార్చడం"],
    audit_view_users: ["See users' activity", "వినియోగదారుల కార్యకలాపాలు చూడడం"], stats_view: ["See Statistics and system health", "గణాంకాలు, వ్యవస్థ స్థితి చూడడం"],
  };
  var DASH_LABELS = { stats: ["People counts", "వినియోగదారుల సంఖ్యలు"], attention: ["Needs attention", "గమనించవలసినవి"],
                      activity: ["Recent activity", "ఇటీవలి కార్యకలాపాలు"], tools: ["Tool tiles", "సాధనాల టైల్స్"] };
  var THEME_LABELS = { sanctuary: ["Vedic Sanctuary (green and gold)", "వేద శరణ్యం (ఆకుపచ్చ, బంగారం)"],
                       classic: ["Classic (maroon and gold)", "సాంప్రదాయ (మెరూన్, బంగారం)"], saffron: ["Saffron (orange and brown)", "కాషాయం (నారింజ, గోధుమ)"] };
  var THEME_DEFAULTS = { sanctuary: ["#3c6600", "#d4af37"], classic: ["#6f1725", "#c59b27"], saffron: ["#a14a00", "#e0a526"] };

  var cfg = null, form = {}, active = "brand";

  async function api(method, path, body) {
    var res = await fetch(API_BASE + path, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) {
      var d = data && data.detail;
      if (d && d.errors) {
        throw new Error(Object.keys(d.errors).map(function (k) { return label(k) + ": " + d.errors[k]; }).join(" · "));
      }
      throw new Error(Auth.errorText({ status: res.status, data: data }));
    }
    return data;
  }
  function label(key) { var m = cfg && cfg.meta[key]; return m ? tr(m.label_en, m.label_te) : key; }

  // ── Contrast check (WCAG): white text on the main colour, dark text on the gold ──
  function lum(hex) {
    var c = [1, 3, 5].map(function (i) { var v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  // ── Small field builders; every input carries data-key and data-path into `form` ──
  function inputAttrs(key, path) { return 'data-key="' + key + '" data-path="' + path + '"'; }
  function get(obj, path) { return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }
  function setPath(obj, path, v) { var ks = path.split("."), o = obj; ks.slice(0, -1).forEach(function (k) { o = o[k]; }); o[ks[ks.length - 1]] = v; }
  function text(key, path, en, te, opts) {
    opts = opts || {};
    var id = "cf_" + key + "_" + path.replace(/\W/g, "_");
    var tag = opts.area ? '<textarea rows="2" ' : '<input type="' + (opts.type || "text") + '" ';
    var extra = (opts.min != null ? ' min="' + opts.min + '"' : "") + (opts.max != null ? ' max="' + opts.max + '"' : "") + (opts.step ? ' step="' + opts.step + '"' : "") + (opts.maxlength ? ' maxlength="' + opts.maxlength + '"' : "");
    var val = get(form[key], path);
    var field = opts.area ? tag + 'id="' + id + '" ' + inputAttrs(key, path) + extra + ">" + esc(val) + "</textarea>"
                          : tag + 'id="' + id + '" ' + inputAttrs(key, path) + extra + ' value="' + esc(val == null ? "" : val) + '">';
    return '<div class="field"><label for="' + id + '">' + tr(en, te) + (opts.hint ? ' <small class="cf-hint">' + esc(opts.hint) + "</small>" : "") + "</label>" + field + "</div>";
  }
  function check(key, path, en, te) {
    var id = "cf_" + key + "_" + path.replace(/\W/g, "_");
    return '<label class="switch" for="' + id + '"><input type="checkbox" id="' + id + '" ' + inputAttrs(key, path) + (get(form[key], path) ? " checked" : "") + "> <span>" + tr(en, te) + "</span></label>";
  }
  function select(key, path, en, te, options) {
    var id = "cf_" + key + "_" + path.replace(/\W/g, "_"), cur = get(form[key], path);
    return '<div class="field"><label for="' + id + '">' + tr(en, te) + '</label><select id="' + id + '" ' + inputAttrs(key, path) + ">" +
      options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></div>";
  }

  // ── One card per setting: fields + Save / Reset / History ──
  function card(key, bodyHtml, intro) {
    var changed = !same(form[key], cfg.values[key]);
    var isDefault = same(cfg.values[key], cfg.meta[key].default);
    return '<section class="portal-card cf-card" data-card="' + key + '" aria-labelledby="cfh_' + key + '">' +
      '<div class="cf-card__head"><h2 id="cfh_' + key + '">' + esc(label(key)) + "</h2>" +
        (isDefault ? '<span class="status-chip status-chip--active">' + tr("Default", "డిఫాల్ట్") + "</span>" : '<span class="status-chip status-chip--pending">' + tr("Changed", "మార్చారు") + "</span>") + "</div>" +
      (intro ? '<p class="portal-hint">' + intro + "</p>" : "") +
      '<div class="cf-body">' + bodyHtml + "</div>" +
      '<div class="row-form cf-actions">' +
        '<button type="button" class="btn btn--primary" data-save="' + key + '"' + (changed ? "" : " disabled") + ">" + tr("Save", "భద్రపరచండి") + "</button>" +
        '<button type="button" class="btn btn--outline" data-undo="' + key + '"' + (changed ? "" : " disabled") + ">" + tr("Undo my edits", "మార్పులు రద్దు") + "</button>" +
        '<button type="button" class="btn btn--outline" data-reset="' + key + '"' + (isDefault ? " disabled" : "") + ">" + tr("Reset to default", "డిఫాల్ట్‌కు మార్చండి") + "</button>" +
        '<button type="button" class="linkish" data-history="' + key + '">' + tr("Change history", "మార్పుల చరిత్ర") + "</button>" +
      "</div>" +
      '<div class="cf-history" id="cfhist_' + key + '" hidden></div>' +
    "</section>";
  }

  // ── Tab bodies ──
  var BODIES = {
    brand: function (k) {
      return text(k, "name_te", "Name (Telugu)", "పేరు (తెలుగు)", { maxlength: 60 }) + text(k, "name_en", "Name (English)", "పేరు (ఇంగ్లీష్)", { maxlength: 60 }) +
        text(k, "tagline_te", "Tagline (Telugu)", "ఉపశీర్షిక (తెలుగు)", { maxlength: 90 }) + text(k, "tagline_en", "Tagline (English)", "ఉపశీర్షిక (ఇంగ్లీష్)", { maxlength: 90 }) +
        select(k, "icon", "Logo icon", "లోగో చిహ్నం", cfg.meta._choices.icons.map(function (i) { return [i, i]; })) +
        '<div class="cf-preview" aria-hidden="true"><span class="brand-mark">' + Icon(form[k].icon) + '</span><span class="brand-text"><span class="brand-name">' + esc(currentLang === "te" ? form[k].name_te : form[k].name_en) +
        '</span><span class="brand-tag">' + esc(currentLang === "te" ? form[k].tagline_te : form[k].tagline_en) + "</span></span></div>";
    },
    theme: function (k) {
      var t = form[k], d = THEME_DEFAULTS[t.preset] || THEME_DEFAULTS.sanctuary;
      var primary = t.primary || d[0], gold = t.gold || d[1];
      var c1 = contrast(primary, "#ffffff"), c2 = contrast(gold, "#241a00");
      return select(k, "preset", "Theme", "థీమ్", cfg.meta._choices.themes.map(function (p) { return [p, tr(THEME_LABELS[p][0], THEME_LABELS[p][1])]; })) +
        '<div class="cf-colors">' +
          '<div class="field"><label for="cfPrimary">' + tr("Main colour (buttons, brand)", "ప్రధాన రంగు (బటన్లు, బ్రాండ్)") + '</label><input type="color" id="cfPrimary" data-color="primary" value="' + primary + '"></div>' +
          '<div class="field"><label for="cfGold">' + tr("Accent colour (gold)", "అనుబంధ రంగు (బంగారం)") + '</label><input type="color" id="cfGold" data-color="gold" value="' + gold + '"></div>' +
          '<button type="button" class="linkish" data-color-reset="1">' + tr("Use the theme's own colours", "థీమ్ రంగులనే వాడండి") + "</button>" +
        "</div>" +
        '<p class="cf-contrast ' + (c1 >= 4.5 ? "is-ok" : "is-bad") + '">' + tr("White text on the main colour", "ప్రధాన రంగుపై తెలుపు అక్షరాలు") + ": " + c1.toFixed(1) + ":1 " + (c1 >= 4.5 ? "✓" : tr("— too faint (needs 4.5)", "— చదవడం కష్టం (4.5 కావాలి)")) + "</p>" +
        '<p class="cf-contrast ' + (c2 >= 4.5 ? "is-ok" : "is-bad") + '">' + tr("Dark text on the accent", "అనుబంధ రంగుపై ముదురు అక్షరాలు") + ": " + c2.toFixed(1) + ":1 " + (c2 >= 4.5 ? "✓" : tr("— too faint (needs 4.5)", "— చదవడం కష్టం (4.5 కావాలి)")) + "</p>";
    },
    nav: function (k) {
      return '<div class="table-scroll"><table class="people-table cf-table"><thead><tr><th>' + tr("Order", "క్రమం") + "</th><th>" + tr("Page", "పేజీ") + "</th><th>" + tr("Shown", "చూపించు") + "</th><th>English</th><th>తెలుగు</th></tr></thead><tbody>" +
        form[k].items.map(function (it, i) {
          var locked = it.href === "admin-settings.html";
          return "<tr><td class=\"cf-order\"><button type=\"button\" class=\"btn btn--sm btn--outline\" data-move=\"nav:" + i + ":-1\" aria-label=\"Up\"" + (i === 0 ? " disabled" : "") + ">↑</button>" +
            "<button type=\"button\" class=\"btn btn--sm btn--outline\" data-move=\"nav:" + i + ":1\" aria-label=\"Down\"" + (i === form[k].items.length - 1 ? " disabled" : "") + ">↓</button></td>" +
            "<td><code>" + esc(it.href) + "</code></td>" +
            '<td><input type="checkbox" aria-label="Shown" ' + inputAttrs(k, "items." + i + ".show") + (it.show ? " checked" : "") + (locked ? " disabled" : "") + "></td>" +
            '<td><input type="text" maxlength="40" aria-label="English" ' + inputAttrs(k, "items." + i + ".en") + ' value="' + esc(it.en) + '"></td>' +
            '<td><input type="text" maxlength="40" aria-label="Telugu" ' + inputAttrs(k, "items." + i + ".te") + ' value="' + esc(it.te) + '"></td></tr>';
        }).join("") + "</tbody></table></div>";
    },
    landing: function (k) {
      var pages = cfg.meta._choices.pages.map(function (p) { return [p, p.replace("/", "")]; });
      return select(k, "user", "Users land on", "వినియోగదారులు చేరే పేజీ", pages) + select(k, "admin", "Admins land on", "నిర్వాహకులు చేరే పేజీ", pages) +
        select(k, "super_admin", "Super admin lands on", "ప్రధాన నిర్వాహకులు చేరే పేజీ", pages);
    },
    panchang: function (k) {
      return '<fieldset class="nf-alerts"><legend>' + tr("Sections on Today's Panchang", "నేటి పంచాంగంలో భాగాలు") + "</legend>" +
          cfg.meta._choices.panchang_sections.map(function (s) { return check(k, "sections." + s, SECTION_LABELS[s][0], SECTION_LABELS[s][1]); }).join("") + "</fieldset>" +
        text(k, "refresh_seconds", "Live view refresh (seconds)", "ప్రత్యక్ష నవీకరణ (సెకన్లు)", { type: "number", min: 15, max: 300, hint: "15–300" }) +
        "<h3>" + tr("Default place (people without a home place)", "డిఫాల్ట్ ప్రదేశం (ఇంటి ప్రదేశం లేని వారికి)") + "</h3>" +
        '<div class="cf-grid">' + text(k, "default_place.name", "Name", "పేరు", { maxlength: 80 }) + text(k, "default_place.lat", "Latitude", "అక్షాంశం", { type: "number", min: -90, max: 90, step: "0.0001" }) +
        text(k, "default_place.lon", "Longitude", "రేఖాంశం", { type: "number", min: -180, max: 180, step: "0.0001" }) + text(k, "default_place.tz", "Time zone (hours from UTC)", "టైమ్ జోన్ (UTC నుండి గంటలు)", { type: "number", min: -12, max: 14, step: "0.25" }) + "</div>";
    },
    places: function (k) {
      return '<div class="table-scroll"><table class="people-table cf-table"><thead><tr><th>' + tr("Order", "క్రమం") + "</th><th>Id</th><th>" + tr("Name", "పేరు") + "</th><th>" + tr("Latitude", "అక్షాంశం") + "</th><th>" + tr("Longitude", "రేఖాంశం") + "</th><th>" + tr("Time zone", "టైమ్ జోన్") + "</th><th></th></tr></thead><tbody>" +
        form[k].items.map(function (p, i) {
          return "<tr><td class=\"cf-order\"><button type=\"button\" class=\"btn btn--sm btn--outline\" data-move=\"places:" + i + ":-1\" aria-label=\"Up\"" + (i === 0 ? " disabled" : "") + ">↑</button>" +
            "<button type=\"button\" class=\"btn btn--sm btn--outline\" data-move=\"places:" + i + ":1\" aria-label=\"Down\"" + (i === form[k].items.length - 1 ? " disabled" : "") + ">↓</button></td>" +
            '<td><input type="text" maxlength="40" aria-label="Id" ' + inputAttrs(k, "items." + i + ".id") + ' value="' + esc(p.id) + '"></td>' +
            '<td><input type="text" maxlength="80" aria-label="Name" ' + inputAttrs(k, "items." + i + ".label") + ' value="' + esc(p.label) + '"></td>' +
            '<td><input type="number" step="0.0001" min="-90" max="90" aria-label="Latitude" ' + inputAttrs(k, "items." + i + ".lat") + ' value="' + p.lat + '"></td>' +
            '<td><input type="number" step="0.0001" min="-180" max="180" aria-label="Longitude" ' + inputAttrs(k, "items." + i + ".lon") + ' value="' + p.lon + '"></td>' +
            '<td><input type="number" step="0.25" min="-12" max="14" aria-label="Time zone" ' + inputAttrs(k, "items." + i + ".tz_offset") + ' value="' + p.tz_offset + '"></td>' +
            '<td><button type="button" class="btn btn--sm btn--outline" data-remove="places:' + i + '">' + tr("Remove", "తొలగించు") + "</button></td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<button type="button" class="btn btn--outline" data-add-place="1">+ ' + tr("Add a place", "ప్రదేశం చేర్చండి") + "</button>";
    },
    finder: function (k) {
      return text(k, "search_days", "How far a person search looks ahead (days)", "వ్యక్తి శోధన ఎంత ముందు వరకు (రోజులు)", { type: "number", min: 60, max: 730, hint: "60–730" }) +
        text(k, "chunk_days", "Days loaded at a time", "ఒక్కసారి లోడ్ అయ్యే రోజులు", { type: "number", min: 15, max: 120, hint: "15–120" });
    },
    sharing: function (k) {
      return check(k, "pdf", "PDF download buttons", "PDF డౌన్‌లోడ్ బటన్లు") + check(k, "image", "Share as image", "చిత్రంగా పంచుకోవడం") + check(k, "text", "Share as text", "పాఠ్యంగా పంచుకోవడం");
    },
    godavari: function (k) {
      return check(k, "enabled", "No muhurtas near the Godavari while Jupiter is in Simha", "గురుడు సింహంలో ఉన్నప్పుడు గోదావరి సమీపంలో ముహూర్తాలు లేవు") +
        text(k, "km", "Counts as near within (km)", "సమీపం అంటే (కి.మీ. లోపు)", { type: "number", min: 10, max: 100, hint: "10–100" });
    },
    texts: function (k) {
      return Object.keys(cfg.meta._choices.texts).map(function (t) {
        return "<h3>" + esc(cfg.meta._choices.texts[t]) + '</h3><div class="cf-grid">' +
          text(k, t + ".en", "English", "ఇంగ్లీష్", { area: true, maxlength: 400 }) + text(k, t + ".te", "Telugu", "తెలుగు", { area: true, maxlength: 400 }) + "</div>";
      }).join("");
    },
    security: function (k) {
      return text(k, "session_days", "A sign-in lasts (days)", "లాగిన్ ఎన్ని రోజులు ఉంటుంది", { type: "number", min: 1, max: 90, hint: "1–90" }) +
        text(k, "login_fails_before_lock", "Lock an account after this many wrong passwords", "ఇన్ని తప్పు పాస్‌వర్డ్‌ల తర్వాత ఖాతా లాక్", { type: "number", min: 3, max: 10, hint: "3–10" }) +
        text(k, "lock_minutes", "Lock for (minutes)", "లాక్ సమయం (నిమిషాలు)", { type: "number", min: 5, max: 1440, hint: "5–1440" }) +
        text(k, "otp_attempts", "Tries allowed for a WhatsApp code", "వాట్సాప్ కోడ్‌కు అనుమతించే ప్రయత్నాలు", { type: "number", min: 3, max: 10, hint: "3–10" });
    },
    admin_powers: function (k) {
      return cfg.meta._choices.admin_powers.map(function (p) { return check(k, p, POWER_LABELS[p][0], POWER_LABELS[p][1]); }).join("");
    },
    admin_dashboard: function (k) {
      return Object.keys(DASH_LABELS).map(function (p) { return check(k, p, DASH_LABELS[p][0], DASH_LABELS[p][1]); }).join("");
    },
  };
  var INTROS = {
    nav: ["Hide a page instead of removing it. Who may open a page is still decided by the server. The Settings link always shows.",
          "పేజీని తొలగించకుండా దాచండి. ఎవరు ఏ పేజీ తెరవవచ్చో సర్వర్ నిర్ణయిస్తుంది. సెట్టింగుల లింక్ ఎప్పుడూ కనిపిస్తుంది."],
    texts: ["Leave a box empty to keep the page's own wording.", "పేజీ స్వంత పదాలు ఉంచాలంటే ఖాళీగా వదలండి."],
    security: ["Values outside the limits are refused, so a mistake can't weaken security.", "పరిమితులు దాటిన విలువలు అంగీకరించబడవు."],
    admin_powers: ["The server checks these too. Your own powers can't be changed here.", "సర్వర్ కూడా వీటిని పరిశీలిస్తుంది. మీ అధికారాలు ఇక్కడ మారవు."],
    godavari: ["Your own ruling: while Jupiter is in Simha, places near the Godavari get no muhurtas.", "మీ నిర్ణయం: గురుడు సింహంలో ఉన్నప్పుడు గోదావరి సమీప ప్రాంతాలకు ముహూర్తాలు లేవు."],
  };

  function renderTabs() {
    $("cfTabs").innerHTML = TABS.map(function (t) {
      return '<button type="button" role="tab" class="cf-tab" id="cftab_' + t[0] + '" aria-selected="' + (t[0] === active) + '" aria-controls="cfPanel">' + tr(t[1], t[2]) + "</button>";
    }).join("");
  }
  function render() {
    renderTabs();
    var tab = TABS.find(function (t) { return t[0] === active; });
    $("cfSystem").hidden = active !== "system";
    $("cfPanel").hidden = active === "system";
    if (active === "system" || !cfg) return;
    $("cfPanel").innerHTML = tab[3].map(function (k) {
      var intro = INTROS[k] ? tr(INTROS[k][0], INTROS[k][1]) : "";
      return card(k, BODIES[k](k), intro);
    }).join("");
    if (window.Icon && Icon.hydrate) Icon.hydrate($("cfPanel"));
  }
  function refreshCard(key) {
    var el = document.querySelector('[data-card="' + key + '"]');
    if (!el) return render();
    var focusId = document.activeElement && document.activeElement.id;
    var intro = INTROS[key] ? tr(INTROS[key][0], INTROS[key][1]) : "";
    el.outerHTML = card(key, BODIES[key](key), intro);
    if (focusId && $(focusId)) $(focusId).focus();
  }
  function updateButtons(key) {
    var el = document.querySelector('[data-card="' + key + '"]');
    if (!el) return;
    var changed = !same(form[key], cfg.values[key]);
    el.querySelector("[data-save]").disabled = !changed;
    el.querySelector("[data-undo]").disabled = !changed;
  }

  // ── Events ──
  document.addEventListener("input", function (e) {
    var t = e.target, key = t.getAttribute && t.getAttribute("data-key");
    if (t.getAttribute && t.getAttribute("data-color")) {
      form.theme[t.getAttribute("data-color")] = t.value;
      return refreshCard("theme");
    }
    if (!key || !form[key]) return;
    var path = t.getAttribute("data-path"), v;
    if (t.type === "checkbox") v = t.checked;
    else if (t.type === "number") v = t.value === "" ? null : Number(t.value);
    else v = t.value;
    setPath(form[key], path, v);
    if (key === "brand" || (key === "theme" && path === "preset")) refreshCard(key); else updateButtons(key);
  });
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.tagName === "SELECT" && t.getAttribute("data-key")) {
      setPath(form[t.getAttribute("data-key")], t.getAttribute("data-path"), t.value);
      refreshCard(t.getAttribute("data-key"));
    }
  });
  document.addEventListener("click", async function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var tabBtn = b.id && b.id.indexOf("cftab_") === 0 ? b.id.slice(6) : null;
    if (tabBtn) { active = tabBtn; try { history.replaceState(null, "", "#" + active); } catch (x) { /* ignore */ } return render(); }
    var mv = b.getAttribute("data-move");
    if (mv) {
      var p = mv.split(":"), list = form[p[0]].items, i = Number(p[1]), j = i + Number(p[2]);
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      return refreshCard(p[0]);
    }
    var rm = b.getAttribute("data-remove");
    if (rm) { var q = rm.split(":"); form[q[0]].items.splice(Number(q[1]), 1); return refreshCard(q[0]); }
    if (b.getAttribute("data-add-place")) {
      form.places.items.push({ id: "place" + (form.places.items.length + 1), label: "", lat: 17.385, lon: 78.4867, tz_offset: 5.5 });
      return refreshCard("places");
    }
    if (b.getAttribute("data-color-reset")) { form.theme.primary = null; form.theme.gold = null; return refreshCard("theme"); }
    var undo = b.getAttribute("data-undo");
    if (undo) { form[undo] = clone(cfg.values[undo]); return refreshCard(undo); }
    var save = b.getAttribute("data-save");
    if (save) return doSave(save);
    var reset = b.getAttribute("data-reset");
    if (reset) return doReset(reset);
    var hist = b.getAttribute("data-history");
    if (hist) return showHistory(hist);
  });

  function summary(key) {
    var before = cfg.values[key], after = form[key], lines = [];
    (function walk(a, b, path) {
      if (same(a, b)) return;
      if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
        Object.keys(Object.assign({}, a, b)).forEach(function (k2) { walk(a[k2], b[k2], path ? path + "." + k2 : k2); });
      } else if (Array.isArray(a) || Array.isArray(b)) {
        lines.push((path || key) + ": " + tr("list changed", "జాబితా మారింది"));
      } else {
        lines.push((path || key) + ": " + JSON.stringify(a) + " → " + JSON.stringify(b));
      }
    })(before, after, "");
    return lines.slice(0, 12).join("\n") + (lines.length > 12 ? "\n…" : "");
  }
  async function doSave(key) {
    if (key === "theme") {
      var d = THEME_DEFAULTS[form.theme.preset] || THEME_DEFAULTS.sanctuary;
      if (contrast(form.theme.primary || d[0], "#ffffff") < 4.5 || contrast(form.theme.gold || d[1], "#241a00") < 4.5) {
        return AppShell.toast(tr("Text would be hard to read on these colours. Pick darker or lighter ones.", "ఈ రంగులపై అక్షరాలు చదవడం కష్టం. వేరే రంగులు ఎంచుకోండి."), "error");
      }
    }
    var ok = await AppShell.confirm(tr("Save these changes to “" + label(key) + "”?", "“" + label(key) + "” లో ఈ మార్పులు భద్రపరచాలా?") + "\n\n" + summary(key),
                                    { ok: tr("Save", "భద్రపరచండి"), cancel: tr("Keep editing", "మార్చడం కొనసాగించండి") });
    if (!ok) return;
    try {
      var r = await api("PUT", "/admin/config", { changes: (function () { var c = {}; c[key] = form[key]; return c; })() });
      cfg.values = r.values; form[key] = clone(r.values[key]);
      AppShell.toast(tr("Saved. Every page follows within 15 seconds.", "భద్రపరచాము. 15 సెకన్లలో అన్ని పేజీలకు అమలవుతుంది."), "success");
      refreshCard(key);
      if (window.SiteConfig) SiteConfig.reload();
    } catch (err) { AppShell.toast(err.message, "error"); }
  }
  async function doReset(key) {
    var ok = await AppShell.confirm(tr("Put “" + label(key) + "” back to its default?", "“" + label(key) + "” ను డిఫాల్ట్‌కు మార్చాలా?"),
                                    { ok: tr("Reset", "మార్చండి"), cancel: tr("Keep", "ఉంచండి"), danger: true });
    if (!ok) return;
    try {
      var r = await api("POST", "/admin/config/" + key + "/reset");
      cfg.values = r.values; form[key] = clone(r.values[key]);
      AppShell.toast(tr("Back to the default.", "డిఫాల్ట్‌కు మార్చాము."), "success");
      refreshCard(key);
      if (window.SiteConfig) SiteConfig.reload();
    } catch (err) { AppShell.toast(err.message, "error"); }
  }
  async function showHistory(key) {
    var box = $("cfhist_" + key);
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false; box.innerHTML = '<span class="skeleton skeleton--line" role="status" aria-label="Loading"></span>';
    try {
      var r = await api("GET", "/admin/config/history?key=" + encodeURIComponent(key) + "&limit=20");
      box.innerHTML = r.items.length ? '<ul class="activity">' + r.items.map(function (h) {
        var t = new Date(h.at);
        return "<li><time>" + esc(t.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " + t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) +
          "</time><span><strong>" + esc(h.who) + "</strong> · " + esc(h.action === "config.reset" ? tr("reset to default", "డిఫాల్ట్‌కు మార్చారు") : tr("changed", "మార్చారు")) +
          '<br><small class="cf-detail">' + esc(h.details || "") + "</small></span></li>";
      }).join("") + "</ul>" : '<p class="portal-hint">' + tr("Not changed yet.", "ఇంకా మార్చలేదు.") + "</p>";
    } catch (err) { box.innerHTML = '<p class="portal-hint">' + esc(err.message) + "</p>"; }
  }

  async function load() {
    try {
      cfg = await api("GET", "/admin/config");
      form = clone(cfg.values);
      var h = (location.hash || "").slice(1);
      if (TABS.some(function (t) { return t[0] === h; })) active = h;
      render();
    } catch (err) { $("cfPanel").innerHTML = '<p class="portal-hint">' + esc(err.message) + "</p>"; }
  }
  var prevLang = window.onLangChange;
  window.onLangChange = function () { if (typeof prevLang === "function") prevLang(); render(); };
  renderTabs();
  load();
})();
