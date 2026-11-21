// Users page (admin and super admin): search, masked mobiles with a logged reveal, disable / enable,
// several at once; adding people with a password and setting passwords (21 Nov 2026: admins add users,
// super admins also admins, the owner also super admins; the owner account is managed by nobody else).
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var rows = [], selected = {}, canCreate = false, createRoles = ["user"], roleChoices = ["user", "admin"];
  var ROLE = { user: "User", admin: "Admin", super_admin: "Super admin" };
  var STATUS = { active: "Active", disabled: "Disabled", pending: "Sign-up not finished",
                 invited: "Invited" };

  function say(kind, text) { var b = $("usersMsg"); b.hidden = false; b.className = "auth-alert auth-alert--" + kind; b.textContent = text; b.scrollIntoView({ block: "nearest" }); }

  async function api(method, path, body) {
    var res = await fetch(API_BASE + path, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: data }));
    return data;
  }

  function when(iso) { return iso ? new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : t("Never"); }
  function link(act, id, label, extra) { return '<button type="button" class="linkish" data-act="' + act + '" data-id="' + id + '"' + (extra || "") + ">" + esc(label) + "</button>"; }

  function render() {
    $("usersCount").textContent = t("{n} shown", { n: rows.length });
    $("addPersonBtn").hidden = !canCreate;
    // Roles this person may give a new account (server: creatable_roles): admins add users, super admins
    // also admins, the owner also super admins (21 Nov 2026).
    var cur = $("apRole").value;
    $("apRole").innerHTML = createRoles.map(function (r) {
      return '<option value="' + r + '"' + (r === cur ? " selected" : "") + ">" + esc(t(ROLE[r])) + "</option>"; }).join("");
    $("peopleBody").innerHTML = rows.length ? rows.map(function (p) {
      var st = STATUS[p.status] || p.status;
      var acts = [];
      if (p.can_manage && p.status === "active") acts.push(link("disable", p.id, t("Disable")));
      if (p.can_manage && p.status === "disabled") acts.push(link("enable", p.id, t("Enable")));
      if (p.can_change_role) roleChoices.filter(function (r) { return r !== p.role; }).forEach(function (r) {
        acts.push(link("role", p.id, t({ user: "Make user", admin: "Make admin", super_admin: "Make super admin" }[r] || r), ' data-role="' + r + '"'));
      });
      if (p.can_set_password) acts.push(link("password", p.id, t("Set password")));
      if (p.can_edit) acts.push(link("edit", p.id, t("Edit")));
      if (p.can_set_perms) acts.push(link("perms", p.id, t("Permissions")));
      if (p.can_delete) acts.push(link("delete", p.id, t("Delete")));
      var box = p.can_manage ? '<input type="checkbox" data-sel="' + p.id + '"' + (selected[p.id] ? " checked" : "") + ' aria-label="' + esc(t("Select {name}", { name: p.name })) + '">' : "";
      return '<tr data-row="' + p.id + '"><td>' + box + "</td><td><strong>" + esc(p.name) + "</strong><small>" + t("{n} device(s) signed in", { n: p.devices }) + "</small></td>" +
        '<td><span class="mob">' + esc(p.mobile_masked) + "</span> " + link("reveal", p.id, t("Show")) + "</td>" +
        // The owner shows as a plain super admin (user, 21 Nov 2026); it is still protected on the server.
        "<td>" + esc(t(ROLE[p.role])) + "</td>" +
        '<td><span class="status-chip status-chip--' + p.status + '">' + esc(t(st)) + "</span>" +
        (p.locked ? ' <span class="status-chip status-chip--locked">' + t("Locked") + "</span>" : "") +
        (p.disabled_reason ? "<small>" + esc(p.disabled_reason) + "</small>" : "") + "</td>" +
        "<td>" + esc(when(p.last_login_at)) + "<small>" + t("{n} logins", { n: p.login_count }) + "</small></td>" +
        '<td class="acts">' + (acts.length ? acts.join("<br>") : "<small>—</small>") + "</td></tr>";
    }).join("") : '<tr><td colspan="7" class="empty-state">' + t("No one matches.") + "</td></tr>";
    renderBulk();
  }

  function renderBulk() {
    var ids = Object.keys(selected);
    $("bulkBar").hidden = ids.length === 0;
    $("bulkCount").textContent = t("{n} selected", { n: ids.length });
    $("bulkReason").placeholder = t("Reason for disabling");
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

  // ── Add a person / Edit a person: one dialog (21 Nov 2026) ──
  var dlgMode = "add", dlgId = null;
  function dlgError(text) { var e = $("pdError"); e.hidden = !text; e.textContent = text || ""; }
  function openPersonDialog(mode, p) {
    dlgMode = mode; dlgId = p ? p.id : null;
    $("personForm").reset(); dlgError("");
    var add = mode === "add", pwOnly = mode === "password";
    $("pdTitle").textContent = add ? t("Add a person")
      : pwOnly ? t("Set password for {name}", { name: p.name })
      : t("Edit {name}", { name: p.name });
    $("pdHint").textContent = add
      ? t("They can log in straight away with this mobile and password.")
      : pwOnly ? t("They are signed out on every device and log in again with the new password (mobile {mobile}).", { mobile: p.mobile_masked })
      : t("Current mobile {mobile}. A new mobile signs them out until they confirm it with a WhatsApp code.", { mobile: p.mobile_masked });
    $("pdPerson").hidden = pwOnly;
    document.querySelectorAll("#personForm .pf-pass__toggle").forEach(function (b) {
      $(b.getAttribute("data-for")).type = "password"; b.setAttribute("aria-pressed", "false"); b.textContent = t("Show");
    });
    $("pdPhoneLabel").textContent = add ? t("Mobile") : t("New mobile (leave empty to keep)");
    $("apPhone").required = add;
    $("pdRoleField").hidden = !add;
    $("pdPasswords").hidden = !(add || pwOnly);
    $("apPass").required = add || pwOnly; $("apPass2").required = add || pwOnly;
    var keep = $("apLang").querySelector('option[value=""]');
    if (add && keep) keep.remove();
    if (!add && !keep) $("apLang").insertAdjacentHTML("afterbegin", '<option value="">' + esc(t("Keep as it is")) + "</option>");
    $("apLang").value = add ? "te" : "";
    if (!add) $("apName").value = p.name;
    $("pdSubmit").textContent = add ? t("Add") : pwOnly ? t("Set password") : t("Save");
    $("pdClose").setAttribute("aria-label", t("Close"));
    $("personDialog").showModal();
    $(pwOnly ? "apPass" : "apName").focus();
  }
  $("addPersonBtn").addEventListener("click", function () { openPersonDialog("add"); });
  $("apCancel").addEventListener("click", function () { $("personDialog").close(); });
  $("pdClose").addEventListener("click", function () { $("personDialog").close(); });
  // Show / hide what was typed in a password box
  $("personForm").addEventListener("click", function (e) {
    var b = e.target.closest(".pf-pass__toggle");
    if (!b) return;
    var inp = $(b.getAttribute("data-for")), show = inp.type === "password";
    inp.type = show ? "text" : "password";
    b.setAttribute("aria-pressed", String(show));
    b.textContent = show ? t("Hide") : t("Show");
    inp.focus();
  });
  // The dialog checks the fields itself (novalidate), so the message shows inside it, in the chosen language.
  function dlgInvalid() {
    var add = dlgMode === "add";
    if (dlgMode === "password") {
      if ($("apPass").value.length < 8) return [$("apPass"), t("The password must be at least 8 characters.")];
      if ($("apPass").value !== $("apPass2").value) return [$("apPass2"), t("The two passwords do not match.")];
      return null;
    }
    if ($("apName").value.trim().length < 2) return [$("apName"), t("Enter the full name (at least 2 letters).")];
    if (add && !$("apPhone").value.trim()) return [$("apPhone"), t("Enter the mobile number.")];
    if (add && $("apPass").value.length < 8) return [$("apPass"), t("The password must be at least 8 characters.")];
    if (add && $("apPass").value !== $("apPass2").value) return [$("apPass2"), t("The two passwords do not match.")];
    return null;
  }
  $("personForm").addEventListener("submit", async function (e) {
    e.preventDefault();                 // keep the dialog open until the server says yes
    dlgError("");
    var bad = dlgInvalid();
    if (bad) { dlgError(bad[1]); bad[0].focus(); return; }
    $("pdSubmit").disabled = true;
    try {
      if (dlgMode === "password") {
        var po = await api("POST", "/admin/people/" + dlgId + "/password", { password: $("apPass").value, confirm_password: $("apPass2").value });
        say("info", t("Password set. They were signed out of {n} device(s) and log in with the new password.", { n: po.signed_out_devices }));
      } else if (dlgMode === "add") {
        await api("POST", "/admin/people", { name: $("apName").value.trim(), phone: $("apPhone").value.trim(),
                                             role: $("apRole").value, preferred_language: $("apLang").value,
                                             password: $("apPass").value, confirm_password: $("apPass2").value });
        say("info", t("Added. They can log in now with this mobile and the password you set."));
        $("fStatus").value = "";
      } else {
        var body = { name: $("apName").value.trim() };
        if ($("apPhone").value.trim()) body.phone = $("apPhone").value.trim();
        if ($("apLang").value) body.preferred_language = $("apLang").value;
        var out = await api("PUT", "/admin/people/" + dlgId, body);
        say("info", out.needs_confirmation
          ? t("Saved. They are signed out and must confirm the new number: login page → \"Forgot password\".")
          : t("Saved."));
      }
      $("personDialog").close();
      load();
    } catch (err) { dlgError(err.message); }
    finally { $("pdSubmit").disabled = false; }
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
    if (act === "disable" && reason.length < 3) { say("error", t("Write a reason (at least 3 letters) before disabling.")); $("bulkReason").focus(); return; }
    try {
      var out = await api("POST", "/admin/people/bulk", { ids: Object.keys(selected), action: act, reason: act === "disable" ? reason : undefined });
      var msg = t("{n} done.", { n: out.done.length });
      if (out.skipped.length) msg += " " + t("{n} skipped:", { n: out.skipped.length }) + " " +
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
    cell.insertAdjacentHTML("beforeend", '<form class="row-form">' + html + ' <button type="button" class="linkish" data-act="cancel">' + t("Cancel") + "</button></form>");
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
    } else if (act === "disable" && p) {
      // Confirmation dialogs (21 Nov 2026) for disable, role change and delete.
      var reason = await AppShell.confirm(
        t("{name} will be signed out on every device and can't log in until enabled again.", { name: p.name }),
        { title: t("Disable {name}?", { name: p.name }), ok: t("Disable"), danger: true,
          input: { label: t("Reason (shown to admins)"), minLength: 3, maxLength: 200,
                   error: t("Write a reason of at least 3 letters.") } });
      if (reason == null) return;
      try {
        var out = await api("POST", "/admin/people/" + id + "/disable", { reason: reason });
        say("info", t("Disabled. {n} device(s) signed out.", { n: out.signed_out_devices }));
        load();
      } catch (err) { say("error", err.message); }
    } else if (act === "enable") {
      try { await api("POST", "/admin/people/" + id + "/enable"); say("info", t("Enabled.")); load(); }
      catch (err) { say("error", err.message); }
    } else if (act === "role" && p) {
      var newRole = e.target.getAttribute("data-role");
      var rn = ROLE[newRole] || newRole, cur = ROLE[p.role] || p.role;
      var what = { user: "They lose the admin pages and keep their own account.",
                   admin: "They get the admin pages, with the powers set in Settings › What admins may do.",
                   super_admin: "They get every power, including Settings and managing admins." }[newRole] || "";
      var okRole = await AppShell.confirm(
        t("{name}: {from} → {to}. {what} It applies from their next click.", { name: p.name, from: t(cur), to: t(rn), what: what ? t(what) : "" }),
        { title: t({ user: "Make {name} a user?", admin: "Make {name} an admin?", super_admin: "Make {name} a super admin?" }[newRole] || "Change {name}'s role?", { name: p.name }),
          ok: t("Change role"), danger: newRole === "super_admin" });
      if (!okRole) return;
      try {
        await api("POST", "/admin/people/" + id + "/role", { role: newRole });
        say("info", t("Role changed. It applies from their next click."));
        load();
      } catch (err) { say("error", err.message); }
    } else if (act === "password" && p) {
      openPersonDialog("password", p);
    } else if (act === "edit" && p) {
      openPersonDialog("edit", p);
    } else if (act === "delete" && p) {
      var typed = await AppShell.confirm(
        t("This removes their name, mobile, family details and saved muhurtas. It can't be undone; the activity log keeps a record that the account existed."),
        { title: t("Delete {name} for good?", { name: p.name }), ok: t("Delete for good"), danger: true,
          input: { label: t("Type their name to confirm: {name}", { name: p.name }), placeholder: p.name,
                   maxLength: 80, mustEqual: p.name, error: t("The name doesn't match. Type it exactly as shown.") } });
      if (typed == null) return;
      try {
        await api("POST", "/admin/people/" + id + "/delete", { confirm_name: typed });
        say("info", t("Deleted. The activity log keeps a record that the account existed."));
        delete selected[id]; load();
      } catch (err) { say("error", err.message); }
    } else if (act === "perms" && p) {
      try {
        var res = await api("GET", "/admin/people/" + id + "/permissions");
        var permMap = {
          // Panchang
          "panchang.view": "Today's Panchang (Page Access)",
          "panchang.change_place": "Change Location / City",
          "panchang.change_date": "Change Date (Picker & Prev/Next)",
          "panchang.share": "Share Panchang (Link, WhatsApp, Image)",
          "panchang.export_pdf": "Download Panchang as PDF",
          "panchang.month": "Switch to Monthly View Link",
          "panchang.find_muhurtha": "Find Muhurtham CTA Banner",
          "panchang.live_cards": "Live Cards (Lagna, Good/Bad Times)",
          "panchang.angas": "Principal Angas (Tithi, Nakshatra...)",
          "panchang.timeline": "24-Hour Day Timeline",
          "panchang.timings": "Good & Bad Times (Rahu, Yama, Varjyam)",
          "panchang.ashta_kaalas": "Dina Ashta Kaalas (8 Divisions)",
          "panchang.hora_choghadiya": "Hora & Choghadiya Tables",
          "panchang.chandrabalam": "Chandrabalam for All Rashis",
          "panchang.lagnas": "12 Lagnas Detailed Table",
          "panchang.shloka": "Daily Shloka & Mantra",

          // Monthly
          "panchang_month.view": "Monthly Panchang (Page Access)",
          "panchang_month.navigate": "Month & Year Navigator",
          "panchang_month.day_details": "Day Details Modal / Popover",
          "panchang_month.export_pdf": "Export Month Calendar as PDF",
          "panchang_month.festivals": "Festivals & Vratams Markers",

          // Muhurtha
          "muhurta.search": "Muhurta Finder (Page Access)",
          "muhurta.select_activity": "Select Activity & Category",
          "muhurta.date_range": "Custom Date Range Selection",
          "muhurta.time_filters": "Time Window Filters",
          "muhurta.participants": "Participant Birth Charts Matching",
          "muhurta.audit": "Muhurtha Parishilana (Quality Audit)",
          "muhurta.save": "Save Muhurtham to Vault",
          "muhurta.delete": "Delete Saved Muhurthams",
          "muhurta.export": "Export & Share Muhurtham",

          // Catalog
          "catalog.view": "Muhurtas Catalog (Page Access)",
          "catalog.browse": "Browse 106+ Activities",
          "catalog.search": "Search & Filter Catalog",
          "catalog.rules": "View Activity Rules & Guidelines",

          // Family
          "family.view": "Family Vault (Page Access)",
          "family.add": "Add Family Member",
          "family.view_details": "View Encrypted Birth Details",
          "family.edit": "Edit Family Member Details",
          "family.delete": "Remove Family Member",
          "family.events": "Family Events & Rites",
          "family.export": "Export Family Vault Data",

          // Saved
          "saved.view": "Saved Searches (Page Access)",
          "saved.favourite": "Star / Favourite Saved Searches",
          "saved.edit_label": "Edit Custom Notes & Labels",
          "saved.delete": "Delete Saved Searches",
          "saved.export": "Download & Export Saved Searches",

          // Account
          "self.edit": "Account & Profile (Access)",
          "self.edit_name": "Edit Display Name",
          "self.edit_language": "Change Language",
          "self.edit_home_place": "Change Home City & Coordinates",
          "self.sessions": "Manage Device Sessions",
          "self.delete_account": "Request Account Deletion",

          // Admin
          "users.view": "Users Page Access",
          "users.view_mobile": "Reveal Full Mobile Numbers",
          "users.disable": "Disable/Enable Users",
          "users.create": "Add / Invite Users",
          "users.edit": "Edit User Profile",
          "users.delete": "Delete User Account",
          "users.reset_sessions": "Force Logout Sessions",
          "users.export": "Export Users List",
          "users.set_perms": "Manage User Perms",
          "content.edit": "Content & Rules Access",
          "content.announcements": "Manage Announcements",
          "content.utpata": "Manage Utpata Dates",
          "content.texts": "Edit App Texts",
          "content.rules": "Manage Muhurta Rules",
          "audit.view_users": "View Activity Logs",
          "system.view": "View System Stats & Health",
          "audit.export": "Export Audit Logs"
        };

        var GROUPS_DEF = [
          {
            title: "Today's Panchangam",
            parent: "panchang.view",
            keys: [
              "panchang.view", "panchang.change_place", "panchang.change_date", "panchang.share", "panchang.export_pdf",
              "panchang.month", "panchang.find_muhurtha", "panchang.live_cards", "panchang.angas", "panchang.timeline",
              "panchang.timings", "panchang.ashta_kaalas", "panchang.hora_choghadiya", "panchang.chandrabalam",
              "panchang.lagnas", "panchang.shloka"
            ]
          },
          {
            title: "Monthly Panchangam",
            parent: "panchang_month.view",
            keys: ["panchang_month.view", "panchang_month.navigate", "panchang_month.day_details", "panchang_month.export_pdf", "panchang_month.festivals"]
          },
          {
            title: "Muhurtha Darshini / Finder",
            parent: "muhurta.search",
            keys: [
              "muhurta.search", "muhurta.select_activity", "muhurta.date_range", "muhurta.time_filters",
              "muhurta.participants", "muhurta.audit", "muhurta.save", "muhurta.delete", "muhurta.export"
            ]
          },
          {
            title: "All Muhurtas Catalog",
            parent: "catalog.view",
            keys: ["catalog.view", "catalog.browse", "catalog.search", "catalog.rules"]
          },
          {
            title: "Family Vault",
            parent: "family.view",
            keys: ["family.view", "family.add", "family.view_details", "family.edit", "family.delete", "family.events", "family.export"]
          },
          {
            title: "My Saved Muhurtas",
            parent: "saved.view",
            keys: ["saved.view", "saved.favourite", "saved.edit_label", "saved.delete", "saved.export"]
          },
          {
            title: "Account & Profile",
            parent: "self.edit",
            keys: ["self.edit", "self.edit_name", "self.edit_language", "self.edit_home_place", "self.sessions", "self.delete_account"]
          },
          {
            title: "Users Management (Admin)",
            parent: "users.view",
            keys: [
              "users.view", "users.view_mobile", "users.disable", "users.create", "users.edit", "users.delete",
              "users.reset_sessions", "users.export", "users.set_perms"
            ]
          },
          {
            title: "Content & Rules (Admin)",
            parent: "content.edit",
            keys: ["content.edit", "content.announcements", "content.utpata", "content.texts", "content.rules"]
          },
          {
            title: "Audit & Analytics (Admin)",
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
            var label = permMap[item.key] ? t(permMap[item.key]) : item.key;
            var isParent = item.key === grp.parent;
            var statusBadge = item.has_override
              ? (item.override_value
                  ? '<span class="status-chip status-chip--active" style="font-size:11px;">' + t("Explicit: ON") + '</span>'
                  : '<span class="status-chip status-chip--disabled" style="font-size:11px;">' + t("Explicit: OFF") + '</span>')
              : (item.role_default
                  ? '<span style="color:#666; font-size:11px;">' + t("Default: ON") + '</span>'
                  : '<span style="color:#666; font-size:11px;">' + t("Default: OFF") + '</span>');

            var toggleBtn = item.effective
              ? '<button type="button" class="btn btn--sm btn--danger" data-pperm="' + esc(item.key) + '" data-paction="disable" style="padding:2px 8px; font-size:12px;">' + t("Block") + '</button>'
              : '<button type="button" class="btn btn--sm" data-pperm="' + esc(item.key) + '" data-paction="enable" style="padding:2px 8px; font-size:12px;">' + t("Allow") + '</button>';
            var resetBtn = item.has_override
              ? ' <button type="button" class="linkish" data-pperm="' + esc(item.key) + '" data-paction="reset" style="font-size:11px;">' + t("Reset to default") + '</button>'
              : '';

            return '<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f0f0f0;' + (isParent ? ' background:#fafcf7; font-weight:600;' : ' padding-left:14px;') + '">' +
              '<div style="flex:1;">' + (isParent ? '⭐ ' : '↳ ') + '<strong>' + esc(label) + '</strong> <small style="display:block; color:#888;">' + esc(item.key) + '</small></div>' +
              '<div style="margin:0 10px;">' + statusBadge + '</div>' +
              '<div>' + (res.can_edit ? toggleBtn + resetBtn : "") + '</div>' +
              '</div>';
          }).join("");

          return '<div class="cf-perm-group is-open" style="margin-bottom:10px;">' +
            '<div class="cf-perm-header" data-toggle-subaccordion="1">' +
              '<div class="cf-perm-title"><span class="cf-perm-chevron" aria-hidden="true">&#9654;</span> <span>' + esc(t(grp.title)) + '</span></div>' +
              '<div class="cf-perm-ctrls"><span class="cf-perm-badge">' + activeCount + '/' + matching.length + ' ' + t("active") + '</span></div>' +
            '</div>' +
            '<div class="cf-perm-children" style="display:block; padding:8px 12px;">' +
              itemsList +
            '</div>' +
          '</div>';
        }).join("");

        var pf = rowForm(row,
          '<div style="max-height:440px; overflow-y:auto; padding:8px 0; min-width:360px;">' +
          '<div style="font-weight:bold; margin-bottom:10px; font-size:1.05rem; color:var(--color-primary-strong);">' + esc(t("Privileges for: {name}", { name: res.name })) + ' (' + esc(res.role) + ')</div>' +
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
              say("info", t("Reverted to role default."));
            } else {
              var isEn = pact === "enable";
              await api("PUT", "/admin/people/" + id + "/permissions", { permission_key: pkey, is_enabled: isEn });
              say("info", t("Updated permission."));
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
