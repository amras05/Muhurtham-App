// ============================================================
// Muhurtham App · Views — composed UI components for the app page
// Rendered once on load by app.js → UI.mount('app', Views.layout())
// Every DOM id matches the previous static markup, so panel logic
// (panchang.js, pdf.js) works unchanged. The old samskara mode was retired (plan R4): use the Muhurta Finder.
// ============================================================

var Views = (function () {
  var h = UI.h, F = UI.field, S = UI.selectInput, B = UI.button, K = UI.kaalaRow, KS = UI.kaalaSection;

  // ---- Header + language toggle -------------------------------------------
  var header =
    '<hgroup class="app-header">' +
    '<div class="eyebrow" data-en="Drik Panchangam & Muhurta Engine" data-te="దృక్ పంచాంగం & ముహూర్త నిర్ణయి">Drik Panchangam & Muhurta Engine</div>' +
    '<h1>పంచాంగం · ముహూర్తం</h1>' +
    '<p data-en="Drik Panchang (Lahiri Ayanamsa) & Namakarana Muhurta Finder" data-te="దృక్ పంచాంగం (లాహిరి అయనాంశ) — సిద్ధాంత ముహూర్త నిర్ణయి">Drik Panchang (Lahiri Ayanamsa) & Namakarana Muhurta Finder</p>' +
    "</hgroup>" +
    '<div class="no-print app-actions">' +
    B({ id: "printSmartBtn", cls: "btn btn--gold", onclick: "exportSmartPdf()", icon: "🖨️", en: "Print / Save PDF", te: "ప్రింట్ / PDF సేవ్", label: "Print / Save PDF" }) +
    '<div class="lang-toggle">' +
    '<button class="lang-btn active" id="langEn" onclick="setLang(\'en\')">English</button>' +
    '<button class="lang-btn" id="langTe" onclick="setLang(\'te\')">తెలుగు</button>' +
    "</div>" +
    "</div>";

  var shellNav =
    '<nav class="app-shell__nav" aria-label="Primary navigation">' +
      '<a class="app-shell__brand" href="panchang-lookup.html">ముహూర్తం</a>' +
      '<div class="app-shell__links">' +
        '<a class="app-shell__link" href="panchang-lookup.html" aria-current="page">Panchang</a>' +
        '<a class="app-shell__link" href="muhurta-finder.html">Muhurta Finder</a>' +
      '</div>' +
      '<div class="account-slot" id="accountSlot"></div>' +
    '</nav>';

  // ---- Panchang panel -------------------------------------------------------
  var RASIS12 = UI.selectInput("_noop", [{ value: "" }]).replace('<select id="_noop"></select>', "");
  var rasiOptions = (function () {
    var names = ["Mesha","Vrishabha","Mithuna","Karkataka","Simha","Kanya","Tula","Vrischika","Dhanus","Makara","Kumbha","Meena"];
    return names.map(function (n, i) { return { value: String(i + 1), label: (i + 1) + ". " + n }; });
  })();

  var panchangForm =
    '<div class="controls">' +
      F("regionSelect", "Region", "ప్రాంతం", '<select id="regionSelect"></select>', { minWidth: 200 }) +
      F("dateInput", "Date", "తేదీ", '<input type="date" id="dateInput">', { minWidth: 150 }) +
      B({ id: "goButton", en: "Get Panchang", te: "పంచాంగం చూడండి", label: "Get Panchang", cls: "btn btn--primary btn--block" }) +
      '<div id="customPlaceField" class="custom-place">' +
        '<label class="field-label" for="customPlaceInput" data-en="Search Place (e.g. London, Kakinada)" data-te="ప్రాంతం పేరు (ఉదా: లండన్, కాకినాడ)">Search Place</label>' +
        '<div class="place-row">' +
          '<input type="text" id="customPlaceInput" placeholder="Enter place name..." autocomplete="off">' +
          B({ id: "searchPlaceButton", cls: "btn btn--gold btn--sm", en: "Search & Go", te: "వెతకండి", label: "Search & Go" }) +
          UI.suggestionsBox("suggestionsList", 130) +
        "</div>" +
      "</div>" +
    "</div>" + UI.statusChip("status");

  var panchangResults =
    '<div id="results" style="display:none;">' +
      '<div class="samvatsara">' +
        '<div class="name" id="samvatsaraName">—</div>' +
        '<div class="sub" id="chandraMonth">—</div>' +
        '<span class="adhika" id="adhikaBadge" style="display:none;">Adhika Masa</span>' +
      "</div>" +
      '<div class="grid">' +
        UI.card('<span data-en="Vaara" data-te="వారం">Vaara</span>', '<div id="vVaara">—</div>') +
        UI.card('<span data-en="Tithi" data-te="తిథి">Tithi</span>', '<div class="small" id="vTithi">—</div><div class="small sub-time" id="vTithiEnd">—</div>') +
        UI.card('<span data-en="Nakshatra" data-te="నక్షత్రం">Nakshatra</span>', '<div class="small" id="vNakshatra">—</div><div class="small sub-time" id="vNakshatraEnd">—</div><div id="vNakshatraPadas" class="padas"></div>', "card--wide card--gold") +
        UI.card('<span data-en="Yoga" data-te="యోగం">Yoga</span>', '<div class="small" id="vYoga">—</div><div class="small sub-time" id="vYogaEnd">—</div>') +
        UI.card('<span data-en="Karana" data-te="కరణం">Karana</span>', '<div class="small" id="vKarana">—</div><div class="small sub-time" id="vKaranaEnd">—</div>') +
        UI.card('<span data-en="Lagna Rasi" data-te="లగ్న రాశి">Lagna Rasi</span>', '<div id="vLagna">—</div>') +
        UI.card('<span data-en="Sunrise" data-te="సూర్యోదయం">Sunrise</span>', '<div id="vSunrise">—</div>') +
        UI.card('<span data-en="Sunset" data-te="సూర్యాస్తమయం">Sunset</span>', '<div id="vSunset">—</div>') +
      "</div>" +
      KS("అశుభ సమయాలు", "Inauspicious Windows",
        K("రాహు కాలం", "Rahu Kalam", "vRahu") +
        K("యమగండం", "Yamagandam", "vYamagandam") +
        K("గుళిక కాలం", "Gulika Kalam", "vGulika") +
        K("దుర్ముహూర్తం", "Durmuhurtam", "vDurmuhurtam") +
        K("వర్జ్యం", "Varjyam", "vVarjyam")) +
      KS("శుభ సమయాలు", "Auspicious Windows",
        K("అభిజిత్ ముహూర్తం", "Abhijit Muhurta", "vAbhijit") +
        K("బ్రహ్మ ముహూర్తం", "Brahma Muhurta", "vBrahma") +
        K("గోధూళి ముహూర్తం", "Godhuli Muhurta", "vGodhuli") +
        K("అమృత కాలం", "Amrit Kalam", "vAmrit")) +
      KS("✨ అభిజిత్ కాల ముహూర్తం", "✨ Abhijit Kala Muhurtham",
        '<div class="kaala-row kaala-row--borderless">' +
        '<span class="kname kname--gold" data-en="Auspicious Timing" data-te="శుభ సమయము">Auspicious Timing</span>' +
        '<span class="ktime ktime--gold" id="vAbhijitKala">—</span></div>',
        "kaala-section--highlight") +
      '<div id="vPanchakaSection"></div>' +
      '<div id="vKalaVibhajanaSection"></div>' +
      '<div id="vLagnaScheduleSection"></div>' +
      KS("✨ విశేష యోగములు", "Special Muhurta Yogas", '<div id="vSpecialYogas" class="list-body"></div>') +
      KS("అనుకూలమైన ముహూర్తములు", "Favorable Muhurtas", '<div id="vFavorableActivities" class="list-body"></div>') +
      KS("నిషిద్ధ సమయాలు / పనులు", "Activities to Avoid", '<div id="vAvoidActivities" class="list-body"></div>') +
    "</div>";

  var taskLauncher =
    '<section class="task-launcher" aria-label="Choose a task">' +
      '<p class="task-launcher__intro">Choose the task you want to complete.</p>' +
      '<div class="task-grid">' +
        '<a class="task-card" href="#tabPanchangContent"><span class="task-card__icon">📅</span><span class="task-card__title">Panchang for a date</span><span class="task-card__text">View daily timings and activities.</span></a>' +
        '<a class="task-card" href="muhurta-finder.html"><span class="task-card__icon">🪔</span><span class="task-card__title">Find a ceremony Muhurta</span><span class="task-card__text">Every samskara is in the Muhurta Finder.</span></a>' +
        '<a class="task-card" href="muhurta-finder.html"><span class="task-card__icon">🔮</span><span class="task-card__title">Scan multiple days</span><span class="task-card__text">Compare Muhurta results across a date range.</span></a>' +
      '</div>' +
    '</section>';

  // ---- Footer -----------------------------------------------------------------
  var footer =
    '<footer>Backend: <code id="apiBaseLabel"></code> — edit <code>API_BASE</code> in js/config.js if it is hosted elsewhere.</footer>';

  // ---- Layout -----------------------------------------------------------------
  var layout = function (rootId) {
    return (
      '<div class="app-shell"><div class="wrap">' +
        shellNav +
        '<header id="appHeader">' + header + "</header>" +
        '<section id="tabPanchangContent">' + panchangForm + panchangResults + taskLauncher + "</section>" +
        footer +
      "</div></div>"
    );
  };

  return { layout: layout, layoutRootId: "app" };
})();

window.Views = Views;
