// ============================================================
// Gayathri Jyothirnidhe · All muhurtas (Stitch "desktop_catalog", 19 Nov 2026)
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
    $("mcCount").textContent = t("{tabs} categories · {total} events", { tabs: tabs.length, total: data.total });
    $("mcSearch").placeholder = t("Search events (marriage, griha pravesha, namakarana…)");
    $("mcChips").innerHTML = '<button type="button" class="mc-chip" data-tab="all" aria-pressed="' + (active === "all") + '">' + t("All") +
      ' <span>' + tabs.length + "</span></button>" + tabs.map(function (t) {
        return '<button type="button" class="mc-chip" data-tab="' + esc(t.id) + '" aria-pressed="' + (active === t.id) + '">' + esc(tr(t.en, t.te)) +
          (t.count ? " <span>" + t.count + "</span>" : "") + "</button>";
      }).join("");
    $("mcStats").innerHTML = [
      ["scroll", t("Categories"), tabs.length],
      ["calendar", t("Events"), data.total],
      ["sun", t("Calculation"), t("Drik · Lahiri")],
      ["shield", t("Doshas checked"), t("21 mahadoshas")],
    ].map(function (s) {
      return '<div class="mc-stat"><span class="mc-stat__icon">' + Icon(s[0]) + '</span><div><small>' + esc(s[1]) + "</small><strong>" + esc(s[2]) + "</strong></div></div>";
    }).join("");

    var shown = 0;
    $("mcGrid").innerHTML = tabs.filter(function (t) { return active === "all" || t.id === active; }).map(function (tv) {
      var list = eventsOf(tv);
      if (tv.id === "yogas") {
        if (query) return "";
      } else if (!list.length) return "";
      shown++;
      var full = open[tv.id] || query, more = list.length - PREVIEW;
      var items = (full ? list : list.slice(0, PREVIEW)).map(function (r) {
        return '<li><a href="' + finderLink(tv.id, r.id) + '">' + esc(title(r)) + "</a></li>";
      }).join("");
      var body = tv.id === "yogas"
        ? '<p class="mc-card__text">' + t("Amrita siddhi, sarvartha siddhi, guru pushya and the other special yogas, with your tarabala and chandrabala.") + "</p>"
        : '<ul class="mc-card__list">' + items + "</ul>" +
          (!query && more > 0 ? '<button type="button" class="linkish mc-card__more" data-more="' + esc(tv.id) + '">' +
            (full ? t("Show fewer") : t("Show all {list}", { list: list.length })) + "</button>" : "");
      var first = list[0];
      return '<article class="mc-card' + (tv.id === "upanayana" ? " mc-card--feature" : "") + '">' +
        '<div class="mc-card__top"><span class="mc-card__icon">' + Icon(ICONS[tv.id] || "calendar") + "</span>" +
          (tv.count ? '<span class="mc-card__count">' + t("{count} events", { count: tv.count }) + "</span>" : "") + "</div>" +
        "<h2>" + esc(tr(tv.en, tv.te)) + "</h2>" + body +
        '<a class="btn btn--primary mc-card__go" href="' + finderLink(tv.id, first && first.id) + '">' + t("Find a muhurta") + " →</a>" +
      "</article>";
    }).join("");
    $("mcNone").hidden = shown > 0;
    $("mcNone").textContent = t("No event matches that search.");
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
      $("mcMsg").textContent = t("The list of events could not be loaded: ") + err.message;
    }
  }
  window.onLangChange = render;
  load();
})();
