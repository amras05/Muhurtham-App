// ============================================================
// Gayathri Jyothirnidhe · Settings page tabs (Super Admin Control Plan, step S2, 13 Nov 2026)
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
    ["brand", "Brand and look", ["brand", "theme"]],
    ["menu", "Menu and pages", ["nav", "landing"]],
    ["panchang", "Panchang", ["panchang"]],
    ["places", "Places", ["places"]],
    ["finder", "Finder and sharing", ["finder", "dosha_scoring", "sharing", "godavari"]],
    ["texts", "Texts", ["texts"]],
    ["security", "Accounts and security", ["security"]],
    ["admins", "Privileges & powers", ["admin_powers", "user_powers", "admin_dashboard"]],
    ["system", "System", []],
  ];
  var SECTION_LABELS = {
    live: ["Live cards (lagna, bad time, good time)"], timeline: ["24-hour timeline"],
    times: ["Good and bad time lists"], yogas_panchaka: ["Special yogas and panchaka"],
    chandrabalam: ["Chandrabalam for each rashi"], lagnas: ["The 12 lagnas"],
    dos: ["Good for / avoid today"], shloka: ["Today's shloka"],
    cta: ["Muhurta Finder banner"], more: ["More details"],
  };
  var USER_PERM_GROUPS = [
    {
      id: "panchang",
      parent: "panchang_view",
      title: ["Today's Panchangam"],
      children: [
        { key: "panchang_change_place", label: ["Change City / Location"] },
        { key: "panchang_change_date", label: ["Change Date (Calendar & Prev/Next)"] },
        { key: "panchang_share", label: ["Share Panchang (Link, WhatsApp, Image)"] },
        { key: "panchang_pdf", label: ["Download Panchang as PDF"] },
        { key: "panchang_month", label: ["Switch to Monthly View Link"] },
        { key: "panchang_find_muhurtha", label: ["Find Muhurtham CTA Banner"] },
        { key: "panchang_live_cards", label: ["Live Cards (Lagna, Good/Bad Times)"] },
        { key: "panchang_angas", label: ["Principal Angas (Tithi, Nakshatra, Yoga, Karana, Vara)"] },
        { key: "panchang_timeline", label: ["24-Hour Day Timeline"] },
        { key: "panchang_timings", label: ["Good & Bad Times (Rahu, Yama, Durmuhurtha, Varjyam)"] },
        { key: "panchang_ashta_kaalas", label: ["Dina Ashta Kaalas (8 Divisions)"] },
        { key: "panchang_hora_choghadiya", label: ["Hora & Choghadiya Tables"] },
        { key: "panchang_chandrabalam", label: ["Chandrabalam for All Rashis"] },
        { key: "panchang_lagnas", label: ["12 Lagnas Detailed Table"] },
        { key: "panchang_shloka", label: ["Daily Shloka & Mantra"] }
      ]
    },
    {
      id: "month",
      parent: "month_view",
      title: ["Monthly Panchangam"],
      children: [
        { key: "month_navigate", label: ["Month & Year Navigator"] },
        { key: "month_day_details", label: ["Day Details Modal / Popover"] },
        { key: "month_pdf", label: ["Export Month Calendar as PDF"] },
        { key: "month_festivals", label: ["Festivals & Vratams Markers"] }
      ]
    },
    {
      id: "muhurta",
      parent: "muhurta_search",
      title: ["Muhurtha Darshini / Finder"],
      children: [
        { key: "muhurta_select_activity", label: ["Select Activity & Category (Vivaha, Gruhapravesha...)"] },
        { key: "muhurta_date_range", label: ["Custom Date Range Selection"] },
        { key: "muhurta_time_filters", label: ["Time Window Filters (Morning, Evening...)"] },
        { key: "muhurta_participants", label: ["Participant Birth Chart Matching (Bride, Groom, Vatu)"] },
        { key: "muhurta_audit", label: ["Muhurtha Parishilana (Quality Audit Tab)"] },
        { key: "muhurta_save", label: ["Save Muhurtham to Vault"] },
        { key: "muhurta_delete", label: ["Delete Saved Muhurthams"] },
        { key: "muhurta_export", label: ["Export & Share Muhurtham (PDF, Image, Text)"] }
      ]
    },
    {
      id: "catalog",
      parent: "catalog_view",
      title: ["All Muhurtas Catalog"],
      children: [
        { key: "catalog_browse", label: ["Browse All 106+ Muhurtha Activities"] },
        { key: "catalog_search", label: ["Search & Filter Catalog"] },
        { key: "catalog_rules", label: ["View Activity Rules & Dosha Guidelines"] }
      ]
    },
    {
      id: "family",
      parent: "family_view",
      title: ["Family Vault"],
      children: [
        { key: "family_add", label: ["Add New Family Member"] },
        { key: "family_view_details", label: ["View Encrypted Birth Details (DOB, TOB, POB)"] },
        { key: "family_edit", label: ["Edit Family Member Details"] },
        { key: "family_delete", label: ["Remove Family Member"] },
        { key: "family_events", label: ["Family Events & Shannavati Rites"] },
        { key: "family_export", label: ["Export Family Vault Data"] }
      ]
    },
    {
      id: "saved",
      parent: "saved_view",
      title: ["My Saved Muhurtas"],
      children: [
        { key: "saved_favourite", label: ["Star / Favourite Saved Searches"] },
        { key: "saved_edit_label", label: ["Edit Custom Notes & Labels"] },
        { key: "saved_delete", label: ["Delete Saved Searches"] },
        { key: "saved_export", label: ["Download & Export Saved Searches"] }
      ]
    },
    {
      id: "account",
      parent: "self_edit",
      title: ["Account & Profile"],
      children: [
        { key: "self_edit_name", label: ["Edit Display Name"] },
        { key: "self_edit_language", label: ["Change Preferred Language (Telugu / English)"] },
        { key: "self_edit_home_place", label: ["Change Home City & Coordinates"] },
        { key: "self_sessions", label: ["View & Revoke Active Device Sessions"] },
        { key: "self_delete_account", label: ["Request Account Deletion"] }
      ]
    }
  ];

  var ADMIN_PERM_GROUPS = [
    {
      id: "users_mgmt",
      parent: "users_view",
      title: ["Users Management"],
      children: [
        { key: "users_view_mobile", label: ["Reveal Full Mobile Numbers"] },
        { key: "users_disable", label: ["Disable and Enable Users"] },
        { key: "invite_users", label: ["Add New Users (with a password)"] },
        { key: "set_user_passwords", label: ["Set a User's Password"] },
        { key: "edit_user_profile", label: ["Edit User Profile (Name, Phone, Language)"] },
        { key: "delete_user", label: ["Permanently Delete User Account"] },
        { key: "reset_user_sessions", label: ["Force Logout User Sessions"] },
        { key: "export_users", label: ["Export Users List as CSV"] },
        { key: "set_user_permissions", label: ["Manage Per-User Permission Overrides"] }
      ]
    },
    {
      id: "content_mgmt",
      parent: "content_edit",
      title: ["Content & App Settings"],
      children: [
        { key: "content_announcements", label: ["Edit Platform Announcements & Banners"] },
        { key: "content_utpata", label: ["Manage Inauspicious Utpata Dates"] },
        { key: "content_texts", label: ["Edit App Texts & Banner Headlines"] },
        { key: "content_rules", label: ["View & Manage Muhurta Rules"] }
      ]
    },
    {
      id: "audit_mgmt",
      parent: "audit_view_users",
      title: ["Audit Logs & Analytics"],
      children: [
        { key: "stats_view", label: ["See Statistics & System Health"] },
        { key: "audit_export", label: ["Export Activity Audit Logs"] }
      ]
    }
  ];

  var POWER_LABELS = {};
  ADMIN_PERM_GROUPS.forEach(function (g) {
    g.children.forEach(function (c) { POWER_LABELS[c.key] = c.label; });
    POWER_LABELS[g.parent] = g.title;
  });
  var USER_POWER_LABELS = {};
  USER_PERM_GROUPS.forEach(function (g) {
    g.children.forEach(function (c) { USER_POWER_LABELS[c.key] = c.label; });
    USER_POWER_LABELS[g.parent] = g.title;
  });
  var DASH_LABELS = {
    stats: ["People counts"], attention: ["Needs attention"],
    activity: ["Recent activity"], tools: ["Tool tiles"]
  };
  var THEME_LABELS = {
    sanctuary: ["Vedic Sanctuary (green and gold)"],
    classic: ["Classic (maroon and gold)"], saffron: ["Saffron (orange and brown)"]
  };
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
  function text(key, path, en, opts) {
    opts = opts || {};
    var id = "cf_" + key + "_" + path.replace(/\W/g, "_");
    var tag = opts.area ? '<textarea rows="2" ' : '<input type="' + (opts.type || "text") + '" ';
    var extra = (opts.min != null ? ' min="' + opts.min + '"' : "") + (opts.max != null ? ' max="' + opts.max + '"' : "") + (opts.step ? ' step="' + opts.step + '"' : "") + (opts.maxlength ? ' maxlength="' + opts.maxlength + '"' : "");
    var val = get(form[key], path);
    var field = opts.area ? tag + 'id="' + id + '" ' + inputAttrs(key, path) + extra + ">" + esc(val) + "</textarea>"
      : tag + 'id="' + id + '" ' + inputAttrs(key, path) + extra + ' value="' + esc(val == null ? "" : val) + '">';
    return '<div class="field"><label for="' + id + '">' + t(en) + (opts.hint ? ' <small class="cf-hint">' + esc(opts.hint) + "</small>" : "") + "</label>" + field + "</div>";
  }
  function check(key, path, en, extraAttrs) {
    var id = "cf_" + key + "_" + path.replace(/\W/g, "_");
    return '<label class="switch" for="' + id + '"><input type="checkbox" id="' + id + '" ' + inputAttrs(key, path) + (extraAttrs ? " " + extraAttrs : "") + (get(form[key], path) ? " checked" : "") + "> <span>" + t(en) + "</span></label>";
  }
  function select(key, path, en, options) {
    var id = "cf_" + key + "_" + path.replace(/\W/g, "_"), cur = get(form[key], path);
    return '<div class="field"><label for="' + id + '">' + t(en) + '</label><select id="' + id + '" ' + inputAttrs(key, path) + ">" +
      options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></div>";
  }

  function renderPermTree(key, groups) {
    return '<div class="cf-perm-tree">' + groups.map(function (grp) {
      var isParentOn = !!get(form[key], grp.parent);
      var total = grp.children.length;
      var activeCount = grp.children.filter(function (c) { return !!get(form[key], c.key); }).length;
      var badgeCls = activeCount === total ? "is-full" : (activeCount === 0 ? "is-empty" : "");

      var childrenHtml = grp.children.map(function (c) {
        return '<div class="cf-perm-child">' +
          check(key, c.key, c.label, 'data-perm-child="' + grp.id + '"') +
          '</div>';
      }).join("");

      var parentId = "cf_" + key + "_" + grp.parent.replace(/\W/g, "_");
      return '<div class="cf-perm-group is-open" data-perm-group="' + grp.id + '">' +
        '<div class="cf-perm-header" data-toggle-accordion="' + grp.id + '">' +
        '<div class="cf-perm-title">' +
        '<span class="cf-perm-chevron" aria-hidden="true">&#9654;</span>' +
        '<span>' + esc(t(grp.title)) + '</span>' +
        '</div>' +
        '<div class="cf-perm-ctrls">' +
        '<span class="cf-perm-badge ' + badgeCls + '">' + activeCount + '/' + total + ' ' + t("active") + '</span>' +
        '<label class="switch" onclick="event.stopPropagation();" for="' + parentId + '">' +
        '<input type="checkbox" id="' + parentId + '" ' + inputAttrs(key, grp.parent) + ' data-perm-parent="' + grp.id + '"' + (isParentOn ? " checked" : "") + '> ' +
        '<span>' + t("Enable Section") + '</span>' +
        '</label>' +
        '</div>' +
        '</div>' +
        '<div class="cf-perm-children" data-group-children="' + grp.id + '">' +
        childrenHtml +
        '</div>' +
        '</div>';
    }).join("") + '</div>';
  }

  // ── One card per setting: fields + Save / Reset / History ──
  function card(key, bodyHtml, intro) {
    var changed = !same(form[key], cfg.values[key]);
    var isDefault = same(cfg.values[key], cfg.meta[key].default);
    return '<section class="portal-card cf-card" data-card="' + key + '" aria-labelledby="cfh_' + key + '">' +
      '<div class="cf-card__head"><h2 id="cfh_' + key + '">' + esc(label(key)) + "</h2>" +
      (isDefault ? '<span class="status-chip status-chip--active">' + t("Default") + "</span>" : '<span class="status-chip status-chip--pending">' + t("Changed") + "</span>") + "</div>" +
      (intro ? '<p class="portal-hint">' + intro + "</p>" : "") +
      '<div class="cf-body">' + bodyHtml + "</div>" +
      '<div class="row-form cf-actions">' +
      '<button type="button" class="btn btn--primary" data-save="' + key + '"' + (changed ? "" : " disabled") + ">" + t("Save") + "</button>" +
      '<button type="button" class="btn btn--outline" data-undo="' + key + '"' + (changed ? "" : " disabled") + ">" + t("Undo my edits") + "</button>" +
      '<button type="button" class="btn btn--outline" data-reset="' + key + '"' + (isDefault ? " disabled" : "") + ">" + t("Reset to default") + "</button>" +
      '<button type="button" class="linkish" data-history="' + key + '">' + t("Change history") + "</button>" +
      "</div>" +
      '<div class="cf-history" id="cfhist_' + key + '" hidden></div>' +
      "</section>";
  }

  // ── Tab bodies ──
  var BODIES = {
    brand: function (k) {
      return text(k, "name_te", "Name (Telugu)", { maxlength: 60 }) + text(k, "name_en", "Name (English)", { maxlength: 60 }) +
        text(k, "tagline_te", "Tagline (Telugu)", { maxlength: 90 }) + text(k, "tagline_en", "Tagline (English)", { maxlength: 90 }) +
        select(k, "icon", "Logo icon", cfg.meta._choices.icons.map(function (i) { return [i, i]; })) +
        '<div class="cf-preview" aria-hidden="true"><span class="brand-mark">' + Icon(form[k].icon) + '</span><span class="brand-text"><span class="brand-name">' + esc(currentLang === "te" ? form[k].name_te : form[k].name_en) +
        '</span><span class="brand-tag">' + esc(currentLang === "te" ? form[k].tagline_te : form[k].tagline_en) + "</span></span></div>";
    },
    theme: function (k) {
      var tv = form[k], d = THEME_DEFAULTS[tv.preset] || THEME_DEFAULTS.sanctuary;
      var primary = tv.primary || d[0], gold = tv.gold || d[1];
      var c1 = contrast(primary, "#ffffff"), c2 = contrast(gold, "#241a00");
      return select(k, "preset", "Theme", cfg.meta._choices.themes.map(function (p) { return [p, t(THEME_LABELS[p])]; })) +
        '<div class="cf-colors">' +
        '<div class="field"><label for="cfPrimary">' + t("Main colour (buttons, brand)") + '</label><input type="color" id="cfPrimary" data-color="primary" value="' + primary + '"></div>' +
        '<div class="field"><label for="cfGold">' + t("Accent colour (gold)") + '</label><input type="color" id="cfGold" data-color="gold" value="' + gold + '"></div>' +
        '<button type="button" class="linkish" data-color-reset="1">' + t("Use the theme's own colours") + "</button>" +
        "</div>" +
        '<p class="cf-contrast ' + (c1 >= 4.5 ? "is-ok" : "is-bad") + '">' + t("White text on the main colour") + ": " + c1.toFixed(1) + ":1 " + (c1 >= 4.5 ? "✓" : t("— too faint (needs 4.5)")) + "</p>" +
        '<p class="cf-contrast ' + (c2 >= 4.5 ? "is-ok" : "is-bad") + '">' + t("Dark text on the accent") + ": " + c2.toFixed(1) + ":1 " + (c2 >= 4.5 ? "✓" : t("— too faint (needs 4.5)")) + "</p>";
    },
    nav: function (k) {
      return '<div class="table-scroll"><table class="people-table cf-table"><thead><tr><th>' + t("Order") + "</th><th>" + t("Page") + "</th><th>" + t("Shown") + "</th><th>English</th><th>తెలుగు</th></tr></thead><tbody>" +
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
      return select(k, "user", "Users land on", pages) + select(k, "admin", "Admins land on", pages) +
        select(k, "super_admin", "Super admin lands on", pages);
    },
    panchang: function (k) {
      return '<fieldset class="nf-alerts"><legend>' + t("Sections on Today's Panchang") + "</legend>" +
        cfg.meta._choices.panchang_sections.map(function (s) { return check(k, "sections." + s, SECTION_LABELS[s]); }).join("") + "</fieldset>" +
        text(k, "refresh_seconds", "Live view refresh (seconds)", { type: "number", min: 15, max: 300, hint: "15–300" }) +
        "<h3>" + t("Default place (people without a home place)") + "</h3>" +
        '<div class="cf-grid">' + text(k, "default_place.name", "Name", { maxlength: 80 }) + text(k, "default_place.lat", "Latitude", { type: "number", min: -90, max: 90, step: "0.0001" }) +
        text(k, "default_place.lon", "Longitude", { type: "number", min: -180, max: 180, step: "0.0001" }) + text(k, "default_place.tz", "Time zone (hours from UTC)", { type: "number", min: -12, max: 14, step: "0.25" }) + "</div>";
    },
    places: function (k) {
      return '<div class="table-scroll"><table class="people-table cf-table"><thead><tr><th>' + t("Order") + "</th><th>Id</th><th>" + t("Name") + "</th><th>" + t("Latitude") + "</th><th>" + t("Longitude") + "</th><th>" + t("Time zone") + "</th><th></th></tr></thead><tbody>" +
        form[k].items.map(function (p, i) {
          return "<tr><td class=\"cf-order\"><button type=\"button\" class=\"btn btn--sm btn--outline\" data-move=\"places:" + i + ":-1\" aria-label=\"Up\"" + (i === 0 ? " disabled" : "") + ">↑</button>" +
            "<button type=\"button\" class=\"btn btn--sm btn--outline\" data-move=\"places:" + i + ":1\" aria-label=\"Down\"" + (i === form[k].items.length - 1 ? " disabled" : "") + ">↓</button></td>" +
            '<td><input type="text" maxlength="40" aria-label="Id" ' + inputAttrs(k, "items." + i + ".id") + ' value="' + esc(p.id) + '"></td>' +
            '<td><input type="text" maxlength="80" aria-label="Name" ' + inputAttrs(k, "items." + i + ".label") + ' value="' + esc(p.label) + '"></td>' +
            '<td><input type="number" step="0.0001" min="-90" max="90" aria-label="Latitude" ' + inputAttrs(k, "items." + i + ".lat") + ' value="' + p.lat + '"></td>' +
            '<td><input type="number" step="0.0001" min="-180" max="180" aria-label="Longitude" ' + inputAttrs(k, "items." + i + ".lon") + ' value="' + p.lon + '"></td>' +
            '<td><input type="number" step="0.25" min="-12" max="14" aria-label="Time zone" ' + inputAttrs(k, "items." + i + ".tz_offset") + ' value="' + p.tz_offset + '"></td>' +
            '<td><button type="button" class="btn btn--sm btn--outline" data-remove="places:' + i + '">' + t("Remove") + "</button></td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<button type="button" class="btn btn--outline" data-add-place="1">+ ' + t("Add a place") + "</button>";
    },
    finder: function (k) {
      return text(k, "search_days", "How far a person search looks ahead (days)", { type: "number", min: 60, max: 730, hint: "60–730" }) +
        text(k, "chunk_days", "Days loaded at a time", { type: "number", min: 15, max: 120, hint: "15–120" }) +
        select(k, "strictness", "Strictness (for every search)", [
          ["lenient", t("Show all: mark doshas and rules not matched, lower %")],
          ["strict", t("Strict: hide windows with a mahadosha or a missed rule")]]);
    },
    dosha_scoring: function (k) {
      var catOpts = [["inherit", t("Default (mahadoshas all, dashavidha marriage)")], ["on", t("Calculate score")], ["off", t("Don't calculate score")]];
      var evOpts = [["inherit", t("Same as its category")], ["on", t("Calculate score")], ["off", t("Don't calculate score")]];
      var events = cfg.meta._choices.dosha_events || [], byId = {};
      events.forEach(function (ev) { byId[ev.id] = ev; });
      var tabName = {};
      (cfg.meta._choices.dosha_tabs || []).forEach(function (t) { tabName[t.id] = tr(t.en, t.te); });
      function sel(path, opts, aria) {
        var cur = get(form[k], path);
        return '<select aria-label="' + esc(aria) + '" ' + inputAttrs(k, path) + ">" + opts.map(function (o) {
          return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">" + esc(o[1]) + "</option>";
        }).join("") + "</select>";
      }
      // "Calculate all" / "Don't calculate any" for one dosha set ("" = both sets).
      function allRow(set, name) {
        var attr = set ? ' data-dosha-set="' + set + '"' : "";
        return '<div class="row-form"><strong>' + esc(name) + ":</strong>" +
          '<button type="button" class="btn btn--sm btn--outline" data-dosha-all="on"' + attr + ">" + t("Calculate all") + "</button>" +
          '<button type="button" class="btn btn--sm btn--outline" data-dosha-all="off"' + attr + ">" + t("Don't calculate any") + "</button></div>";
      }
      function yn(v) { return v == null ? "?" : v ? t("on") : t("off"); }
      var head = "<thead><tr><th>%s</th><th>" + t("21 mahadoshas") + "</th><th>" + t("10 dashavidha doshas") + "</th>%x</tr></thead>";
      var tabsTable = '<div class="table-wrap"><table class="data-table">' + head.replace("%s", t("Category")).replace("%x", "") + "<tbody>" +
        (cfg.meta._choices.dosha_tabs || []).map(function (t) {
          var nm = tr(t.en, t.te);
          return "<tr><td>" + esc(nm) + "</td><td>" + sel("tabs." + t.id + ".mahadoshas", catOpts, nm + " mahadoshas") + "</td><td>" + sel("tabs." + t.id + ".dashavidha", catOpts, nm + " dashavidha") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
      var ids = Object.keys(form[k].events || {});
      var evTable = ids.length ? '<div class="table-wrap"><table class="data-table">' + head.replace("%s", t("Event")).replace("%x", "<th></th>") + "<tbody>" +
        ids.map(function (id) {
          var ev = byId[id] || { en: id, te: "" }, nm = tr(ev.en, ev.te || ev.en);
          return "<tr><td>" + esc(nm) + '<br><small class="cf-hint">' + esc(tabName[ev.tab] || ev.tab || "") + " · " + t("default") + ": " + yn(ev.file_mahadoshas) + " / " + yn(ev.file_dashavidha) + "</small></td><td>" +
            sel("events." + id + ".mahadoshas", evOpts, nm + " mahadoshas") + "</td><td>" + sel("events." + id + ".dashavidha", evOpts, nm + " dashavidha") +
            '</td><td><button type="button" class="btn btn--sm btn--outline" data-dosha-remove="' + esc(id) + '">' + t("Remove") + "</button></td></tr>";
        }).join("") + "</tbody></table></div>" : '<p class="portal-hint">' + t("No event overrides yet: every event follows its category.") + "</p>";
      var free = events.filter(function (ev) { return !(form[k].events || {})[ev.id]; });
      var adder = '<div class="row-form"><div class="field"><label for="cfDoshaAdd">' + t("Set one event differently") + '</label><select id="cfDoshaAdd">' +
        free.map(function (ev) { return '<option value="' + esc(ev.id) + '">' + esc(tr(ev.en, ev.te || ev.en)) + " (" + esc(tabName[ev.tab] || ev.tab || "") + ")</option>"; }).join("") +
        '</select></div><button type="button" class="btn btn--outline" data-dosha-add="1"' + (free.length ? "" : " disabled") + ">+ " + t("Add") + "</button></div>";
      return text(k, "panchanga_weight", "Panchanga shuddhi share (%)", { type: "number", min: 0, max: 100, hint: "30" }) +
        text(k, "dashavidha_weight", "Dashavidha share where checked (%); mahadoshas get the rest", { type: "number", min: 0, max: 100, hint: "10" }) +
        allRow("", t("Both sets")) +
        allRow("mahadoshas", t("21 mahadoshas")) +
        allRow("dashavidha", t("10 dashavidha doshas")) +
        '<p class="portal-hint">' + t("Each button sets every category and every event below; then press Save.") + "</p>" +
        "<h3>" + t("By category") + "</h3>" + tabsTable +
        "<h3>" + t("Events set differently") + "</h3>" + evTable + adder;
    },
    sharing: function (k) {
      return check(k, "pdf", "PDF download buttons") + check(k, "image", "Share as image") + check(k, "text", "Share as text");
    },
    godavari: function (k) {
      return check(k, "enabled", "No muhurtas near the Godavari while Jupiter is in Simha") +
        text(k, "km", "Counts as near within (km)", { type: "number", min: 10, max: 100, hint: "10–100" });
    },
    texts: function (k) {
      return Object.keys(cfg.meta._choices.texts).map(function (t) {
        return "<h3>" + esc(cfg.meta._choices.texts[t]) + '</h3><div class="cf-grid">' +
          text(k, t + ".en", "English", { area: true, maxlength: 400 }) + text(k, t + ".te", "Telugu", { area: true, maxlength: 400 }) + "</div>";
      }).join("");
    },
    security: function (k) {
      return text(k, "session_days", "A sign-in lasts (days)", { type: "number", min: 1, max: 90, hint: "1–90" }) +
        text(k, "login_fails_before_lock", "Lock an account after this many wrong passwords", { type: "number", min: 3, max: 10, hint: "3–10" }) +
        text(k, "lock_minutes", "Lock for (minutes)", { type: "number", min: 5, max: 1440, hint: "5–1440" }) +
        text(k, "otp_attempts", "Tries allowed for a WhatsApp code", { type: "number", min: 3, max: 10, hint: "3–10" });
    },
    admin_powers: function (k) {
      return renderPermTree(k, ADMIN_PERM_GROUPS);
    },
    user_powers: function (k) {
      return renderPermTree(k, USER_PERM_GROUPS);
    },
    admin_dashboard: function (k) {
      return Object.keys(DASH_LABELS).map(function (p) { return check(k, p, DASH_LABELS[p]); }).join("");
    },
  };
  var INTROS = {
    nav: ["Hide a page instead of removing it. Who may open a page is still decided by the server. The Settings link always shows."],
    texts: ["Leave a box empty to keep the page's own wording."],
    security: ["Values outside the limits are refused, so a mistake can't weaken security."],
    admin_powers: ["The server checks these too. Your own powers can't be changed here."],
    dosha_scoring: ["The muhurta % = panchanga shuddhi (the event's own rules) + the 21 mahadoshas; for marriage the 10 dashavidha doshas take a share too (default 30 / 70, or 30 / 60 / 10). By default the mahadoshas are checked for every event and the dashavidha doshas for marriage only. A set switched off here is still listed on the result but has no share. Rules themselves stay in the rule files."],
    user_powers: ["Global privileges for all standard users. You can also override these per-user in the Users page."],
    godavari: ["Your own ruling: while Jupiter is in Simha, places near the Godavari get no muhurtas."],
  };

  function renderTabs() {
    $("cfTabs").innerHTML = TABS.map(function (tb) {
      return '<button type="button" role="tab" class="cf-tab" id="cftab_' + tb[0] + '" aria-selected="' + (tb[0] === active) + '" aria-controls="cfPanel">' + t(tb[1]) + "</button>";
    }).join("");
  }
  function render() {
    renderTabs();
    var tab = TABS.find(function (t) { return t[0] === active; });
    $("cfSystem").hidden = active !== "system";
    $("cfPanel").hidden = active === "system";
    if (active === "system" || !cfg) return;
    $("cfPanel").innerHTML = tab[2].map(function (k) {
      var intro = INTROS[k] ? t(INTROS[k]) : "";
      return card(k, BODIES[k](k), intro);
    }).join("");
    if (window.Icon && Icon.hydrate) Icon.hydrate($("cfPanel"));
  }
  function refreshCard(key) {
    var el = document.querySelector('[data-card="' + key + '"]');
    if (!el) return render();
    var focusId = document.activeElement && document.activeElement.id;
    var intro = INTROS[key] ? t(INTROS[key]) : "";
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
    var tv = e.target, key = tv.getAttribute && tv.getAttribute("data-key");
    if (tv.getAttribute && tv.getAttribute("data-color")) {
      form.theme[tv.getAttribute("data-color")] = tv.value;
      return refreshCard("theme");
    }
    if (!key || !form[key]) return;
    var path = tv.getAttribute("data-path"), v;
    if (tv.type === "checkbox") {
      v = tv.checked;
      var parentGroup = tv.getAttribute("data-perm-parent");
      if (parentGroup) {
        var cardEl = tv.closest("[data-card]");
        if (cardEl) {
          var childInputs = cardEl.querySelectorAll('[data-perm-child="' + parentGroup + '"]');
          childInputs.forEach(function (ci) {
            ci.checked = v;
            setPath(form[key], ci.getAttribute("data-path"), v);
          });
          var grpEl = cardEl.querySelector('[data-perm-group="' + parentGroup + '"]');
          if (grpEl) {
            var badge = grpEl.querySelector(".cf-perm-badge");
            if (badge) {
              badge.textContent = (v ? childInputs.length : 0) + "/" + childInputs.length + " " + t("active");
              badge.className = "cf-perm-badge " + (v ? "is-full" : "is-empty");
            }
          }
        }
      } else {
        var childGroup = tv.getAttribute("data-perm-child");
        if (childGroup) {
          var cardEl = tv.closest("[data-card]");
          if (cardEl) {
            var grpEl = cardEl.querySelector('[data-perm-group="' + childGroup + '"]');
            if (grpEl) {
              var childInputs = grpEl.querySelectorAll('[data-perm-child="' + childGroup + '"]');
              var activeCount = 0;
              childInputs.forEach(function (ci) { if (ci.checked) activeCount++; });
              var badge = grpEl.querySelector(".cf-perm-badge");
              if (badge) {
                badge.textContent = activeCount + "/" + childInputs.length + " " + t("active");
                badge.className = "cf-perm-badge " + (activeCount === childInputs.length ? "is-full" : (activeCount === 0 ? "is-empty" : ""));
              }
              if (v) {
                var parentInput = grpEl.querySelector('[data-perm-parent="' + childGroup + '"]');
                if (parentInput && !parentInput.checked) {
                  parentInput.checked = true;
                  setPath(form[key], parentInput.getAttribute("data-path"), true);
                }
              }
            }
          }
        }
      }
    } else if (tv.type === "number") {
      v = tv.value === "" ? null : Number(tv.value);
    } else {
      v = tv.value;
    }
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
    var toggleHdr = e.target.closest("[data-toggle-accordion]");
    if (toggleHdr && !e.target.closest("label.switch") && !e.target.closest("input")) {
      var grp = toggleHdr.closest(".cf-perm-group");
      if (grp) grp.classList.toggle("is-open");
      return;
    }
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
    var dall = b.getAttribute("data-dosha-all");
    if (dall) {
      // Every category to on/off for one dosha set (or both); for that set, event overrides follow their category again.
      var sets = b.getAttribute("data-dosha-set") ? [b.getAttribute("data-dosha-set")] : ["mahadoshas", "dashavidha"];
      (cfg.meta._choices.dosha_tabs || []).forEach(function (t) {
        var row = form.dosha_scoring.tabs[t.id] = form.dosha_scoring.tabs[t.id] || { mahadoshas: "inherit", dashavidha: "inherit" };
        sets.forEach(function (x) { row[x] = dall; });
      });
      Object.keys(form.dosha_scoring.events || {}).forEach(function (id) { sets.forEach(function (x) { form.dosha_scoring.events[id][x] = "inherit"; }); });
      return refreshCard("dosha_scoring");
    }
    var drm = b.getAttribute("data-dosha-remove");
    if (drm) { delete form.dosha_scoring.events[drm]; return refreshCard("dosha_scoring"); }
    if (b.getAttribute("data-dosha-add")) {
      var pick = $("cfDoshaAdd") && $("cfDoshaAdd").value;
      if (pick) { form.dosha_scoring.events = form.dosha_scoring.events || {}; form.dosha_scoring.events[pick] = { mahadoshas: "inherit", dashavidha: "inherit" }; }
      return refreshCard("dosha_scoring");
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
        lines.push((path || key) + ": " + t("list changed"));
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
        return AppShell.toast(t("Text would be hard to read on these colours. Pick darker or lighter ones."), "error");
      }
    }
    var ok = await AppShell.confirm(t("Save these changes to “{key}”?", { key: label(key) }) + "\n\n" + summary(key),
      { ok: t("Save"), cancel: t("Keep editing") });
    if (!ok) return;
    try {
      var r = await api("PUT", "/admin/config", { changes: (function () { var c = {}; c[key] = form[key]; return c; })() });
      cfg.values = r.values; form[key] = clone(r.values[key]);
      AppShell.toast(t("Saved. Every page follows within 15 seconds."), "success");
      refreshCard(key);
      if (window.SiteConfig) SiteConfig.reload();
    } catch (err) { AppShell.toast(err.message, "error"); }
  }
  async function doReset(key) {
    var ok = await AppShell.confirm(t("Put “{key}” back to its default?", { key: label(key) }),
      { ok: t("Reset"), cancel: t("Keep"), danger: true });
    if (!ok) return;
    try {
      var r = await api("POST", "/admin/config/" + key + "/reset");
      cfg.values = r.values; form[key] = clone(r.values[key]);
      AppShell.toast(t("Back to the default."), "success");
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
        var tv = new Date(h.at);
        return "<li><time>" + esc(tv.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " + tv.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) +
          "</time><span><strong>" + esc(h.who) + "</strong> · " + esc(h.action === "config.reset" ? t("reset to default") : t("changed")) +
          '<br><small class="cf-detail">' + esc(h.details || "") + "</small></span></li>";
      }).join("") + "</ul>" : '<p class="portal-hint">' + t("Not changed yet.") + "</p>";
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
