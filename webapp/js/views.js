// ============================================================
// Gayathri Jyothirnidhe · Views — composed UI components for the app page
// Rendered once on load by app.js → UI.mount('app', Views.layout())
// Every DOM id matches the previous static markup, so panel logic
// (panchang.js, pdf.js) works unchanged. The old samskara mode was retired (plan R4): use the Muhurta Finder.
// ============================================================

var Views = (function () {
  var h = UI.h, F = UI.field, S = UI.selectInput, B = UI.button, K = UI.kaalaRow, KS = UI.kaalaSection;

  // ---- Header + language toggle -------------------------------------------
  // The brand is in the site header now (13 Nov 2026), so the page keeps only its print button here.
  // Print / Save PDF follows Settings › Finder and sharing (plan D6; off by default): site-config.js shows it.
  var header =
    '<div class="no-print app-actions" data-share-kind="pdf" hidden>' +
    B({ id: "printSmartBtn", cls: "btn btn--gold", onclick: "exportSmartPdf()", icon: Icon("printer"), en: "Print / Save PDF", label: "Print / Save PDF" }) +
    "</div>";
  // The site header (menu, language switch, account) is in panchang-lookup.html, the same as every page.

  // ---- Panchang panel -------------------------------------------------------
  var RASIS12 = UI.selectInput("_noop", [{ value: "" }]).replace('<select id="_noop"></select>', "");
  var rasiOptions = (function () {
    var names = ["Mesha","Vrishabha","Mithuna","Karkataka","Simha","Kanya","Tula","Vrischika","Dhanus","Makara","Kumbha","Meena"];
    return names.map(function (n, i) { return { value: String(i + 1), label: (i + 1) + ". " + n }; });
  })();

  var panchangForm =
    '<div class="controls">' +
      F("regionSelect", "Region", '<select id="regionSelect"></select>', { minWidth: 200 }) +
      F("dateInput", "Date", '<input type="date" id="dateInput">', { minWidth: 150 }) +
      B({ id: "goButton", en: "Get Panchang", label: "Get Panchang", cls: "btn btn--primary btn--block" }) +
      '<div id="customPlaceField" class="custom-place">' +
        '<label class="field-label" for="customPlaceInput" data-i18n="Search Place (e.g. London, Kakinada)">Search Place</label>' +
        '<div class="place-row">' +
          '<input type="text" id="customPlaceInput" placeholder="Enter place name..." autocomplete="off">' +
          B({ id: "searchPlaceButton", cls: "btn btn--gold btn--sm", en: "Search & Go", label: "Search & Go" }) +
          UI.suggestionsBox("suggestionsList", 130) +
        "</div>" +
      "</div>" +
    "</div>" + UI.statusChip("status");

  // Day view (Vedic Sanctuary redesign, 13 Nov 2026). panchang.js fills every part from the API.
  var panchangResults =
    '<div id="results" class="pd" style="display:none;">' +
      '<section class="pd-hero" id="pdHero" aria-live="polite"></section>' +
      '<div class="pd-grid">' +
        '<div class="pd-col pd-col--left">' +
          '<section class="pd-card pd-angas" id="pdAngas"></section>' +
          '<section class="pd-card" id="pdLuminaries"></section>' +
        "</div>" +
        '<div class="pd-col pd-col--mid">' +
          '<section class="pd-card" id="pdTimes"></section>' +
          '<section class="pd-card" id="pdPanchaka"></section>' +
          '<section class="pd-card" id="pdChandrabalam"></section>' +
        "</div>" +
        '<div class="pd-col pd-col--right">' +
          '<section class="pd-card" id="pdLagnas"></section>' +
          '<section class="pd-card" id="pdDos"></section>' +
          '<section class="pd-card pd-shloka" id="pdShloka"></section>' +
        "</div>" +
      "</div>" +
      '<section class="pd-cta" id="pdCta"></section>' +
      '<details class="pd-more">' +
        '<summary data-i18n="More details: 5-fold day division, Abhijit check, all activities">More details: 5-fold day division, Abhijit check, all activities</summary>' +
        '<div id="vKalaVibhajanaSection"></div>' +
        KS("Abhijit Kala Muhurtham",
          '<div class="kaala-row kaala-row--borderless">' +
          '<span class="kname kname--gold" data-i18n="Auspicious Timing">Auspicious Timing</span>' +
          '<span class="ktime ktime--gold" id="vAbhijitKala">—</span></div>',
          "kaala-section--highlight") +
        '<div id="vPanchakaSection"></div>' +
        KS("Favorable Muhurtas", '<div id="vFavorableActivities" class="list-body"></div>') +
        KS("Activities to Avoid", '<div id="vAvoidActivities" class="list-body"></div>') +
      "</details>" +
    "</div>";

  // ---- Day / Month tabs (the place and date form above is shared) -----------
  var viewTabs =
    '<div class="pview-tabs tab-container" role="tablist" aria-label="Panchang view">' +
      '<button type="button" class="pview-tab active" id="tabDayBtn" role="tab" aria-selected="true" aria-controls="dayView" data-i18n="Day@@views">Day</button>' +
      '<button type="button" class="pview-tab" id="tabMonthBtn" role="tab" aria-selected="false" aria-controls="monthView" data-i18n="Month">Month</button>' +
    "</div>";

  var monthView =
    '<div id="monthView" role="tabpanel" aria-labelledby="tabMonthBtn" hidden>' +
      '<div class="month-head">' +
        '<button type="button" class="month-nav" id="monthPrev" aria-label="Previous month">‹</button>' +
        '<div class="month-head__title"><h2 id="monthTitle">—</h2><div class="month-head__sub" id="monthSub"></div></div>' +
        '<button type="button" class="month-nav" id="monthNext" aria-label="Next month">›</button>' +
      "</div>" +
      '<div class="month-cal" id="monthCal"></div>' +
      '<p class="month-hint" data-i18n="Tap a date to see its panchang. Tithi and nakshatra are the ones at sunrise.">Tap a date to see its panchang. Tithi and nakshatra are the ones at sunrise.</p>' +
      '<section id="monthDayDetail" class="month-detail" aria-live="polite" hidden></section>' +
    "</div>";

  var taskLauncher =
    '<section class="task-launcher" aria-label="Choose a task">' +
      '<p class="task-launcher__intro">Choose the task you want to complete.</p>' +
      '<div class="task-grid">' +
        '<a class="task-card" href="#tabPanchangContent"><span class="task-card__icon">' + Icon("calendar") + '</span><span class="task-card__title">Panchang for a date</span><span class="task-card__text">View daily timings and activities.</span></a>' +
        '<a class="task-card" href="muhurta-finder.html"><span class="task-card__icon">' + Icon("lamp") + '</span><span class="task-card__title">Find a ceremony Muhurta</span><span class="task-card__text">Every samskara is in the Muhurta Finder.</span></a>' +
        '<a class="task-card" href="muhurta-finder.html"><span class="task-card__icon">' + Icon("search") + '</span><span class="task-card__title">Scan multiple days</span><span class="task-card__text">Compare Muhurta results across a date range.</span></a>' +
      '</div>' +
    '</section>';

  // ---- Footer -----------------------------------------------------------------
  var footer =
    '<footer>Backend: <code id="apiBaseLabel"></code> — edit <code>API_BASE</code> in js/config.js if it is hosted elsewhere.</footer>';

  // ---- Layout -----------------------------------------------------------------
  // Two pages (13 Nov 2026), chosen by <body data-page>:
  //   "today": Today's Panchang, only today at the account's home place, no fields, live;
  //   "month": Monthly Panchang, the place and date fields, the calendar, and the full day view of a
  //            picked date below it ("Full day details").
  var layout = function (mode) {
    if (mode === "today") {
      return (
        '<div class="app-shell"><div class="wrap wrap--wide">' +
          '<header id="appHeader">' + header + "</header>" + UI.statusChip("status") +
          '<section id="tabPanchangContent"><div id="dayView">' + panchangResults + "</div></section>" +
        "</div></div>"
      );
    }
    return (
      '<div class="app-shell"><div class="wrap wrap--wide">' +
        '<h1 class="portal__title pm-title" data-text-key="month_title" data-i18n="Monthly Panchang">Monthly Panchang</h1>' +
        '<header id="appHeader">' + header + "</header>" +
        '<section id="tabPanchangContent">' + panchangForm +
          monthView +
          '<div id="dayView" hidden>' +
            '<div class="pm-dayhead no-print"><button type="button" class="btn btn--outline btn--sm" id="backToMonth" data-i18n="‹ Back to the calendar">‹ Back to the calendar</button></div>' +
            panchangResults +
          "</div>" +
        "</section>" +
        footer +
      "</div></div>"
    );
  };

  return { layout: layout, layoutRootId: "app" };
})();

window.Views = Views;
