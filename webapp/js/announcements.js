// Announcements bar on the home pages (plan C5). Shows the notices running now for this role.
(function () {
  var list = [];
  function tr(en, te) { return (typeof currentLang !== "undefined" && currentLang === "te") ? (te || en) : (en || te); }
  function render() {
    var box = document.getElementById("announcements");
    if (!box) return;
    box.textContent = "";
    list.forEach(function (a) {
      var card = document.createElement("div");
      card.className = "announcement";
      var h = document.createElement("strong");
      h.textContent = tr(a.title_en, a.title_te);
      card.appendChild(h);
      var body = tr(a.body_en, a.body_te);
      if (body) { var p = document.createElement("p"); p.textContent = body; card.appendChild(p); }
      box.appendChild(card);
    });
  }
  async function load() {
    try {
      var res = await fetch(API_BASE + "/announcements");
      if (!res.ok) throw new Error("HTTP " + res.status);
      list = (await res.json()).announcements || [];
      render();
    } catch (e) {
      console.warn("Announcements not loaded:", e.message);   // the page works without them
    }
  }
  window.Announcements = { render: render };
  document.addEventListener("DOMContentLoaded", function () {
    var p = window.onLangChange;   // page scripts set their own handler; chain ours after it
    window.onLangChange = function () { if (p) p(); render(); };
  });
  load();
})();
