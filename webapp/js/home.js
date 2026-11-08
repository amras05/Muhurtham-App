// Home page (role: user): greeting, Today card, quick search into the finder.
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  var catalog = [];

  function fillEvents() {
    var sel = document.getElementById("qsEvent");
    var prev = sel.value;
    sel.innerHTML = '<option value="">' + tr("Choose an event", "కార్యం ఎంచుకోండి") + "</option>" +
      catalog.map(function (r) {
        var label = currentLang === "te" && r.title_te ? r.title_te + " (" + r.title_en + ")" : r.title_en;
        return '<option value="' + r.id + '"' + (r.id === prev ? " selected" : "") + ">" + label.replace(/</g, "&lt;") + "</option>";
      }).join("");
  }

  async function loadCatalog() {
    try {
      var res = await fetch(API_BASE + "/muhurta/catalog");
      if (!res.ok) throw new Error("HTTP " + res.status);
      catalog = ((await res.json()).all_activities || []).slice().sort(function (a, b) { return a.title_en.localeCompare(b.title_en); });
      fillEvents();
    } catch (e) {
      document.getElementById("qsEvent").innerHTML = '<option value="">' + tr("Event list unavailable", "కార్యాల జాబితా అందుబాటులో లేదు") + "</option>";
    }
  }

  document.getElementById("qsStart").valueAsDate = new Date();
  document.getElementById("quickSearch").addEventListener("submit", function (e) {
    e.preventDefault();
    var ev = document.getElementById("qsEvent").value;
    var start = document.getElementById("qsStart").value;
    if (!ev) return;
    window.location.href = "muhurta-finder.html?activity=" + encodeURIComponent(ev) + "&start=" + encodeURIComponent(start);
  });

  window.onLangChange = function () { fillEvents(); Today.render(); };
  Auth.me().then(function (u) {
    if (u) document.getElementById("helloName").textContent = ", " + u.name;
    if (u && u.preferred_language && u.preferred_language !== currentLang) setLang(u.preferred_language);
  });
  Today.mount("todayCard");
  loadCatalog();
})();
