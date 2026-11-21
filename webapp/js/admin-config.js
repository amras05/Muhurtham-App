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
    ["finder", "Finder and sharing", "శోధన, పంచుకోవడం", ["finder", "dosha_scoring", "sharing", "godavari"]],
    ["texts", "Texts", "పాఠ్యాలు", ["texts"]],
    ["security", "Accounts and security", "ఖాతాలు, భద్రత", ["security"]],
    ["admins", "Privileges & powers", "అధికారాలు & అనుమతులు", ["admin_powers", "user_powers", "admin_dashboard"]],
    ["system", "System", "వ్యవస్థ", []],
  ];
  var SECTION_LABELS = {
    live: ["Live cards (lagna, bad time, good time)", "ప్రత్యక్ష కార్డులు"], timeline: ["24-hour timeline", "24 గంటల కాల చక్రం"],
    times: ["Good and bad time lists", "శుభ, అశుభ సమయాల జాబితా"], yogas_panchaka: ["Special yogas and panchaka", "విశేష యోగాలు, పంచకం"],
    chandrabalam: ["Chandrabalam for each rashi", "రాశి వారి చంద్రబలం"], lagnas: ["The 12 lagnas", "12 లగ్నాలు"],
    dos: ["Good for / avoid today", "అనుకూల, వర్జ్యములు"], shloka: ["Today's shloka", "నేటి శ్లోకం"],
    cta: ["Muhurta Finder banner", "ముహూర్త శోధన బ్యానర్"], more: ["More details", "మరిన్ని వివరాలు"],
  };
  var USER_PERM_GROUPS = [
    {
      id: "panchang",
      parent: "panchang_view",
      title: ["Today's Panchangam", "నేటి పంచాంగం"],
      children: [
        { key: "panchang_change_place", label: ["Change City / Location", "నగరం / ప్రదేశం మార్చడం"] },
        { key: "panchang_change_date", label: ["Change Date (Calendar & Prev/Next)", "తేదీ మార్చడం (క్యాలెండర్, ముందు/వెనుక)"] },
        { key: "panchang_share", label: ["Share Panchang (Link, WhatsApp, Image)", "పంచాంగం పంచుకోవడం (లింక్, వాట్సాప్)"] },
        { key: "panchang_pdf", label: ["Download Panchang as PDF", "పంచాంగం PDF డౌన్‌లోడ్"] },
        { key: "panchang_month", label: ["Switch to Monthly View Link", "మాస పంచాంగం లింక్"] },
        { key: "panchang_find_muhurtha", label: ["Find Muhurtham CTA Banner", "ముహూర్త శోధన బ్యానర్"] },
        { key: "panchang_live_cards", label: ["Live Cards (Lagna, Good/Bad Times)", "లైవ్ కార్డులు (లగ్నం, శుభ/అశుభాలు)"] },
        { key: "panchang_angas", label: ["Principal Angas (Tithi, Nakshatra, Yoga, Karana, Vara)", "పంచాంగ ప్రధానాంగాలు (తిథి, నక్షత్రం...)"] },
        { key: "panchang_timeline", label: ["24-Hour Day Timeline", "24 గంటల కాల చక్రం"] },
        { key: "panchang_timings", label: ["Good & Bad Times (Rahu, Yama, Durmuhurtha, Varjyam)", "శుభ & అశుభ సమయాలు (రాహుకాలం...)"] },
        { key: "panchang_ashta_kaalas", label: ["Dina Ashta Kaalas (8 Divisions)", "దిన అష్ట కాల విభజన (8 కాలాలు)"] },
        { key: "panchang_hora_choghadiya", label: ["Hora & Choghadiya Tables", "హోర & చోఘడియా పట్టికలు"] },
        { key: "panchang_chandrabalam", label: ["Chandrabalam for All Rashis", "రాశి వారి చంద్రబలం"] },
        { key: "panchang_lagnas", label: ["12 Lagnas Detailed Table", "12 లగ్నాల వివరాల పట్టిక"] },
        { key: "panchang_shloka", label: ["Daily Shloka & Mantra", "నేటి శ్లోకం & మంత్రం"] }
      ]
    },
    {
      id: "month",
      parent: "month_view",
      title: ["Monthly Panchangam", "మాస పంచాంగం"],
      children: [
        { key: "month_navigate", label: ["Month & Year Navigator", "నెల & సంవత్సరం మార్చడం"] },
        { key: "month_day_details", label: ["Day Details Modal / Popover", "రోజు వివరాల పాపప్ / మోడల్"] },
        { key: "month_pdf", label: ["Export Month Calendar as PDF", "నెల క్యాలెండర్ PDF ఎగుమతి"] },
        { key: "month_festivals", label: ["Festivals & Vratams Markers", "పండుగలు & వ్రతాల సూచికలు"] }
      ]
    },
    {
      id: "muhurta",
      parent: "muhurta_search",
      title: ["Muhurtha Darshini / Finder", "ముహూర్త దర్శిని / శోధన"],
      children: [
        { key: "muhurta_select_activity", label: ["Select Activity & Category (Vivaha, Gruhapravesha...)", "కార్యక్రమం & వర్గం ఎంపిక (వివాహం, గృహప్రవేశం...)"] },
        { key: "muhurta_date_range", label: ["Custom Date Range Selection", "తేదీల పరిధి ఎంపిక"] },
        { key: "muhurta_time_filters", label: ["Time Window Filters (Morning, Evening...)", "సమయ విండో ఫిల్టర్లు (ఉదయం, సాయంత్రం...)"] },
        { key: "muhurta_participants", label: ["Participant Birth Chart Matching (Bride, Groom, Vatu)", "జాతక చక్రాల సరిపోలిక (వధువు, వరుడు, వటువు)"] },
        { key: "muhurta_audit", label: ["Muhurtha Parishilana (Quality Audit Tab)", "ముహూర్త పరిశీలన (నాణ్యత విశ్లేషణ)"] },
        { key: "muhurta_save", label: ["Save Muhurtham to Vault", "ముహూర్తాన్ని ఖజానాలో భద్రపరచడం"] },
        { key: "muhurta_delete", label: ["Delete Saved Muhurthams", "భద్రపరిచిన ముహూర్తాల తొలగింపు"] },
        { key: "muhurta_export", label: ["Export & Share Muhurtham (PDF, Image, Text)", "ముహూర్తాన్ని పంచుకోవడం / ఎగుమతి"] }
      ]
    },
    {
      id: "catalog",
      parent: "catalog_view",
      title: ["All Muhurtas Catalog", "అన్ని ముహూర్తాల కేటలాగ్"],
      children: [
        { key: "catalog_browse", label: ["Browse All 106+ Muhurtha Activities", "106+ ముహూర్త కార్యక్రమాల బ్రౌజింగ్"] },
        { key: "catalog_search", label: ["Search & Filter Catalog", "కేటలాగ్ వెతకడం & ఫిల్టర్లు"] },
        { key: "catalog_rules", label: ["View Activity Rules & Dosha Guidelines", "గ్రహ బలాలు & దోష నిబంధనలు చూడడం"] }
      ]
    },
    {
      id: "family",
      parent: "family_view",
      title: ["Family Vault", "కుటుంబ ఖజానా"],
      children: [
        { key: "family_add", label: ["Add New Family Member", "కొత్త కుటుంబ సభ్యులను చేర్చడం"] },
        { key: "family_view_details", label: ["View Encrypted Birth Details (DOB, TOB, POB)", "జన్మ వివరాలు చూడడం (తేదీ, సమయం, స్థలం)"] },
        { key: "family_edit", label: ["Edit Family Member Details", "కుటుంబ సభ్యుల వివరాలు సవరించడం"] },
        { key: "family_delete", label: ["Remove Family Member", "కుటుంబ సభ్యులను తొలగించడం"] },
        { key: "family_events", label: ["Family Events & Shannavati Rites", "కుటుంబ విశేషాలు & షణ్ణవతి శ్రాద్ధాలు"] },
        { key: "family_export", label: ["Export Family Vault Data", "కుటుంబ ఖజానా డేటా ఎగుమతి"] }
      ]
    },
    {
      id: "saved",
      parent: "saved_view",
      title: ["My Saved Muhurtas", "నా ముహూర్తాలు"],
      children: [
        { key: "saved_favourite", label: ["Star / Favourite Saved Searches", "నచ్చిన ముహూర్తాలకు స్టార్ గుర్తు"] },
        { key: "saved_edit_label", label: ["Edit Custom Notes & Labels", "నోట్స్ & లేబుల్స్ సవరించడం"] },
        { key: "saved_delete", label: ["Delete Saved Searches", "భద్రపరిచిన శోధనల తొలగింపు"] },
        { key: "saved_export", label: ["Download & Export Saved Searches", "సేవ్ చేసిన ముహూర్తాల డౌన్‌లోడ్"] }
      ]
    },
    {
      id: "account",
      parent: "self_edit",
      title: ["Account & Profile", "ప్రొఫైల్ & ఖాతా"],
      children: [
        { key: "self_edit_name", label: ["Edit Display Name", "పేరు సవరించడం"] },
        { key: "self_edit_language", label: ["Change Preferred Language (Telugu / English)", "భాష మార్చుకోవడం (తెలుగు / ఇంగ్లీష్)"] },
        { key: "self_edit_home_place", label: ["Change Home City & Coordinates", "స్వస్థలం & అక్షాంశాలు మార్చడం"] },
        { key: "self_sessions", label: ["View & Revoke Active Device Sessions", "పరికరాల సెషన్లు చూడడం & రద్దు"] },
        { key: "self_delete_account", label: ["Request Account Deletion", "ఖాతా తొలగింపు అభ్యర్థన"] }
      ]
    }
  ];

  var ADMIN_PERM_GROUPS = [
    {
      id: "users_mgmt",
      parent: "users_view",
      title: ["Users Management", "వినియోగదారుల నిర్వహణ"],
      children: [
        { key: "users_view_mobile", label: ["Reveal Full Mobile Numbers", "పూర్తి మొబైల్ నంబర్లు చూడడం"] },
        { key: "users_disable", label: ["Disable and Enable Users", "వినియోగదారులను నిలిపివేయడం, ప్రారంభించడం"] },
        { key: "invite_users", label: ["Add New Users (with a password)", "కొత్త వినియోగదారులను చేర్చడం (పాస్‌వర్డ్‌తో)"] },
        { key: "set_user_passwords", label: ["Set a User's Password", "వినియోగదారుని పాస్‌వర్డ్ సెట్ చేయడం"] },
        { key: "edit_user_profile", label: ["Edit User Profile (Name, Phone, Language)", "వినియోగదారుని ప్రొఫైల్ సవరించడం"] },
        { key: "delete_user", label: ["Permanently Delete User Account", "వినియోగదారుని ఖాతా శాశ్వత తొలగింపు"] },
        { key: "reset_user_sessions", label: ["Force Logout User Sessions", "వినియోగదారుల సెషన్లను రద్దు చేయడం (సైన్ అవుట్)"] },
        { key: "export_users", label: ["Export Users List as CSV", "వినియోగదారుల జాబితాను ఎగుమతి చేయడం"] },
        { key: "set_user_permissions", label: ["Manage Per-User Permission Overrides", "వినియోగదారుల వ్యక్తిగత అధికారాల నిర్వహణ"] }
      ]
    },
    {
      id: "content_mgmt",
      parent: "content_edit",
      title: ["Content & App Settings", "విషయాలు & సెట్టింగులు"],
      children: [
        { key: "content_announcements", label: ["Edit Platform Announcements & Banners", "ప్రకటనలు & బ్యానర్లు నిర్వహణ"] },
        { key: "content_utpata", label: ["Manage Inauspicious Utpata Dates", "ఉత్పాత / దుష్ట కాలాల తేదీలు నిర్వహణ"] },
        { key: "content_texts", label: ["Edit App Texts & Banner Headlines", "యాప్ పాఠ్యాలు & శీర్షికలు సవరణ"] },
        { key: "content_rules", label: ["View & Manage Muhurta Rules", "ముహూర్త సూత్రాల నిర్వహణ"] }
      ]
    },
    {
      id: "audit_mgmt",
      parent: "audit_view_users",
      title: ["Audit Logs & Analytics", "కార్యకలాపాలు & గణాంకాలు"],
      children: [
        { key: "stats_view", label: ["See Statistics & System Health", "గణాంకాలు & సర్వర్ ఆరోగ్య స్థితి చూడడం"] },
        { key: "audit_export", label: ["Export Activity Audit Logs", "కార్యకలాపాల లాగ్‌లు ఎగుమతి"] }
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
    stats: ["People counts", "వినియోగదారుల సంఖ్యలు"], attention: ["Needs attention", "గమనించవలసినవి"],
    activity: ["Recent activity", "ఇటీవలి కార్యకలాపాలు"], tools: ["Tool tiles", "సాధనాల టైల్స్"]
  };
  var THEME_LABELS = {
    sanctuary: ["Vedic Sanctuary (green and gold)", "వేద శరణ్యం (ఆకుపచ్చ, బంగారం)"],
    classic: ["Classic (maroon and gold)", "సాంప్రదాయ (మెరూన్, బంగారం)"], saffron: ["Saffron (orange and brown)", "కాషాయం (నారింజ, గోధుమ)"]
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
  function check(key, path, en, te, extraAttrs) {
    var id = "cf_" + key + "_" + path.replace(/\W/g, "_");
    return '<label class="switch" for="' + id + '"><input type="checkbox" id="' + id + '" ' + inputAttrs(key, path) + (extraAttrs ? " " + extraAttrs : "") + (get(form[key], path) ? " checked" : "") + "> <span>" + tr(en, te) + "</span></label>";
  }
  function select(key, path, en, te, options) {
    var id = "cf_" + key + "_" + path.replace(/\W/g, "_"), cur = get(form[key], path);
    return '<div class="field"><label for="' + id + '">' + tr(en, te) + '</label><select id="' + id + '" ' + inputAttrs(key, path) + ">" +
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
          check(key, c.key, c.label[0], c.label[1], 'data-perm-child="' + grp.id + '"') +
          '</div>';
      }).join("");

      var parentId = "cf_" + key + "_" + grp.parent.replace(/\W/g, "_");
      return '<div class="cf-perm-group is-open" data-perm-group="' + grp.id + '">' +
        '<div class="cf-perm-header" data-toggle-accordion="' + grp.id + '">' +
        '<div class="cf-perm-title">' +
        '<span class="cf-perm-chevron" aria-hidden="true">&#9654;</span>' +
        '<span>' + esc(tr(grp.title[0], grp.title[1])) + '</span>' +
        '</div>' +
        '<div class="cf-perm-ctrls">' +
        '<span class="cf-perm-badge ' + badgeCls + '">' + activeCount + '/' + total + ' ' + tr("active", "చురుకు") + '</span>' +
        '<label class="switch" onclick="event.stopPropagation();" for="' + parentId + '">' +
        '<input type="checkbox" id="' + parentId + '" ' + inputAttrs(key, grp.parent) + ' data-perm-parent="' + grp.id + '"' + (isParentOn ? " checked" : "") + '> ' +
        '<span>' + tr("Enable Section", "విభాగం ప్రారంభించు") + '</span>' +
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
        text(k, "chunk_days", "Days loaded at a time", "ఒక్కసారి లోడ్ అయ్యే రోజులు", { type: "number", min: 15, max: 120, hint: "15–120" }) +
        select(k, "strictness", "Strictness (for every search)", "నియమ కఠినత (అన్ని శోధనలకు)", [
          ["lenient", tr("Show all: mark doshas and rules not matched, lower %", "అన్నీ చూపించు: సరిపోని దోషాలు, నియమాలు గుర్తించి % తగ్గించు")],
          ["strict", tr("Strict: hide windows with a mahadosha or a missed rule", "కఠినం: మహాదోషం లేదా సరిపోని నియమం ఉన్న సమయాలు దాచు")]]);
    },
    dosha_scoring: function (k) {
      var catOpts = [["inherit", tr("Default (mahadoshas all, dashavidha marriage)", "మామూలు (మహాదోషాలు అన్నిటికీ, దశవిధ వివాహానికి)")], ["on", tr("Calculate score", "శాతం గణించు")], ["off", tr("Don't calculate score", "శాతం గణించవద్దు")]];
      var evOpts = [["inherit", tr("Same as its category", "వర్గం ప్రకారమే")], ["on", tr("Calculate score", "శాతం గణించు")], ["off", tr("Don't calculate score", "శాతం గణించవద్దు")]];
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
          '<button type="button" class="btn btn--sm btn--outline" data-dosha-all="on"' + attr + ">" + tr("Calculate all", "అన్నీ గణించు") + "</button>" +
          '<button type="button" class="btn btn--sm btn--outline" data-dosha-all="off"' + attr + ">" + tr("Don't calculate any", "ఏదీ గణించవద్దు") + "</button></div>";
      }
      function yn(v) { return v == null ? "?" : v ? tr("on", "ఉంది") : tr("off", "లేదు"); }
      var head = "<thead><tr><th>%s</th><th>" + tr("21 mahadoshas", "21 మహాదోషాలు") + "</th><th>" + tr("10 dashavidha doshas", "దశవిధ దోషాలు") + "</th>%x</tr></thead>";
      var tabsTable = '<div class="table-wrap"><table class="data-table">' + head.replace("%s", tr("Category", "వర్గం")).replace("%x", "") + "<tbody>" +
        (cfg.meta._choices.dosha_tabs || []).map(function (t) {
          var nm = tr(t.en, t.te);
          return "<tr><td>" + esc(nm) + "</td><td>" + sel("tabs." + t.id + ".mahadoshas", catOpts, nm + " mahadoshas") + "</td><td>" + sel("tabs." + t.id + ".dashavidha", catOpts, nm + " dashavidha") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
      var ids = Object.keys(form[k].events || {});
      var evTable = ids.length ? '<div class="table-wrap"><table class="data-table">' + head.replace("%s", tr("Event", "కార్యం")).replace("%x", "<th></th>") + "<tbody>" +
        ids.map(function (id) {
          var ev = byId[id] || { en: id, te: "" }, nm = tr(ev.en, ev.te || ev.en);
          return "<tr><td>" + esc(nm) + '<br><small class="cf-hint">' + esc(tabName[ev.tab] || ev.tab || "") + " · " + tr("default", "మామూలుగా") + ": " + yn(ev.file_mahadoshas) + " / " + yn(ev.file_dashavidha) + "</small></td><td>" +
            sel("events." + id + ".mahadoshas", evOpts, nm + " mahadoshas") + "</td><td>" + sel("events." + id + ".dashavidha", evOpts, nm + " dashavidha") +
            '</td><td><button type="button" class="btn btn--sm btn--outline" data-dosha-remove="' + esc(id) + '">' + tr("Remove", "తొలగించు") + "</button></td></tr>";
        }).join("") + "</tbody></table></div>" : '<p class="portal-hint">' + tr("No event overrides yet: every event follows its category.", "ఇంకా కార్య మినహాయింపులు లేవు: ప్రతి కార్యం దాని వర్గాన్ని అనుసరిస్తుంది.") + "</p>";
      var free = events.filter(function (ev) { return !(form[k].events || {})[ev.id]; });
      var adder = '<div class="row-form"><div class="field"><label for="cfDoshaAdd">' + tr("Set one event differently", "ఒక కార్యాన్ని వేరుగా") + '</label><select id="cfDoshaAdd">' +
        free.map(function (ev) { return '<option value="' + esc(ev.id) + '">' + esc(tr(ev.en, ev.te || ev.en)) + " (" + esc(tabName[ev.tab] || ev.tab || "") + ")</option>"; }).join("") +
        '</select></div><button type="button" class="btn btn--outline" data-dosha-add="1"' + (free.length ? "" : " disabled") + ">+ " + tr("Add", "చేర్చండి") + "</button></div>";
      return text(k, "panchanga_weight", "Panchanga shuddhi share (%)", "పంచాంగ శుద్ధి వాటా (%)", { type: "number", min: 0, max: 100, hint: "30" }) +
        text(k, "dashavidha_weight", "Dashavidha share where checked (%); mahadoshas get the rest", "దశవిధ దోషాల వాటా (%); మిగిలినది మహాదోషాలకు", { type: "number", min: 0, max: 100, hint: "10" }) +
        allRow("", tr("Both sets", "రెండూ")) +
        allRow("mahadoshas", tr("21 mahadoshas", "21 మహాదోషాలు")) +
        allRow("dashavidha", tr("10 dashavidha doshas", "దశవిధ దోషాలు")) +
        '<p class="portal-hint">' + tr("Each button sets every category and every event below; then press Save.", "ప్రతి బటన్ అన్ని వర్గాలు, కార్యాలకు వర్తిస్తుంది; తర్వాత భద్రపరచండి నొక్కండి.") + "</p>" +
        "<h3>" + tr("By category", "వర్గాల వారీగా") + "</h3>" + tabsTable +
        "<h3>" + tr("Events set differently", "వేరుగా ఉన్న కార్యాలు") + "</h3>" + evTable + adder;
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
      return renderPermTree(k, ADMIN_PERM_GROUPS);
    },
    user_powers: function (k) {
      return renderPermTree(k, USER_PERM_GROUPS);
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
    dosha_scoring: ["The muhurta % = panchanga shuddhi (the event's own rules) + the 21 mahadoshas; for marriage the 10 dashavidha doshas take a share too (default 30 / 70, or 30 / 60 / 10). By default the mahadoshas are checked for every event and the dashavidha doshas for marriage only. A set switched off here is still listed on the result but has no share. Rules themselves stay in the rule files.",
      "ముహూర్త శాతం = పంచాంగ శుద్ధి (కార్య నియమాలు) + 21 మహాదోషాలు; వివాహానికి దశవిధ దోషాలకు కూడా వాటా (మామూలుగా 30 / 70, లేదా 30 / 60 / 10). మామూలుగా మహాదోషాలు అన్ని కార్యాలకు, దశవిధ దోషాలు వివాహానికి మాత్రమే. ఇక్కడ ఆపిన దోషాలు ఫలితంలో కనిపిస్తాయి కానీ శాతంలో వాటా ఉండదు. నియమాలు నియమ ఫైళ్ళలోనే ఉంటాయి."],
    user_powers: ["Global privileges for all standard users. You can also override these per-user in the Users page.",
      "వినియోగదారులందరికీ వర్తించే సాధారణ అధికారాలు. వినియోగదారుల పేజీలో వ్యక్తిగతంగా కూడా మార్చవచ్చు."],
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
    if (t.type === "checkbox") {
      v = t.checked;
      var parentGroup = t.getAttribute("data-perm-parent");
      if (parentGroup) {
        var cardEl = t.closest("[data-card]");
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
              badge.textContent = (v ? childInputs.length : 0) + "/" + childInputs.length + " " + tr("active", "చురుకు");
              badge.className = "cf-perm-badge " + (v ? "is-full" : "is-empty");
            }
          }
        }
      } else {
        var childGroup = t.getAttribute("data-perm-child");
        if (childGroup) {
          var cardEl = t.closest("[data-card]");
          if (cardEl) {
            var grpEl = cardEl.querySelector('[data-perm-group="' + childGroup + '"]');
            if (grpEl) {
              var childInputs = grpEl.querySelectorAll('[data-perm-child="' + childGroup + '"]');
              var activeCount = 0;
              childInputs.forEach(function (ci) { if (ci.checked) activeCount++; });
              var badge = grpEl.querySelector(".cf-perm-badge");
              if (badge) {
                badge.textContent = activeCount + "/" + childInputs.length + " " + tr("active", "చురుకు");
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
    } else if (t.type === "number") {
      v = t.value === "" ? null : Number(t.value);
    } else {
      v = t.value;
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
