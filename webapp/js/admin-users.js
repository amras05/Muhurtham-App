// Users page (admin and super admin): search, masked mobiles with a logged reveal, disable / enable,
// several at once; adding people with a password and setting passwords (21 Nov 2026: admins add users,
// super admins also admins, the owner also super admins; the owner account is managed by nobody else).
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var rows = [], selected = {}, canCreate = false, createRoles = ["user"], roleChoices = ["user", "admin"];
  var ROLE = { user: ["User", "వినియోగదారు"], admin: ["Admin", "నిర్వాహకులు"], super_admin: ["Super admin", "ప్రధాన నిర్వాహకులు"] };
  var STATUS = { active: ["Active", "సక్రియం"], disabled: ["Disabled", "నిలిపివేయబడింది"], pending: ["Sign-up not finished", "నమోదు పూర్తి కాలేదు"],
                 invited: ["Invited", "ఆహ్వానించబడ్డారు"] };

  function say(kind, text) { var b = $("usersMsg"); b.hidden = false; b.className = "auth-alert auth-alert--" + kind; b.textContent = text; b.scrollIntoView({ block: "nearest" }); }

  async function api(method, path, body) {
    var res = await fetch(API_BASE + path, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: data }));
    return data;
  }

  function when(iso) { return iso ? new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : tr("Never", "ఎప్పుడూ లేదు"); }
  function link(act, id, en, te, extra) { return '<button type="button" class="linkish" data-act="' + act + '" data-id="' + id + '"' + (extra || "") + ">" + tr(en, te) + "</button>"; }

  function render() {
    $("usersCount").textContent = tr(rows.length + " shown", rows.length + " మంది");
    $("addPersonBtn").hidden = !canCreate;
    // Roles this person may give a new account (server: creatable_roles): admins add users, super admins
    // also admins, the owner also super admins (21 Nov 2026).
    var cur = $("apRole").value;
    $("apRole").innerHTML = createRoles.map(function (r) {
      return '<option value="' + r + '"' + (r === cur ? " selected" : "") + ">" + esc(tr(ROLE[r][0], ROLE[r][1])) + "</option>"; }).join("");
    $("peopleBody").innerHTML = rows.length ? rows.map(function (p) {
      var st = STATUS[p.status] || [p.status, p.status];
      var acts = [];
      if (p.can_manage && p.status === "active") acts.push(link("disable", p.id, "Disable", "నిలిపివేయండి"));
      if (p.can_manage && p.status === "disabled") acts.push(link("enable", p.id, "Enable", "ప్రారంభించండి"));
      if (p.can_change_role) roleChoices.filter(function (r) { return r !== p.role; }).forEach(function (r) {
        acts.push(link("role", p.id, "Make " + ROLE[r][0].toLowerCase(), ROLE[r][1] + "గా చేయండి", ' data-role="' + r + '"'));
      });
      if (p.can_set_password) acts.push(link("password", p.id, "Set password", "పాస్‌వర్డ్ పెట్టండి"));
      if (p.can_edit) acts.push(link("edit", p.id, "Edit", "మార్చండి"));
      if (p.can_set_perms) acts.push(link("perms", p.id, "Permissions", "అధికారాలు"));
      if (p.can_delete) acts.push(link("delete", p.id, "Delete", "తొలగించండి"));
      var box = p.can_manage ? '<input type="checkbox" data-sel="' + p.id + '"' + (selected[p.id] ? " checked" : "") + ' aria-label="' + esc(tr("Select ", "ఎంచుకోండి ") + p.name) + '">' : "";
      return '<tr data-row="' + p.id + '"><td>' + box + "</td><td><strong>" + esc(p.name) + "</strong><small>" + tr(p.devices + " device(s) signed in", p.devices + " పరికరాల్లో లాగిన్") + "</small></td>" +
        '<td><span class="mob">' + esc(p.mobile_masked) + "</span> " + link("reveal", p.id, "Show", "చూపించు") + "</td>" +
        // The owner shows as a plain super admin (user, 21 Nov 2026); it is still protected on the server.
        "<td>" + esc(tr(ROLE[p.role][0], ROLE[p.role][1])) + "</td>" +
        '<td><span class="status-chip status-chip--' + p.status + '">' + esc(tr(st[0], st[1])) + "</span>" +
        (p.locked ? ' <span class="status-chip status-chip--locked">' + tr("Locked", "లాక్") + "</span>" : "") +
        (p.disabled_reason ? "<small>" + esc(p.disabled_reason) + "</small>" : "") + "</td>" +
        "<td>" + esc(when(p.last_login_at)) + "<small>" + tr(p.login_count + " logins", p.login_count + " లాగిన్లు") + "</small></td>" +
        '<td class="acts">' + (acts.length ? acts.join("<br>") : "<small>—</small>") + "</td></tr>";
    }).join("") : '<tr><td colspan="7" class="empty-state">' + tr("No one matches.", "ఎవరూ సరిపోలలేదు.") + "</td></tr>";
    renderBulk();
  }

  function renderBulk() {
    var ids = Object.keys(selected);
    $("bulkBar").hidden = ids.length === 0;
    $("bulkCount").textContent = tr(ids.length + " selected", ids.length + " మంది ఎంచుకున్నారు");
    $("bulkReason").placeholder = tr("Reason for disabling", "నిలిపివేయడానికి కారణం");
    var manageable = rows.filter(function (p) { return p.can_manage; });
    $("selAll").checked = manageable.length > 0 && manageable.every(function (p) { return selected[p.id]; });
  }

  async function load() {
    var q = new URLSearchParams();
    if ($("fQ").value.trim()) q.set("q", $("fQ").value.trim());
    if ($("fRole").value) q.set("role", $("fRole").value);
    if ($("fStatus").value) q.set("status", $("fStatus").value);
    try {
      var r = await api("GET", "/admin/people?" + q.toString());
      rows = r.people; canCreate = !!r.can_create;
      createRoles = r.create_roles || ["user"]; roleChoices = r.role_choices || ["user", "admin"];
      var shown = {}; rows.forEach(function (p) { shown[p.id] = true; });
      Object.keys(selected).forEach(function (id) { if (!shown[id]) delete selected[id]; });
      render();
    } catch (e) { say("error", e.message); }
  }

  $("filters").addEventListener("submit", function (e) { e.preventDefault(); load(); });

  // ── Add a person (super admin) ──
  $("addPersonBtn").addEventListener("click", function () { $("addPersonForm").hidden = false; $("apName").focus(); });
  $("apCancel").addEventListener("click", function () { $("addPersonForm").reset(); $("addPersonForm").hidden = true; });
  $("addPersonForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    if ($("apPass").value !== $("apPass2").value) {
      say("error", tr("The two passwords do not match.", "రెండు పాస్‌వర్డ్‌లు సరిపోలలేదు.")); $("apPass2").focus(); return;
    }
    try {
      await api("POST", "/admin/people", { name: $("apName").value.trim(), phone: $("apPhone").value.trim(),
                                           role: $("apRole").value, preferred_language: $("apLang").value,
                                           password: $("apPass").value, confirm_password: $("apPass2").value });
      say("info", tr("Added. They can log in now with this mobile and the password you set.",
                     "జోడించాము. ఈ మొబైల్, మీరు పెట్టిన పాస్‌వర్డ్‌తో ఇప్పుడే లాగిన్ అవ్వచ్చు."));
      $("addPersonForm").reset(); $("addPersonForm").hidden = true;
      $("fStatus").value = ""; load();
    } catch (err) { say("error", err.message); }
  });

  // ── Several at once ──
  $("peopleBody").addEventListener("change", function (e) {
    var id = e.target.getAttribute("data-sel");
    if (!id) return;
    if (e.target.checked) selected[id] = true; else delete selected[id];
    renderBulk();
  });
  $("selAll").addEventListener("change", function (e) {
    rows.forEach(function (p) { if (p.can_manage) { if (e.target.checked) selected[p.id] = true; else delete selected[p.id]; } });
    render();
  });
  $("bulkBar").addEventListener("submit", function (e) { e.preventDefault(); });
  $("bulkBar").addEventListener("click", async function (e) {
    var act = e.target.closest("[data-bulk]") && e.target.closest("[data-bulk]").getAttribute("data-bulk");
    if (!act) return;
    if (act === "clear") { selected = {}; render(); return; }
    var reason = $("bulkReason").value.trim();
    if (act === "disable" && reason.length < 3) { say("error", tr("Write a reason (at least 3 letters) before disabling.", "నిలిపివేసే ముందు కారణం రాయండి (కనీసం 3 అక్షరాలు).")); $("bulkReason").focus(); return; }
    try {
      var out = await api("POST", "/admin/people/bulk", { ids: Object.keys(selected), action: act, reason: act === "disable" ? reason : undefined });
      var msg = tr(out.done.length + " done.", out.done.length + " పూర్తయ్యాయి.");
      if (out.skipped.length) msg += " " + tr(out.skipped.length + " skipped: ", out.skipped.length + " వదిలేశాము: ") +
        out.skipped.map(function (s) { var p = rows.find(function (x) { return x.id === s.id; }); return (p ? p.name : s.id) + " (" + s.why + ")"; }).join("; ");
      say(out.skipped.length ? "error" : "info", msg);
      selected = {}; $("bulkReason").value = ""; load();
    } catch (err) { say("error", err.message); }
  });

  // ── Row actions ──
  function rowForm(row, html) {
    var cell = row.querySelector(".acts");
    var old = cell.querySelector(".row-form");
    if (old) old.remove();
    cell.insertAdjacentHTML("beforeend", '<form class="row-form">' + html + ' <button type="button" class="linkish" data-act="cancel">' + tr("Cancel", "రద్దు") + "</button></form>");
    var f = cell.querySelector(".row-form");
    var first = f.querySelector("input"); if (first) first.focus();
    return f;
  }

  $("peopleBody").addEventListener("click", async function (e) {
    var act = e.target.getAttribute("data-act"), id = e.target.getAttribute("data-id");
    if (!act) return;
    var row = e.target.closest("tr");
    var p = rows.find(function (x) { return x.id === id; });
    if (act === "cancel") { e.target.closest(".row-form").remove(); return; }
    if (act === "reveal") {
      try { var r = await api("GET", "/admin/people/" + id + "/mobile"); row.querySelector(".mob").textContent = r.mobile; e.target.remove(); }
      catch (err) { say("error", err.message); }
    } else if (act === "disable") {
      var f = rowForm(row, '<input required minlength="3" maxlength="200" placeholder="' + esc(tr("Reason (shown to admins)", "కారణం (నిర్వాహకులకు కనిపిస్తుంది)")) +
        '"><button class="btn btn--sm">' + tr("Disable", "నిలిపివేయండి") + "</button>");
      f.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        try {
          var out = await api("POST", "/admin/people/" + id + "/disable", { reason: f.querySelector("input").value.trim() });
          say("info", tr("Disabled. " + out.signed_out_devices + " device(s) signed out.", "నిలిపివేశాము. " + out.signed_out_devices + " పరికరాల నుండి సైన్ అవుట్."));
          load();
        } catch (err) { say("error", err.message); }
      });
    } else if (act === "enable") {
      try { await api("POST", "/admin/people/" + id + "/enable"); say("info", tr("Enabled.", "ప్రారంభించాము.")); load(); }
      catch (err) { say("error", err.message); }
    } else if (act === "role") {
      try {
        await api("POST", "/admin/people/" + id + "/role", { role: e.target.getAttribute("data-role") });
        say("info", tr("Role changed. It applies from their next click.", "పాత్ర మార్చాము. వారి తదుపరి చర్య నుండి అమలవుతుంది."));
        load();
      } catch (err) { say("error", err.message); }
    } else if (act === "password" && p) {
      var pf = rowForm(row,
        '<input name="pw" type="password" required minlength="8" maxlength="128" autocomplete="new-password" placeholder="' + esc(tr("New password (8+ characters)", "కొత్త పాస్‌వర్డ్ (8+ అక్షరాలు)")) + '" aria-label="' + esc(tr("New password", "కొత్త పాస్‌వర్డ్")) + '">' +
        '<input name="pw2" type="password" required minlength="8" maxlength="128" autocomplete="new-password" placeholder="' + esc(tr("Type it again", "మళ్ళీ టైప్ చేయండి")) + '" aria-label="' + esc(tr("Type the password again", "పాస్‌వర్డ్ మళ్ళీ")) + '">' +
        '<button class="btn btn--sm">' + tr("Set password", "పాస్‌వర్డ్ పెట్టండి") + "</button>");
      pf.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        if (pf.pw.value !== pf.pw2.value) { say("error", tr("The two passwords do not match.", "రెండు పాస్‌వర్డ్‌లు సరిపోలలేదు.")); return; }
        try {
          var out = await api("POST", "/admin/people/" + id + "/password", { password: pf.pw.value, confirm_password: pf.pw2.value });
          say("info", tr("Password set. They were signed out of " + out.signed_out_devices + " device(s) and log in with the new password.",
                         "పాస్‌వర్డ్ పెట్టాము. " + out.signed_out_devices + " పరికరాల నుండి సైన్ అవుట్ చేశాము; కొత్త పాస్‌వర్డ్‌తో లాగిన్ అవుతారు."));
          load();
        } catch (err) { say("error", err.message); }
      });
    } else if (act === "edit" && p) {
      var ef = rowForm(row,
        '<input name="name" required minlength="2" maxlength="80" value="' + esc(p.name) + '" aria-label="' + esc(tr("Name", "పేరు")) + '">' +
        '<input name="phone" inputmode="tel" maxlength="20" placeholder="' + esc(tr("New mobile (leave empty to keep)", "కొత్త మొబైల్ (మార్చకపోతే ఖాళీగా)")) + '" aria-label="' + esc(tr("New mobile", "కొత్త మొబైల్")) + '">' +
        '<select name="lang" aria-label="' + esc(tr("Language", "భాష")) + '"><option value="">' + tr("Language: keep", "భాష: మార్చవద్దు") + '</option><option value="te">తెలుగు</option><option value="en">English</option></select>' +
        '<button class="btn btn--sm">' + tr("Save", "భద్రపరచండి") + "</button>");
      ef.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var body = { name: ef.name.value.trim() };
        if (ef.phone.value.trim()) body.phone = ef.phone.value.trim();
        if (ef.lang.value) body.preferred_language = ef.lang.value;
        try {
          var out = await api("PUT", "/admin/people/" + id, body);
          say("info", out.needs_confirmation
            ? tr("Saved. They are signed out and must confirm the new number: login page → \"Forgot password\".", "భద్రపరిచాము. వారు సైన్ అవుట్ అయ్యారు; కొత్త నంబర్‌ను 'పాస్‌వర్డ్ మర్చిపోయారా' ద్వారా నిర్ధారించుకోవాలి.")
            : tr("Saved.", "భద్రపరిచాము."));
          load();
        } catch (err) { say("error", err.message); }
      });
    } else if (act === "delete" && p) {
      var df = rowForm(row,
        "<small>" + esc(tr("This removes their name, mobile, family details and saved muhurtas. It can't be undone. Type their name to confirm:",
                           "ఇది వారి పేరు, మొబైల్, కుటుంబ వివరాలు, భద్రపరిచిన ముహూర్తాలను తొలగిస్తుంది. తిరిగి పొందలేము. నిర్ధారించడానికి వారి పేరు టైప్ చేయండి:")) + "</small>" +
        '<input required maxlength="80" placeholder="' + esc(p.name) + '" aria-label="' + esc(tr("Type the name to confirm", "నిర్ధారణకు పేరు టైప్ చేయండి")) + '">' +
        '<button class="btn btn--sm btn--danger">' + tr("Delete for good", "శాశ్వతంగా తొలగించండి") + "</button>");
      df.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        try {
          await api("POST", "/admin/people/" + id + "/delete", { confirm_name: df.querySelector("input").value.trim() });
          say("info", tr("Deleted. The activity log keeps a record that the account existed.", "తొలగించాము. ఖాతా ఉండేదని కార్యకలాపాల లాగ్‌లో నమోదు ఉంటుంది."));
          delete selected[id]; load();
        } catch (err) { say("error", err.message); }
      });
    } else if (act === "perms" && p) {
      try {
        var res = await api("GET", "/admin/people/" + id + "/permissions");
        var permMap = {
          // Panchang
          "panchang.view": ["Today's Panchang (Page Access)", "నేటి పంచాంగం (పేజీ దర్శనం)"],
          "panchang.change_place": ["Change Location / City", "నగరం / ప్రదేశం మార్చడం"],
          "panchang.change_date": ["Change Date (Picker & Prev/Next)", "తేదీ మార్చడం (క్యాలెండర్, ముందు/వెనుక)"],
          "panchang.share": ["Share Panchang (Link, WhatsApp, Image)", "పంచాంగం పంచుకోవడం"],
          "panchang.export_pdf": ["Download Panchang as PDF", "పంచాంగం PDF డౌన్‌లోడ్"],
          "panchang.month": ["Switch to Monthly View Link", "మాస పంచాంగం లింక్"],
          "panchang.find_muhurtha": ["Find Muhurtham CTA Banner", "ముహూర్త శోధన బ్యానర్"],
          "panchang.live_cards": ["Live Cards (Lagna, Good/Bad Times)", "లైవ్ కార్డులు (లగ్నం, శుభ/అశుభాలు)"],
          "panchang.angas": ["Principal Angas (Tithi, Nakshatra...)", "పంచాంగ ప్రధానాంగాలు (తిథి, నక్షత్రం...)"],
          "panchang.timeline": ["24-Hour Day Timeline", "24 గంటల కాల చక్రం"],
          "panchang.timings": ["Good & Bad Times (Rahu, Yama, Varjyam)", "శుభ & అశుభ సమయాలు (రాహుకాలం...)"],
          "panchang.ashta_kaalas": ["Dina Ashta Kaalas (8 Divisions)", "దిన అష్ట కాల విభజన (8 కాలాలు)"],
          "panchang.hora_choghadiya": ["Hora & Choghadiya Tables", "హోర & చోఘడియా పట్టికలు"],
          "panchang.chandrabalam": ["Chandrabalam for All Rashis", "రాశి వారి చంద్రబలం"],
          "panchang.lagnas": ["12 Lagnas Detailed Table", "12 లగ్నాల వివరాల పట్టిక"],
          "panchang.shloka": ["Daily Shloka & Mantra", "నేటి శ్లోకం & మంత్రం"],

          // Monthly
          "panchang_month.view": ["Monthly Panchang (Page Access)", "మాస పంచాంగం (పేజీ దర్శనం)"],
          "panchang_month.navigate": ["Month & Year Navigator", "నెల & సంవత్సరం మార్చడం"],
          "panchang_month.day_details": ["Day Details Modal / Popover", "రోజు వివరాల పాపప్"],
          "panchang_month.export_pdf": ["Export Month Calendar as PDF", "నెల క్యాలెండర్ PDF ఎగుమతి"],
          "panchang_month.festivals": ["Festivals & Vratams Markers", "పండుగలు & వ్రతాల సూచికలు"],

          // Muhurtha
          "muhurta.search": ["Muhurta Finder (Page Access)", "ముహూర్త శోధన (పేజీ దర్శనం)"],
          "muhurta.select_activity": ["Select Activity & Category", "కార్యక్రమం & వర్గం ఎంపిక"],
          "muhurta.date_range": ["Custom Date Range Selection", "తేదీల పరిధి ఎంపిక"],
          "muhurta.time_filters": ["Time Window Filters", "సమయ విండో ఫిల్టర్లు"],
          "muhurta.participants": ["Participant Birth Charts Matching", "జాతక చక్రాల సరిపోలిక"],
          "muhurta.audit": ["Muhurtha Parishilana (Quality Audit)", "ముహూర్త పరిశీలన (నాణ్యత విశ్లేషణ)"],
          "muhurta.save": ["Save Muhurtham to Vault", "ముహూర్తాన్ని భద్రపరచడం"],
          "muhurta.delete": ["Delete Saved Muhurthams", "భద్రపరిచిన ముహూర్తాల తొలగింపు"],
          "muhurta.export": ["Export & Share Muhurtham", "ముహూర్తాన్ని పంచుకోవడం / ఎగుమతి"],

          // Catalog
          "catalog.view": ["Muhurtas Catalog (Page Access)", "కేటలాగ్ (పేజీ దర్శనం)"],
          "catalog.browse": ["Browse 106+ Activities", "కార్యక్రమాల బ్రౌజింగ్"],
          "catalog.search": ["Search & Filter Catalog", "కేటలాగ్ వెతకడం"],
          "catalog.rules": ["View Activity Rules & Guidelines", "గ్రహ బలాలు & నిబంధనలు చూడడం"],

          // Family
          "family.view": ["Family Vault (Page Access)", "కుటుంబ ఖజానా (పేజీ దర్శనం)"],
          "family.add": ["Add Family Member", "కుటుంబ సభ్యులను చేర్చడం"],
          "family.view_details": ["View Encrypted Birth Details", "జన్మ వివరాలు చూడడం"],
          "family.edit": ["Edit Family Member Details", "కుటుంబ సభ్యుల వివరాలు సవరణ"],
          "family.delete": ["Remove Family Member", "కుటుంబ సభ్యుల తొలగింపు"],
          "family.events": ["Family Events & Rites", "కుటుంబ విశేషాలు & శ్రాద్ధాలు"],
          "family.export": ["Export Family Vault Data", "కుటుంబ ఖజానా డేటా ఎగుమతి"],

          // Saved
          "saved.view": ["Saved Searches (Page Access)", "నా ముహూర్తాలు (పేజీ దర్శనం)"],
          "saved.favourite": ["Star / Favourite Saved Searches", "ముహూర్తాలకు స్టార్ గుర్తు"],
          "saved.edit_label": ["Edit Custom Notes & Labels", "నోట్స్ & లేబుల్స్ సవరణ"],
          "saved.delete": ["Delete Saved Searches", "భద్రపరిచిన శోధనల తొలగింపు"],
          "saved.export": ["Download & Export Saved Searches", "సేవ్ చేసిన ముహూర్తాల డౌన్‌లోడ్"],

          // Account
          "self.edit": ["Account & Profile (Access)", "ప్రొఫైల్ & ఖాతా (దర్శనం)"],
          "self.edit_name": ["Edit Display Name", "పేరు సవరణ"],
          "self.edit_language": ["Change Language", "భాష మార్పు"],
          "self.edit_home_place": ["Change Home City & Coordinates", "స్వస్థలం మార్పు"],
          "self.sessions": ["Manage Device Sessions", "పరికరాల సెషన్ల నిర్వహణ"],
          "self.delete_account": ["Request Account Deletion", "ఖాతా తొలగింపు అభ్యర్థన"],

          // Admin
          "users.view": ["Users Page Access", "వినియోగదారుల పేజీ చూడడం"],
          "users.view_mobile": ["Reveal Full Mobile Numbers", "పూర్తి మొబైల్ నంబర్లు చూడడం"],
          "users.disable": ["Disable/Enable Users", "వినియోగదారులను నిలిపివేయడం"],
          "users.create": ["Add / Invite Users", "వినియోగదారులను చేర్చడం"],
          "users.edit": ["Edit User Profile", "వినియోగదారుని ప్రొఫైల్ సవరణ"],
          "users.delete": ["Delete User Account", "వినియోగదారుని ఖాతా తొలగింపు"],
          "users.reset_sessions": ["Force Logout Sessions", "సెషన్లు రద్దు చేయడం"],
          "users.export": ["Export Users List", "వినియోగదారుల ఎగుమతి"],
          "users.set_perms": ["Manage User Perms", "అధికారాల నిర్వహణ"],
          "content.edit": ["Content & Rules Access", "విషయాలు & సూత్రాలు సవరణ"],
          "content.announcements": ["Manage Announcements", "ప్రకటనలు నిర్వహణ"],
          "content.utpata": ["Manage Utpata Dates", "ఉత్పాత తేదీల నిర్వహణ"],
          "content.texts": ["Edit App Texts", "యాప్ పాఠ్యాలు సవరణ"],
          "content.rules": ["Manage Muhurta Rules", "ముహూర్త సూత్రాల నిర్వహణ"],
          "audit.view_users": ["View Activity Logs", "కార్యకలాపాల లాగ్‌లు"],
          "system.view": ["View System Stats & Health", "గణాంకాలు & ఆరోగ్య స్థితి"],
          "audit.export": ["Export Audit Logs", "లాగ్‌లు ఎగుమతి"]
        };

        var GROUPS_DEF = [
          {
            title: ["Today's Panchangam", "నేటి పంచాంగం"],
            parent: "panchang.view",
            keys: [
              "panchang.view", "panchang.change_place", "panchang.change_date", "panchang.share", "panchang.export_pdf",
              "panchang.month", "panchang.find_muhurtha", "panchang.live_cards", "panchang.angas", "panchang.timeline",
              "panchang.timings", "panchang.ashta_kaalas", "panchang.hora_choghadiya", "panchang.chandrabalam",
              "panchang.lagnas", "panchang.shloka"
            ]
          },
          {
            title: ["Monthly Panchangam", "మాస పంచాంగం"],
            parent: "panchang_month.view",
            keys: ["panchang_month.view", "panchang_month.navigate", "panchang_month.day_details", "panchang_month.export_pdf", "panchang_month.festivals"]
          },
          {
            title: ["Muhurtha Darshini / Finder", "ముహూర్త దర్శిని / శోధన"],
            parent: "muhurta.search",
            keys: [
              "muhurta.search", "muhurta.select_activity", "muhurta.date_range", "muhurta.time_filters",
              "muhurta.participants", "muhurta.audit", "muhurta.save", "muhurta.delete", "muhurta.export"
            ]
          },
          {
            title: ["All Muhurtas Catalog", "అన్ని ముహూర్తాల కేటలాగ్"],
            parent: "catalog.view",
            keys: ["catalog.view", "catalog.browse", "catalog.search", "catalog.rules"]
          },
          {
            title: ["Family Vault", "కుటుంబ ఖజానా"],
            parent: "family.view",
            keys: ["family.view", "family.add", "family.view_details", "family.edit", "family.delete", "family.events", "family.export"]
          },
          {
            title: ["My Saved Muhurtas", "నా ముహూర్తాలు"],
            parent: "saved.view",
            keys: ["saved.view", "saved.favourite", "saved.edit_label", "saved.delete", "saved.export"]
          },
          {
            title: ["Account & Profile", "ప్రొఫైల్ & ఖాతా"],
            parent: "self.edit",
            keys: ["self.edit", "self.edit_name", "self.edit_language", "self.edit_home_place", "self.sessions", "self.delete_account"]
          },
          {
            title: ["Users Management (Admin)", "వినియోగదారుల నిర్వహణ (నిర్వాహక)"],
            parent: "users.view",
            keys: [
              "users.view", "users.view_mobile", "users.disable", "users.create", "users.edit", "users.delete",
              "users.reset_sessions", "users.export", "users.set_perms"
            ]
          },
          {
            title: ["Content & Rules (Admin)", "విషయాలు & సూత్రాలు (నిర్వాహక)"],
            parent: "content.edit",
            keys: ["content.edit", "content.announcements", "content.utpata", "content.texts", "content.rules"]
          },
          {
            title: ["Audit & Analytics (Admin)", "కార్యకలాపాలు & గణాంకాలు (నిర్వాహక)"],
            parent: "audit.view_users",
            keys: ["audit.view_users", "system.view", "audit.export"]
          }
        ];

        var permLookup = {};
        res.permissions.forEach(function (item) { permLookup[item.key] = item; });

        var groupsHtml = GROUPS_DEF.map(function (grp) {
          var matching = grp.keys.map(function (k) { return permLookup[k]; }).filter(Boolean);
          if (!matching.length) return "";
          var parentItem = permLookup[grp.parent] || matching[0];
          var activeCount = matching.filter(function (m) { return m.effective; }).length;

          var itemsList = matching.map(function (item) {
            var label = permMap[item.key] ? tr(permMap[item.key][0], permMap[item.key][1]) : item.key;
            var isParent = item.key === grp.parent;
            var statusBadge = item.has_override
              ? (item.override_value
                  ? '<span class="status-chip status-chip--active" style="font-size:11px;">' + tr("Explicit: ON", "స్పష్టంగా: చురుకు") + '</span>'
                  : '<span class="status-chip status-chip--disabled" style="font-size:11px;">' + tr("Explicit: OFF", "స్పష్టంగా: నిలిపివేత") + '</span>')
              : (item.role_default
                  ? '<span style="color:#666; font-size:11px;">' + tr("Default: ON", "సాధారణం: చురుకు") + '</span>'
                  : '<span style="color:#666; font-size:11px;">' + tr("Default: OFF", "సాధారణం: నిలిపివేత") + '</span>');

            var toggleBtn = item.effective
              ? '<button type="button" class="btn btn--sm btn--danger" data-pperm="' + esc(item.key) + '" data-paction="disable" style="padding:2px 8px; font-size:12px;">' + tr("Block", "నిషేధించు") + '</button>'
              : '<button type="button" class="btn btn--sm" data-pperm="' + esc(item.key) + '" data-paction="enable" style="padding:2px 8px; font-size:12px;">' + tr("Allow", "అనుమతించు") + '</button>';
            var resetBtn = item.has_override
              ? ' <button type="button" class="linkish" data-pperm="' + esc(item.key) + '" data-paction="reset" style="font-size:11px;">' + tr("Reset to default", "సాధారణ స్థితికి") + '</button>'
              : '';

            return '<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f0f0f0;' + (isParent ? ' background:#fafcf7; font-weight:600;' : ' padding-left:14px;') + '">' +
              '<div style="flex:1;">' + (isParent ? '⭐ ' : '↳ ') + '<strong>' + esc(label) + '</strong> <small style="display:block; color:#888;">' + esc(item.key) + '</small></div>' +
              '<div style="margin:0 10px;">' + statusBadge + '</div>' +
              '<div>' + (res.can_edit ? toggleBtn + resetBtn : "") + '</div>' +
              '</div>';
          }).join("");

          return '<div class="cf-perm-group is-open" style="margin-bottom:10px;">' +
            '<div class="cf-perm-header" data-toggle-subaccordion="1">' +
              '<div class="cf-perm-title"><span class="cf-perm-chevron" aria-hidden="true">&#9654;</span> <span>' + esc(tr(grp.title[0], grp.title[1])) + '</span></div>' +
              '<div class="cf-perm-ctrls"><span class="cf-perm-badge">' + activeCount + '/' + matching.length + ' ' + tr("active", "చురుకు") + '</span></div>' +
            '</div>' +
            '<div class="cf-perm-children" style="display:block; padding:8px 12px;">' +
              itemsList +
            '</div>' +
          '</div>';
        }).join("");

        var pf = rowForm(row,
          '<div style="max-height:440px; overflow-y:auto; padding:8px 0; min-width:360px;">' +
          '<div style="font-weight:bold; margin-bottom:10px; font-size:1.05rem; color:var(--color-primary-strong);">' + tr("Privileges for: ", "అధికారాలు: ") + esc(res.name) + ' (' + esc(res.role) + ')</div>' +
          groupsHtml +
          '</div>'
        );

        pf.addEventListener("click", async function (pev) {
          var subHdr = pev.target.closest("[data-toggle-subaccordion]");
          if (subHdr && !pev.target.closest("button")) {
            var grp = subHdr.closest(".cf-perm-group");
            if (grp) grp.classList.toggle("is-open");
            return;
          }
          var pkey = pev.target.getAttribute("data-pperm");
          var pact = pev.target.getAttribute("data-paction");
          if (!pkey || !pact) return;
          pev.preventDefault();
          try {
            if (pact === "reset") {
              await api("DELETE", "/admin/people/" + id + "/permissions/" + encodeURIComponent(pkey));
              say("info", tr("Reverted to role default.", "సాధారణ స్థితికి మార్చాము."));
            } else {
              var isEn = pact === "enable";
              await api("PUT", "/admin/people/" + id + "/permissions", { permission_key: pkey, is_enabled: isEn });
              say("info", tr("Updated permission.", "అధికారం మార్చాము."));
            }
            pf.remove();
            load();
          } catch (err) {
            say("error", err.message);
          }
        });
      } catch (err) {
        say("error", err.message);
      }
    }
  });

  var start = new URLSearchParams(window.location.search).get("status");
  if (start) $("fStatus").value = start;
  window.onLangChange = render;
  load();
})();
