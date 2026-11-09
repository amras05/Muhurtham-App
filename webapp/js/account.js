// My account: name, language, home place, signed-in devices.
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var me = null, regions = [];

  function say(kind, text) {
    var box = $("acctMsg");
    box.hidden = false;
    box.className = "auth-alert auth-alert--" + (kind === "error" ? "error" : "info");
    box.textContent = text;
  }

  async function api(method, path, body) {
    var res = await fetch(API_BASE + path, { method: method, headers: { "Content-Type": "application/json" },
                                             body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: data }));
    return data;
  }

  function fillPlaces() {
    var sel = $("acPlace");
    var current = me && me.home ? me.home.name : "";
    sel.innerHTML = regions.map(function (r) {
      return '<option value="' + esc(r.id) + '"' + (r.label === current ? " selected" : "") + ">" + esc(r.label) + "</option>";
    }).join("");
  }

  async function loadDevices() {
    var list = $("devices");
    try {
      var rows = await api("GET", "/me/sessions");
      list.innerHTML = rows.map(function (s) {
        var when = s.last_used_at ? new Date(s.last_used_at).toLocaleString() : "";
        return "<li><div><strong>" + esc(s.device_label || tr("Device", "పరికరం")) + "</strong>" +
          (s.current ? ' <span class="chip-current">' + tr("this device", "ఈ పరికరం") + "</span>" : "") +
          "<small>" + esc(tr("Last used ", "చివరిసారి ") + when) + "</small></div>" +
          (s.current ? "" : '<button type="button" class="btn btn--sm btn--ghost" data-sid="' + esc(s.id) + '">' + tr("Sign out", "సైన్ అవుట్") + "</button>") + "</li>";
      }).join("") || "<li>" + tr("No devices.", "పరికరాలు లేవు.") + "</li>";
    } catch (e) { list.innerHTML = "<li>" + esc(e.message) + "</li>"; }
  }

  $("devices").addEventListener("click", async function (e) {
    var sid = e.target.getAttribute("data-sid");
    if (!sid) return;
    try { await api("DELETE", "/me/sessions/" + encodeURIComponent(sid)); say("info", tr("That device has been signed out.", "ఆ పరికరం నుండి సైన్ అవుట్ అయ్యారు.")); loadDevices(); }
    catch (err) { say("error", err.message); }
  });

  $("profileForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    try {
      me = await api("PUT", "/me", { name: $("acName").value.trim(), preferred_language: $("acLang").value });
      setLang(me.preferred_language);
      await Auth.me(); Auth.renderMenu();
      say("info", tr("Saved.", "భద్రపరచాము."));
    } catch (err) { say("error", err.message); }
  });

  $("homeForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var r = regions.find(function (x) { return x.id === $("acPlace").value; });
    if (!r) return;
    try {
      me = await api("PUT", "/me", { home_place: r.label, home_lat: r.lat, home_lon: r.lon, home_tz: r.tz_offset });
      say("info", tr("Home place saved: ", "ఇంటి ప్రదేశం భద్రపరచాము: ") + r.label);
    } catch (err) { say("error", err.message); }
  });

  (async function () {
    try {
      me = await api("GET", "/me");
      $("acName").value = me.name || "";
      $("acPhone").textContent = String(me.phone || "").length === 10 ? "+91 " + me.phone : "+" + me.phone;
      $("acLang").value = me.preferred_language || "te";
      regions = (await api("GET", "/regions")).filter(function (r) { return r.id !== "custom"; });
      fillPlaces();
    } catch (err) { say("error", err.message); }
    loadDevices();
  })();
  window.onLangChange = loadDevices;

  // ── Your data (plan R3) ──
  $("exportBtn").addEventListener("click", async function () {
    var b = this; b.disabled = true;
    try {
      var res = await fetch(API_BASE + "/me/export");
      if (!res.ok) { var d = await res.json().catch(function () { return null; }); throw new Error(Auth.errorText({ status: res.status, data: d })); }
      var blob = await res.blob(), m = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "");
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = m ? m[1] : "muhurtham_my_data.json";
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
      say("info", tr("Your data was downloaded. It includes birth details: keep the file safe.", "మీ సమాచారం డౌన్‌లోడ్ అయింది. జన్మ వివరాలు ఉన్నాయి: ఫైల్‌ను జాగ్రత్తగా ఉంచండి."));
    } catch (err) { say("error", err.message); }
    finally { b.disabled = false; }
  });
  $("deleteForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!$("delSure").checked) return;
    try {
      await api("POST", "/me/delete", { password: $("delPassword").value });
      window.location.replace("/login.html?deleted=1");
    } catch (err) { say("error", err.message); }
  });
})();
