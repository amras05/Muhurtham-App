// ============================================================
// Muhurtham App · "Today" panchang card (every role's home page)
// Renders /dashboard/today into an element: Today.mount("todayCard").
// Refreshes every minute so "Now" stays true; reloads data when the date changes.
// ============================================================
window.Today = (function () {
  var data = null, mountId = null, lastDate = null;

  function tr(en, te) { return (typeof currentLang !== "undefined" && currentLang === "te") ? te : en; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function nakTe(n) { return (typeof NAKSHATRA_NAMES_TE !== "undefined" && NAKSHATRA_NAMES_TE[n]) || n; }
  function dayName(w) { return (typeof VAARA_NAMES !== "undefined" && VAARA_NAMES[currentLang] && VAARA_NAMES[currentLang][w]) || w; }

  function render() {
    var box = document.getElementById(mountId);
    if (!box || !data) return;
    var d = data, m = d.masa || {};
    var dateText = new Date(d.date + "T12:00:00").toLocaleDateString(currentLang === "te" ? "te-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric" });
    var cur = d.current_period;
    var nowLine = cur
      ? '<span class="today__now today__now--bad">' + t("Now: ") + esc(tr(cur.name_en, cur.name_te)) + " " + esc(cur.start) + "–" + esc(cur.end) + "</span>"
      : '<span class="today__now today__now--ok">' + t("Now: no bad period") + "</span>";
    var good = d.next_good
      ? '<span>' + t(d.next_good.now ? "Good now:" : "Next good window:") + " " +
        esc(tr(d.next_good.name_en, d.next_good.name_te)) + " " + esc(d.next_good.start) + "–" + esc(d.next_good.end) + "</span>"
      : "";
    var periods = d.periods.map(function (p) {
      return '<li class="' + (p.past ? "is-past" : "") + (cur && cur.start === p.start && cur.kind === p.kind ? " is-now" : "") + '">' +
        "<span>" + esc(tr(p.name_en, p.name_te)) + "</span><span>" + esc(p.start) + "–" + esc(p.end) + "</span></li>";
    }).join("");
    var yogas = (d.special_yogas || []).map(function (y) {
      return '<span class="today__yoga today__yoga--' + (y.type === "bad" ? "bad" : "good") + '">' + esc(tr(y.name_en, y.name_te)) + "</span>";
    }).join("");
    var limb = function (en, x, extra) {
      return '<div class="today__limb"><span class="today__label">' + t(en) + "</span><strong>" + esc(x.name) + (extra || "") +
        '</strong><small>' + esc(t("till {time}", { time: x.end })) + "</small></div>";
    };
    box.innerHTML =
      '<div class="today__head">' +
        '<div><div class="today__date">' + esc(dayName(d.weekday)) + ", " + esc(dateText) + "</div>" +
        '<div class="today__masa">' + esc((tr(m.samvatsara_en, m.samvatsara_te) || "") + " · " + (tr(m.name_en, m.name_te) || "") + (m.adhika ? " " + t("(adhika)") : "") + " · " + (tr(m.paksha_en, m.paksha_te) || "")) + "</div></div>" +
        '<div class="today__place">' + esc(d.place.name) + ' · <a href="account.html#home">' + t("Change") + "</a></div>" +
      "</div>" +
      '<div class="today__status">' + nowLine + good + "</div>" +
      '<div class="today__limbs">' +
        limb("Tithi@@today", d.tithi) +
        limb("Nakshatra@@today", { name: tr(d.nakshatra.name, nakTe(d.nakshatra.name)), end: d.nakshatra.end }, " · " + t("pada {n}", { n: d.nakshatra.pada })) +
        limb("Yoga", d.yoga) + limb("Karana", d.karana) +
        '<div class="today__limb"><span class="today__label">' + t("Sun") + "</span><strong>↑ " + esc(d.sunrise) + " · ↓ " + esc(d.sunset) + "</strong><small>" + t("sunrise · sunset") + "</small></div>" +
      "</div>" +
      '<div class="today__avoid"><span class="today__label">' + t("Avoid today") + "</span><ul>" + periods + "</ul></div>" +
      (yogas ? '<div class="today__yogas">' + yogas + "</div>" : "") +
      (canShare() ? panchangShareBar() : "") +
      '<div class="today__foot"><span>' + t("Updated ") + esc(d.now) + '</span><a href="panchang-lookup.html">' + t("Full panchang →") + "</a></div>";
    if (canShare()) {
      // Shared copies use today's panchang only (no live "Now" line or struck-out past periods).
      bindPanchangShare(box, {
        getSections: function () { return panchangTodaySections(data); },
        date: d.date, place: d.place.name,
      });
    }
  }

  // The Share row needs js/pdf-download.js and js/panchang-share.js on the page.
  function canShare() { return typeof bindPanchangShare === "function" && typeof PdfDownload !== "undefined"; }

  async function load() {
    var box = document.getElementById(mountId);
    try {
      var res = await fetch(API_BASE + "/dashboard/today");
      var body = await res.json().catch(function () { return null; });
      if (!res.ok) throw new Error((body && body.detail) || ("HTTP " + res.status));
      data = body;
      lastDate = data.date;
      render();
    } catch (e) {
      if (box) box.innerHTML = '<p class="today__error">' + esc(t("Couldn't load today's panchang: ") + e.message) + "</p>";
    }
  }

  function mount(id) {
    mountId = id;
    load();
    // Every minute: reload (cheap) so "Now", past periods and the date roll over by themselves.
    setInterval(load, 60000);
  }

  return { mount: mount, render: render, reload: load, data: function () { return data; } };
})();
