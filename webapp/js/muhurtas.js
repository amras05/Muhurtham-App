// ============================================================
// Gayatri Jyotirnidhi · All muhurtas (Stitch "desktop_catalog", 19 Nov 2026)
// Every event from /muhurta/catalog, one card per category (tab), searchable. An event opens the
// Muhurta Darshini with it chosen (muhurta-finder.html?activity=<id>). Hidden events never arrive here:
// the server leaves them out of the catalog for users.
// ============================================================
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // One drawn icon per category (js/icons.js names)
  var ICONS = { vivaha: "users", upanayana: "lamp", vidya: "scroll", griha: "landmark", garbha: "moon", shishu: "user", career: "briefcase",
                business: "chart", travel: "plane", health: "leaf", spiritual: "flame", pitru: "hourglass", finance: "zap", agriculture: "leaf",
                personal: "star", general: "calendar", yogas: "sparkle" };
  var PREVIEW = 5;          // events shown on a card before "show all"
  var data = null, active = "all", query = "", open = {};

  function title(r) { return tr(r.title_en, r.title_te || r.title_en); }
  function finderLink(tabId, eventId) {
    if (tabId === "yogas") return "muhurta-finder.html#yogas";
    return eventId ? "muhurta-finder.html?activity=" + encodeURIComponent(eventId) : "muhurta-finder.html";
  }

  function eventsOf(tab) {
    var byId = data.byId;
    var list = (tab.events || []).map(function (id) { return byId[id]; }).filter(Boolean);
    if (!query) return list;
    var q = query.toLowerCase();
    return list.filter(function (r) {
      return [r.title_en, r.title_te, r.description_en, r.description_te, r.id].some(function (v) { return v && String(v).toLowerCase().indexOf(q) !== -1; });
    });
  }

  function render() {
    if (!data) return;
    var tabs = data.tabs;
    $("mcCount").textContent = tr(tabs.length + " categories · " + data.total + " events",
                                  tabs.length + " విభాగాలు · " + data.total + " కార్యాలు");
    $("mcSearch").placeholder = tr("Search events (marriage, griha pravesha, namakarana…)", "కార్యాలు వెతకండి (వివాహం, గృహప్రవేశం, నామకరణం…)");
    $("mcChips").innerHTML = '<button type="button" class="mc-chip" data-tab="all" aria-pressed="' + (active === "all") + '">' + tr("All", "అన్నీ") +
      ' <span>' + tabs.length + "</span></button>" + tabs.map(function (t) {
        return '<button type="button" class="mc-chip" data-tab="' + esc(t.id) + '" aria-pressed="' + (active === t.id) + '">' + esc(tr(t.en, t.te)) +
          (t.count ? " <span>" + t.count + "</span>" : "") + "</button>";
      }).join("");
    $("mcStats").innerHTML = [
      ["scroll", tr("Categories", "మొత్తం విభాగాలు"), tabs.length],
      ["calendar", tr("Events", "శాస్త్రీయ కార్యాలు"), data.total],
      ["sun", tr("Calculation", "గణన పద్ధతి"), tr("Drik · Lahiri", "దృక్ · లాహిరి")],
      ["shield", tr("Doshas checked", "దోష పరిశీలన"), tr("21 mahadoshas", "21 మహాదోషాలు")],
    ].map(function (s) {
      return '<div class="mc-stat"><span class="mc-stat__icon">' + Icon(s[0]) + '</span><div><small>' + esc(s[1]) + "</small><strong>" + esc(s[2]) + "</strong></div></div>";
    }).join("");

    var shown = 0;
    $("mcGrid").innerHTML = tabs.filter(function (t) { return active === "all" || t.id === active; }).map(function (t) {
      var list = eventsOf(t);
      if (t.id === "yogas") {
        if (query) return "";
      } else if (!list.length) return "";
      shown++;
      var full = open[t.id] || query, more = list.length - PREVIEW;
      var items = (full ? list : list.slice(0, PREVIEW)).map(function (r) {
        return '<li><a href="' + finderLink(t.id, r.id) + '">' + esc(title(r)) + "</a></li>";
      }).join("");
      var body = t.id === "yogas"
        ? '<p class="mc-card__text">' + tr("Amrita siddhi, sarvartha siddhi, guru pushya and the other special yogas, with your tarabala and chandrabala.",
                                            "అమృత సిద్ధి, సర్వార్థ సిద్ధి, గురు పుష్య మొదలైన విశేష యోగాలు, మీ తారాబలం, చంద్రబలంతో సహా.") + "</p>"
        : '<ul class="mc-card__list">' + items + "</ul>" +
          (!query && more > 0 ? '<button type="button" class="linkish mc-card__more" data-more="' + esc(t.id) + '">' +
            (full ? tr("Show fewer", "తక్కువ చూపించు") : tr("Show all " + list.length, "అన్నీ చూపించు (" + list.length + ")")) + "</button>" : "");
      var first = list[0];
      return '<article class="mc-card' + (t.id === "upanayana" ? " mc-card--feature" : "") + '">' +
        '<div class="mc-card__top"><span class="mc-card__icon">' + Icon(ICONS[t.id] || "calendar") + "</span>" +
          (t.count ? '<span class="mc-card__count">' + tr(t.count + " events", t.count + " కార్యాలు") + "</span>" : "") + "</div>" +
        "<h2>" + esc(tr(t.en, t.te)) + "</h2>" + body +
        '<a class="btn btn--primary mc-card__go" href="' + finderLink(t.id, first && first.id) + '">' + tr("Find a muhurta", "ముహూర్తం శోధించండి") + " →</a>" +
      "</article>";
    }).join("");
    $("mcNone").hidden = shown > 0;
    $("mcNone").textContent = tr("No event matches that search.", "ఆ శోధనకు సరిపోయే కార్యం లేదు.");
  }

  document.addEventListener("click", function (e) {
    var chip = e.target.closest("[data-tab]");
    if (chip) { active = chip.getAttribute("data-tab"); return render(); }
    var more = e.target.closest("[data-more]");
    if (more) { var id = more.getAttribute("data-more"); open[id] = !open[id]; render(); }
  });
  $("mcSearch").addEventListener("input", function () { query = this.value.trim(); render(); });

  async function load() {
    try {
      var res = await fetch(API_BASE + "/muhurta/catalog");
      var body = await res.json().catch(function () { return null; });
      if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: body }));
      var byId = {};
      (body.all_activities || []).forEach(function (r) { byId[r.id] = r; });
      var tabs = (body.tabs || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      data = { tabs: tabs, byId: byId, total: (body.all_activities || []).length };
      render();
    } catch (err) {
      $("mcGrid").innerHTML = "";
      $("mcMsg").hidden = false;
      $("mcMsg").textContent = tr("The list of events could not be loaded: ", "కార్యాల జాబితా రాలేదు: ") + err.message;
    }
  }
  window.onLangChange = render;
  load();
})();
