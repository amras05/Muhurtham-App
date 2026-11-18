// ============================================================
// Gayatri Jyotirnidhi · Family Vault header (Stitch "desktop_settings_vault", 19 Nov 2026)
// The profile header above the family, saved-muhurta and account blocks: name, role, mobile (middle
// digits hidden on screen) and home place, from GET /me. The blocks below have their own scripts.
// ============================================================
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  var me = null;
  var ROLES = { user: ["Member", "సభ్యులు"], admin: ["Admin", "నిర్వాహకులు"], super_admin: ["Super admin", "ప్రధాన నిర్వాహకులు"] };

  function masked(phone) {
    var d = String(phone || "").replace(/\D/g, "");
    if (d.length < 6) return phone || "";
    return "+" + d.slice(0, d.length - 10) + " " + d.slice(-10, -5) + " •••••";
  }

  function render() {
    if (!me) return;
    $("fvName").textContent = me.name || tr("Your account", "మీ ఖాతా");
    var role = ROLES[me.role] || ROLES.user;
    $("fvRole").textContent = tr(role[0], role[1]);
    $("fvPhone").textContent = masked(me.phone);
    var home = me.home || {};
    $("fvHome").textContent = home.name ? (me.home_is_default ? tr("Default place: ", "డిఫాల్ట్ ప్రదేశం: ") : tr("Home: ", "ఇల్లు: ")) + home.name : "";
  }

  async function load() {
    try {
      var res = await fetch(API_BASE + "/me");
      var body = await res.json().catch(function () { return null; });
      if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: body }));
      me = body;
      render();
    } catch (err) {
      $("fvName").textContent = tr("Your account", "మీ ఖాతా");
      console.error("Profile header could not be loaded:", err.message);
    }
  }

  window.onLangChange = render;     // collected with the other blocks' handlers on this page
  // The account block saves name and home place through PUT /me; refresh the header after a save.
  ["profileForm", "homeForm"].forEach(function (id) {
    var f = $(id);
    if (f) f.addEventListener("submit", function () { setTimeout(load, 800); });
  });
  load();
})();
