// ============================================================
// Muhurtham App · Views — composed UI components for the app page
// Rendered once on load by app.js → UI.mount('app', Views.layout())
// Every DOM id matches the previous static markup, so panel logic
// (panchang.js, samskaras.js, pdf.js) works unchanged.
// ============================================================

var Views = (function () {
  var h = UI.h, F = UI.field, S = UI.selectInput, B = UI.button, K = UI.kaalaRow, KS = UI.kaalaSection;

  // ---- Samskara catalog taxonomy (5 life stages, 17 ceremonies) -------------
  var SAMSKARA_GROUPS = [
    {
      titleEn: "Pre-natal & Pregnancy",
      titleTe: "గర్భ సంస్కారములు",
      icon: "🤰",
      items: [
        { id: "garbhadhana", icon: "🤰", en: "Garbhadhana", te: "గర్భాదానం", tag: "Conception" },
        { id: "pumsavana", icon: "🌿", en: "Pumsavana", te: "పుంసవనం", tag: "3rd Month" },
        { id: "seemantha", icon: "🪔", en: "Seemantha", te: "సీమంతం", tag: "4, 6, 8 Months" },
      ]
    },
    {
      titleEn: "Infancy & Childhood",
      titleTe: "బాల్య సంస్కారములు",
      icon: "👶",
      items: [
        { id: "jatakarma", icon: "🌟", en: "Jatakarma", te: "జాతకర్మ", tag: "At Birth / 10th Day" },
        { id: "namakarana", icon: "👶", en: "Namakarana", te: "నామకరణం", tag: "11, 12, 16 Days" },
        { id: "annaprashana", icon: "🥣", en: "Annaprashana", te: "అన్నప్రాశన", tag: "First Food (5-10 mo)" },
        { id: "choodakarana", icon: "✂️", en: "Choodakarana", te: "చూడాకర్మ", tag: "Tonsure" },
        { id: "karnavedha", icon: "👂", en: "Karnavedha", te: "కర్ణవేధ", tag: "Ear Piercing" },
      ]
    },
    {
      titleEn: "Education & Initiation",
      titleTe: "విద్యా & దీక్షా సంస్కారములు",
      icon: "✍️",
      items: [
        { id: "aksharabhyasam", icon: "✍️", en: "Aksharabhyasam", te: "అక్షరాభ్యాసం", tag: "5th Year" },
        { id: "upanayana", icon: "📿", en: "Upanayana", te: "ఉపనయనం", tag: "Sacred Thread (8-12 yr)" },
        { id: "samavartana", icon: "🎓", en: "Samavartana", te: "సమావర్తనం", tag: "Convocation" },
        { id: "keshanta_godana", icon: "💈", en: "Keshanta", te: "కేశాంత / గోదానం", tag: "16th Year" },
      ]
    },
    {
      titleEn: "Veda Vratas (Brahmacharya)",
      titleTe: "చతుర్వేద వ్రతములు",
      icon: "🔥",
      items: [
        { id: "prajapatya_vrata", icon: "🔥", en: "Prajapatya Vrata", te: "ప్రాజాపత్య వ్రతం", tag: "1st Year Vrata" },
        { id: "saumya_vrata", icon: "🌙", en: "Saumya Vrata", te: "సౌమ్య వ్రతం", tag: "2nd Year Vrata" },
        { id: "agneya_vrata", icon: "🔥", en: "Agneya Vrata", te: "ఆగ్నేయ వ్రతం", tag: "3rd Year Vrata" },
        { id: "vaishvadeva_vrata", icon: "🙏", en: "Vaishvadeva Vrata", te: "వైశ్వదేవ వ్రతం", tag: "4th Year Vrata" },
      ]
    },
    {
      titleEn: "Marriage & Grihastha",
      titleTe: "గృహస్థాశ్రమం",
      icon: "💍",
      items: [
        { id: "vivaha", icon: "💍", en: "Vivaha", te: "వివాహం", tag: "Sacred Union" },
      ]
    }
  ];

  function camel(id) {
    return id.split("_").map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join("");
  }

  // Primary mode switcher: Panchang vs Samskara
  var modeSwitcher =
    '<div class="mode-switcher" id="mainTabContainer" role="tablist">' +
      '<button type="button" class="mode-tab active" id="tabPanchangBtn" onclick="switchTab(\'panchang\')" role="tab" aria-selected="true">' +
        '<span class="mode-tab__icon">📅</span>' +
        '<span class="mode-tab__text">' +
          '<strong data-en="Daily Panchangam" data-te="దిన పంచాంగము">Daily Panchangam</strong>' +
          '<small data-en="Drik Siddhanta & Auspicious Timings" data-te="దృక్ సిద్ధాంత తిథి వార నక్షత్రములు">Drik Siddhanta & Auspicious Timings</small>' +
        '</span>' +
      '</button>' +
      '<button type="button" class="mode-tab" id="tabSamskarasModeBtn" onclick="switchTab(window.currentActiveSamskara || \'namakarana\')" role="tab" aria-selected="false">' +
        '<span class="mode-tab__icon">🪔</span>' +
        '<span class="mode-tab__text">' +
          '<strong data-en="17 Vedic Samskaras" data-te="షోడశ సంస్కారములు">17 Vedic Samskaras</strong>' +
          '<small data-en="Classical Ceremony Muhurta Engine" data-te="శాస్త్రీయ సంస్కార ముహూర్త నిర్ణయి">Classical Ceremony Muhurta Engine</small>' +
        '</span>' +
      '</button>' +
    '</div>';

  // Categorized Samskara Catalog
  var samskaraCatalog = (function () {
    var groupsHtml = SAMSKARA_GROUPS.map(function (g) {
      var cards = g.items.map(function (t) {
        return (
          '<button type="button" class="samskara-choice' + (t.id === 'namakarana' ? ' active' : '') + '" ' +
            'id="tab' + camel(t.id) + 'Btn" ' +
            'data-samskara="' + t.id + '" ' +
            'onclick="switchTab(\'' + t.id + '\')">' +
            '<div class="samskara-choice__top">' +
              '<span class="samskara-choice__icon">' + t.icon + '</span>' +
              '<span class="samskara-choice__badge">' + t.tag + '</span>' +
            '</div>' +
            '<div>' +
              '<div class="samskara-choice__name" data-en="' + t.en + '" data-te="' + t.te + '">' + t.en + '</div>' +
              '<div class="samskara-choice__te">' + t.te + '</div>' +
            '</div>' +
          '</button>'
        );
      }).join("");

      return (
        '<div class="samskara-group">' +
          '<div class="samskara-group__heading">' +
            '<span class="samskara-group__heading-icon">' + g.icon + '</span>' +
            '<span data-en="' + g.titleEn + '" data-te="' + g.titleTe + '">' + g.titleEn + '</span>' +
          '</div>' +
          '<div class="samskara-card-grid">' + cards + '</div>' +
        '</div>'
      );
    }).join("");

    return (
      '<section class="samskara-catalog" aria-label="Samskara selection catalog">' +
        '<div class="samskara-catalog__header">' +
          '<div class="samskara-catalog__title" data-en="Choose Vedic Samskara (17 Classical Ceremonies)" data-te="సంస్కార ఎంపిక (17 శాస్త్రీయ సంస్కారములు)">Choose Vedic Samskara (17 Classical Ceremonies)</div>' +
        '</div>' +
        '<div class="samskara-groups">' + groupsHtml + '</div>' +
      '</section>'
    );
  })();

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
        '<a class="app-shell__link" href="panchang-lookup.html#namakarana">Samskaras</a>' +
        '<a class="app-shell__link" href="muhurta-finder.html">Muhurta Finder</a>' +
      '</div>' +
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
      '<p class="task-launcher__intro">Choose the task you want to complete. Your existing Panchang, Samskara, and Muhurta tools remain available.</p>' +
      '<div class="task-grid">' +
        '<button type="button" class="task-card" onclick="switchTab(\'panchang\')"><span class="task-card__icon">📅</span><span class="task-card__title">Panchang for a date</span><span class="task-card__text">View daily timings and activities.</span></button>' +
        '<button type="button" class="task-card" onclick="switchTab(\'namakarana\')"><span class="task-card__icon">🪔</span><span class="task-card__title">Find a ceremony Muhurta</span><span class="task-card__text">Choose a Samskara, then enter its details.</span></button>' +
        '<a class="task-card" href="muhurta-finder.html"><span class="task-card__icon">🔮</span><span class="task-card__title">Scan multiple days</span><span class="task-card__text">Compare Muhurta results across a date range.</span></a>' +
      '</div>' +
    '</section>';

  // ---- Samskara panel (shared by all 17 samskaras) --------------------------
  var rasiSelect = (function () {
    var opts = '<option value="">-- Select Rasi --</option>' + rasiOptions.map(function (o) { return "<option value=\"" + o.value + "\">" + o.value + ". " + o.label.replace(/^\d+\.\s*/, "") + "</option>"; }).join("");
    return '<select id="husbandMoonRasiSelect">' + opts + "</select>";
  })();
  var rituLagnaSelect = (function () {
    var opts = '<option value="">-- None / Unknown --</option>' + rasiOptions.map(function (o) { return "<option value=\"" + o.value + "\">" + o.value + ". " + o.label.replace(/^\d+\.\s*/, "") + "</option>"; }).join("");
    return '<select id="brideRituLagnaSelect">' + opts + "</select>";
  })();

  var samskaraBanner =
    '<div id="samskaraRuleBanner" class="card samskara-banner">' +
      '<div class="samskara-banner__top">' +
        '<div class="samskara-banner__id">' +
          '<span id="samskaraBannerIcon" class="samskara-banner__icon">👶</span>' +
          "<div>" +
            '<h3 id="samskaraBannerTitle">Namakarana Muhurtham</h3>' +
            '<span id="samskaraPageBadge" class="badge badge--maroon">Classical Vedic Samskara</span>' +
          "</div>" +
        "</div>" +
        '<div class="pill pill--gold">✨ Gayathri Jyothirnidhe Classical Guidelines</div>' +
      "</div>" +
      '<p id="samskaraBannerRules" class="samskara-banner__rules">Loading rules...</p>' +
    "</div>";

  var samskaraForm =
    samskaraBanner +
    '<div class="controls">' +
      '<div class="field field--dob">' +
        '<label id="birthDateLabel" for="birthDateInput">Date of Birth</label>' +
        '<input type="date" id="birthDateInput"></div>' +
      '<div class="field field--tob">' +
        '<label id="birthTimeLabel" for="birthTimeInput">Time of Birth</label>' +
        '<input type="time" id="birthTimeInput" value="12:00"></div>' +
      F("birthRegionSelect", "Place of Birth / Reference", "ప్రాంతము", '<select id="birthRegionSelect"></select>', { minWidth: 180 }) +
      '<div id="fieldChildGender" class="field field--child-gender" style="display:none;">' +
        '<label for="childGenderSelect" data-en="Child Gender" data-te="శిశువు లింగము">Child Gender</label>' +
        S("childGenderSelect", [
          { value: "male",   en: "Boy", te: "మగ శిశువు", label: "Boy" },
          { value: "female", en: "Girl", te: "ఆడ శిశువు", label: "Girl" },
        ]) + "</div>" +
      '<div id="fieldCeremonyType" class="field field--ceremony-type" style="display:none;">' +
        '<label for="ceremonyTypeSelect" data-en="Ceremony Type" data-te="వేడుక రకము">Ceremony Type</label>' +
        S("ceremonyTypeSelect", [
          { value: "seemantha", en: "Seemantha (4, 6, 8 Months)", te: "సీమంతము (4, 6, 8 మాసములు)", label: "Seemantha (4, 6, 8 Months)" },
          { value: "bangles",   en: "Bangles / Valaikappu (5, 7 Months)", te: "గాజుల ఉత్సవము (5, 7 మాసములు)", label: "Bangles / Valaikappu (5, 7 Months)" },
        ]) + "</div>" +
      '<div id="fieldAgeMode" class="field field--age-mode" style="display:none;">' +
        '<label for="ageModeSelect" data-en="Age Calculation" data-te="వయస్సు గణన">Age Calculation</label>' +
        S("ageModeSelect", [
          { value: "months", en: "Infant Months (Boys: 2,4,6 / Girls: 3,5,7)", te: "శిశు మాసములు (మగ: 2,4,6 / ఆడ: 3,5,7)", label: "Infant Months" },
          { value: "years",  en: "Childhood Years (3rd or 5th Year)", te: "బాల్య సంవత్సరములు (3 లేదా 5వ ఏట)", label: "Childhood Years (3rd or 5th Year)" },
        ]) + "</div>" +
      '<div id="fieldTimingMode" class="field field--timing-mode" style="display:none;">' +
        '<label for="timingModeSelect" data-en="Karnavedha Timing" data-te="కర్ణవేధ సమయం">Karnavedha Timing</label>' +
        S("timingModeSelect", [
          { value: "early",  en: "Early Days (12th or 16th Day)", te: "ప్రారంభ దినములు (12 లేదా 16వ రోజు)", label: "Early Days (12th / 16th Day)" },
          { value: "months", en: "Infant Months (6th, 7th, or 8th Month)", te: "శిశు మాసములు (6, 7 లేదా 8వ నెల)", label: "Infant Months (6th, 7th, 8th Month)" },
        ]) + "</div>" +
      '<div id="fieldVarna" class="field field--varna" style="display:none;">' +
        '<label for="varnaSelect" data-en="Tradition / Prescribed Year" data-te="వర్ణము / నియమిత సంవత్సరము">Tradition / Prescribed Year</label>' +
        S("varnaSelect", [
          { value: "brahmin",   en: "Brahmin (8th Year / గర్భాష్టమం)", te: "బ్రాహ్మణ (8వ ఏట / గర్భాష్టమం)", label: "Brahmin (8th Year / గర్భాష్టమం)" },
          { value: "kshatriya", en: "Kshatriya (11th Year)", te: "క్షత్రియ (11వ ఏట)", label: "Kshatriya (11th Year)" },
          { value: "vaishya",   en: "Vaishya (12th Year)", te: "వైశ్య (12వ ఏట)", label: "Vaishya (12th Year)" },
        ]) + "</div>" +
      '<div id="fieldFatherNak" class="field field--father-nak" style="display:none;">' +
        '<label for="fatherNakSelect" data-en="Father Janma Nakshatra — Tarabala Check" data-te="తండ్రి జన్మ నక్షత్రము — తారాబల పరీక్ష">Father Janma Nakshatra</label>' +
        '<select id="fatherNakSelect"><option value="">-- Not known / optional --</option></select>' + "</div>" +
      '<div id="fieldMotherNak" class="field field--mother-nak" style="display:none;">' +
        '<label for="motherNakSelect" data-en="Mother Janma Nakshatra — Tarabala Check" data-te="తల్లి జన్మ నక్షత్రము — తారాబల పరీక్ష">Mother Janma Nakshatra</label>' +
        '<select id="motherNakSelect"><option value="">-- Not known / optional --</option></select>' + "</div>" +
      '<div id="fieldGuruNak" class="field field--guru-nak" style="display:none;">' +
        '<label for="guruNakSelect" data-en="Guru (Acharya) Janma Nakshatra — Tarabala Check" data-te="గురువుగారి జన్మ నక్షత్రము — తారాబల పరీక్ష">Guru (Acharya) Janma Nakshatra</label>' +
        '<select id="guruNakSelect"><option value="">-- Not known / optional --</option></select>' + "</div>" +
      '<div id="fieldStudyYears" class="field field--study-years" style="display:none;">' +
        '<label for="studyYearsInput" data-en="Target Year (from birth)" data-te="లక్ష్య సంవత్సరము (జన్మము నుండి)">Target Year (from birth)</label>' +
        '<input type="number" id="studyYearsInput" min="1" max="40" placeholder="e.g. 8">' + "</div>" +
      '<div id="fieldHusbandDetails" class="custom-place">' +
        '<div class="place-row place-row--wrap">' +
          F("husbandMoonRasiSelect", "Husband Moon Rasi", "భర్త జన్మ రాశి", rasiSelect, { minWidth: 140 }) +
          F("husbandNakSelect", "Husband Janma Nakshatra", "భర్త జన్మ నక్షత్రం", '<select id="husbandNakSelect"><option value="">-- Select Nakshatra --</option></select>', { minWidth: 160 }) +
          F("brideRituLagnaSelect", "Bride Ritu Lagna (Optional)", "వధువు ఋతు లగ్నం (ఐచ్ఛికం)", rituLagnaSelect, { minWidth: 140 }) +
        "</div>" +
      "</div>" +
      B({ id: "findMuhurtaButton", en: "Find Best Muhurtas", te: "ముహూర్తాలు లెక్కించండి", label: "Find Best Muhurtas", cls: "btn btn--primary btn--block" }) +
      '<div id="birthCustomPlaceField" class="custom-place">' +
        '<label class="field-label" for="birthCustomPlaceInput" data-en="Search Place (e.g. London, Kakinada)" data-te="ప్రాంతం పేరు (ఉదా: లండన్, కాకినాడ)">Search Place</label>' +
        '<div class="place-row">' +
          '<input type="text" id="birthCustomPlaceInput" placeholder="Enter place name..." autocomplete="off">' +
          B({ id: "birthSearchPlaceButton", cls: "btn btn--gold btn--sm", en: "Search & Go", te: "వెతకండి", label: "Search & Go" }) +
          UI.suggestionsBox("birthSuggestionsList", 130) +
        "</div>" +
      "</div>" +
    "</div>" + UI.statusChip("namakaranaStatus");

  var samskaraResults =
    '<div id="namakaranaResults" style="display:none;">' +
      '<div class="card card--gold">' +
        '<div class="label" data-en="Birth / Reference Details & Janma Nakshatra" data-te="జన్మ / రిఫరెన్స్ వివరాలు & నక్షత్రం">Birth / Reference Details & Janma Nakshatra</div>' +
        '<div class="value samskara-birth-star" id="nbirthStar">—</div>' +
        '<div class="value small samskara-birth-details" id="nbirthDetails">—</div>' +
      "</div>" +
      '<div class="card card--maroon">' +
        '<div class="label samskara-chart-label" data-en="Reference (D1) Chart" data-te="జన్మ / రిఫరెన్స్ (D1) చక్రం">Reference (D1) Chart</div>' +
        '<div id="d1ChartContainer"></div>' +
      "</div>" +
      '<div class="kaala-section">' +
        '<div class="kaala-title kaala-title--split">' +
          '<span id="samskaraResultsHeaderTitle" data-en="Auspicious Muhurtas" data-te="శుభ ముహూర్తములు">Auspicious Muhurtas</span>' +
          B({ id: "printCandidatesBtn", cls: "btn btn--maroon btn--sm no-print", onclick: "exportSamskaraCandidatesPdf()", icon: "🖨️", en: "Print PDF", te: "ప్రింట్ PDF", label: "Print PDF" }) +
        "</div>" +
        '<div id="namakaranaList" class="list-body"></div>' +
      "</div>" +
    "</div>";

  // ---- Modal ----------------------------------------------------------------
  var modal =
    '<div id="muhurtaModal" class="modal-overlay" style="display:none;" onclick="if(event.target === this) closeMuhurtaModal()">' +
      '<div class="modal-content">' +
        '<div class="modal-header">' +
          '<div id="modalTitle" class="modal-title"></div>' +
          '<div class="modal-header__actions">' +
            '<button class="btn btn--ghost no-print" onclick="exportCandidateDetailPdf()">🖨️ <span data-en="Print PDF" data-te="ప్రింట్ PDF">Print PDF</span></button>' +
            '<button class="modal-close no-print" onclick="closeMuhurtaModal()">&times;</button>' +
          "</div>" +
        "</div>" +
        '<div class="modal-body" id="modalBody"></div>' +
      "</div>" +
    "</div>";

  // ---- Footer -----------------------------------------------------------------
  var footer =
    '<footer>Backend: <code id="apiBaseLabel"></code> — edit <code>API_BASE</code> in js/config.js if it is hosted elsewhere.</footer>';

  // ---- Layout -----------------------------------------------------------------
  var layout = function (rootId) {
    return (
      '<div class="app-shell"><div class="wrap">' +
        shellNav +
        '<header id="appHeader">' + header + "</header>" +
        modeSwitcher +
        '<section id="tabPanchangContent">' + panchangForm + panchangResults + taskLauncher + "</section>" +
        '<section id="tabNamakaranaContent" style="display:none;">' + samskaraCatalog + samskaraForm + samskaraResults + "</section>" +
        footer +
      "</div></div>" +
      modal
    );
  };

  return { layout: layout, layoutRootId: "app" };
})();

window.Views = Views;
