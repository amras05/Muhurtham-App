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
      ? '<span class="today__now today__now--bad">' + tr("Now: ", "ఇప్పుడు: ") + esc(tr(cur.name_en, cur.name_te)) + " " + esc(cur.start) + "–" + esc(cur.end) + "</span>"
      : '<span class="today__now today__now--ok">' + tr("Now: no bad period", "ఇప్పుడు: అశుభ కాలం లేదు") + "</span>";
    var good = d.next_good
      ? '<span>' + tr(d.next_good.now ? "Good now: " : "Next good window: ", d.next_good.now ? "ఇప్పుడు శుభం: " : "తదుపరి శుభ సమయం: ") +
        esc(tr(d.next_good.name_en, d.next_good.name_te)) + " " + esc(d.next_good.start) + "–" + esc(d.next_good.end) + "</span>"
      : "";
    var periods = d.periods.map(function (p) {
      return '<li class="' + (p.past ? "is-past" : "") + (cur && cur.start === p.start && cur.kind === p.kind ? " is-now" : "") + '">' +
        "<span>" + esc(tr(p.name_en, p.name_te)) + "</span><span>" + esc(p.start) + "–" + esc(p.end) + "</span></li>";
    }).join("");
    var yogas = (d.special_yogas || []).map(function (y) {
      return '<span class="today__yoga today__yoga--' + (y.type === "bad" ? "bad" : "good") + '">' + esc(tr(y.name_en, y.name_te)) + "</span>";
    }).join("");
    var limb = function (en, te, x, extra) {
      return '<div class="today__limb"><span class="today__label">' + tr(en, te) + "</span><strong>" + esc(x.name) + (extra || "") +
        '</strong><small>' + tr("till ", "") + esc(x.end) + tr("", " వరకు") + "</small></div>";
    };
    box.innerHTML =
      '<div class="today__head">' +
        '<div><div class="today__date">' + esc(dayName(d.weekday)) + ", " + esc(dateText) + "</div>" +
        '<div class="today__masa">' + esc(tr((m.samvatsara_en || "") + " · " + (m.name_en || "") + (m.adhika ? " (adhika)" : "") + " · " + (m.paksha_en || ""),
                                              (m.samvatsara_te || "") + " · " + (m.name_te || "") + (m.adhika ? " (అధిక)" : "") + " · " + (m.paksha_te || ""))) + "</div></div>" +
        '<div class="today__place">' + esc(d.place.name) + ' · <a href="account.html#home">' + tr("Change", "మార్చండి") + "</a></div>" +
      "</div>" +
      '<div class="today__status">' + nowLine + good + "</div>" +
      '<div class="today__limbs">' +
        limb("Tithi", "తిథి", d.tithi) +
        limb("Nakshatra", "నక్షత్రం", { name: tr(d.nakshatra.name, nakTe(d.nakshatra.name)), end: d.nakshatra.end }, " · " + tr("pada ", "") + d.nakshatra.pada + tr("", " పాదం")) +
        limb("Yoga", "యోగం", d.yoga) + limb("Karana", "కరణం", d.karana) +
        '<div class="today__limb"><span class="today__label">' + tr("Sun", "సూర్యుడు") + "</span><strong>↑ " + esc(d.sunrise) + " · ↓ " + esc(d.sunset) + "</strong><small>" + tr("sunrise · sunset", "ఉదయం · అస్తమయం") + "</small></div>" +
      "</div>" +
      '<div class="today__avoid"><span class="today__label">' + tr("Avoid today", "ఈ రోజు నివారించవలసినవి") + "</span><ul>" + periods + "</ul></div>" +
      (yogas ? '<div class="today__yogas">' + yogas + "</div>" : "") +
      '<div class="today__foot"><span>' + tr("Updated ", "నవీకరణ ") + esc(d.now) + '</span><a href="panchang-lookup.html">' + tr("Full panchang →", "పూర్తి పంచాంగం →") + "</a></div>";
  }

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
      if (box) box.innerHTML = '<p class="today__error">' + esc(tr("Couldn't load today's panchang: ", "నేటి పంచాంగం లోడ్ కాలేదు: ") + e.message) + "</p>";
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
