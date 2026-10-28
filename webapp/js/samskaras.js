// ============================================================
// Muhurtham App · component: 16 Shodasa Samskaras
// (config, tabs, muhurta search, modal, results rendering)
// ============================================================

// ---- Classical Vedic Samskaras Configuration ----
const SAMSKARAS_CONFIG = {
  garbhadhana: {
    id: "garbhadhana",
    name_en: "Garbhadhana Muhurtham",
    name_te: "గర్భాదాన ముహూర్తము",
    icon: "🤰",
    date_label_en: "LMP / Menses Reference Date",
    date_label_te: "ఋతు ప్రథమ దినము / రిఫరెన్స్ తేదీ",
    time_label_en: "Reference Time",
    time_label_te: "సమయం",
    rules_en: "Nights 4 to 16 from menses (Even nights for male child, Odd nights for female child). Nights 11 & 13 strictly forbidden. Avoid Amavasya, Ashtami. Avoid 7th star from Janma (Vipat). Muhurta Lagna must not be 6th or 8th from Bride Ritu Lagna. Ashtama Shuddhi mandatory.",
    rules_te: "ఋతుకాలము నుండి 4వ రోజు నుండి 16వ రోజు వరకు (బేసి రాత్రులు కన్యార్థం, సరి రాత్రులు పుత్రార్థం). 11వ, 13వ రాత్రులు నిషిద్ధం. అమావాస్య, అష్టమి నిషిద్ధం. జన్మ నక్షత్రం నుండి 7వ నక్షత్రం (విపత్) నిషిద్ధం. వరుని జన్మ రాశికి 6, 8, 12 రాశులు నిషిద్ధం. అష్టమ శుద్ధి తప్పనిసరి.",
    fields: ["husband_details"]
  },
  pumsavana: {
    id: "pumsavana",
    name_en: "Pumsavana Muhurtham",
    name_te: "పుంసవన ముహూర్తము",
    icon: "🌿",
    date_label_en: "Conception / LMP Date",
    date_label_te: "గర్భధారణ / LMP తేదీ",
    time_label_en: "Reference Time",
    time_label_te: "సమయం",
    rules_en: "Performed strictly in 3rd month of pregnancy. Pushya, Shravana, Punarvasu, Hasta, Moola are auspicious. Sunday, Tuesday, Thursday favorable. Avoid Amavasya. Strictly daytime only. Ashtama Shuddhi mandatory.",
    rules_te: "గర్భధారణ జరిగిన 3వ మాసంలో చేయవలెను. పుష్య, శ్రవణ, పునర్వసు, హస్త, మూల నక్షత్రములు ప్రశస్తం. రవి, కుజ, గురు వారములు శ్రేష్ఠం. అమావాస్య నిషిద్ధం. పగటి వేళ మాత్రమే చేయవలెను. అష్టమ శుద్ధి తప్పనిసరి.",
    fields: []
  },
  seemantha: {
    id: "seemantha",
    name_en: "Seemantha Muhurtham",
    name_te: "సీమంత ముహూర్తము",
    icon: "🪔",
    date_label_en: "Conception / LMP Date",
    date_label_te: "గర్భధారణ / LMP తేదీ",
    time_label_en: "Reference Time",
    time_label_te: "సమయం",
    rules_en: "Seemantha in 4th, 6th, or 8th pregnancy month; Bangle ceremony in 5th or 7th month. Rohini, Mrigashira, Punarvasu, Pushya, Uttara, Hasta, Chitra, Anuradha, Moola, Uttaras, Revati favorable. Navama Shuddhi (9th house vacant) is mandatory. Ashtama Shuddhi and Chandrabalam required.",
    rules_te: "సీమంతము 4, 6, 8వ మాసములలో లేదా గాజుల ఉత్సవము 5, 7వ మాసములలో చేయవలెను. రోహిణి, మృగశిర, పునర్వసు, పుష్య, ఉత్తరత్రయ, హస్త, చిత్త, అనూరాధ, మూల, రేవతి శుభప్రదం. నవమ శుద్ధి (ముహూర్త లగ్నమునకు 9వ ఇల్లు ఖాళీగా ఉండవలెను) తప్పనిసరి. అష్టమ శుద్ధి, చంద్రబలం తప్పనిసరి.",
    fields: ["ceremony_type"]
  },
  jatakarma: {
    id: "jatakarma",
    name_en: "Jatakarma Muhurtham",
    name_te: "జాతకర్మ ముహూర్తము",
    icon: "🌟",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "Performed immediately on day of birth (prior to umbilical cord cut) or on 10th or 11th day. Strictly daytime only. Rohini, Uttaras, Shravana, Dhanishtha, Shatabhisha, Punarvasu, Pushya, Hasta, Swati, Anuradha auspicious. Ashtama Shuddhi mandatory.",
    rules_te: "శిశువు జన్మించిన వెంటనే (నాభిచ్ఛేదనకు పూర్వం) లేదా 10వ లేదా 11వ రోజున చేయవలెను. రాత్రి సమయం నిషిద్ధం (పగటి వేళ మాత్రమే). రోహిణి, ఉత్తరత్రయం, శ్రవణ, ధనిష్ఠ, శతభిషం, పునర్వసు, పుష్య, హస్త, స్వాతి, అనూరాధ శుభప్రదం. అష్టమ శుద్ధి తప్పనిసరి.",
    fields: []
  },
  namakarana: {
    id: "namakarana",
    name_en: "Namakarana Muhurtham",
    name_te: "నామకరణ ముహూర్తము",
    icon: "👶",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "Performed on 11th, 12th, 16th, 20th, or 22nd day from birth. Anuradha, Magha, Rohini, Uttaras, Movable & Fixed stars favorable. Avoid Amavasya. Ashtama Lagna free, Ashtama Shuddhi clean, Chandrashtama free.",
    rules_te: "శిశువు జన్మించిన 11, 12, 16, 20, 22వ రోజులలో చేయవలెను. స్థిర, చర నక్షత్రములు, అనురాధ, మఘ, రోహిణి, ఉత్తరత్రయం శుభప్రదం. అమావాస్య వర్జ్యం. అష్టమ లగ్న దోష రహితం, అష్టమ శుద్ధి, చంద్రాష్టమ రహితం తప్పనిసరి.",
    fields: []
  },
  annaprashana: {
    id: "annaprashana",
    name_en: "Annaprashana Muhurtham",
    name_te: "అన్నప్రాశన ముహూర్తము",
    icon: "🥣",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "First feeding ceremony. Even months (6, 8, 10) for boys; Odd months (5, 7, 9) for girls. Dashama Shuddhi (10th house vacant) is mandatory. Avoid Nanda (1, 6, 11) tithis. Ashtama Shuddhi mandatory.",
    rules_te: "మగపిల్లలకు సరి మాసములలో (6, 8, 10వ నెలలు), ఆడపిల్లలకు బేసి మాసములలో (5, 7, 9వ నెలలు) చేయవలెను. దశమ శుద్ధి (ముహూర్త లగ్నమునకు 10వ ఇల్లు ఖాళీగా ఉండవలెను) తప్పనిసరి. నంద తిథులు (1, 6, 11) వర్జ్యం. అష్టమ శుద్ధి తప్పనిసరి.",
    fields: ["child_gender"]
  },
  choodakarana: {
    id: "choodakarana",
    name_en: "Choodakarana / Tonsure Muhurtham",
    name_te: "చూడాకర్మ / కేశఖండన ముహూర్తము",
    icon: "✂️",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "Boys in 2, 4, 6 months or 3rd/5th year; Girls in 3, 5, 7 months. Strictly during Uttarayana only. Prohibited in birth month, birth star, birth rasi. Ashtama Shuddhi mandatory.",
    rules_te: "మగపిల్లలకు 2, 4, 6వ నెలలు లేదా 3వ లేదా 5వ సంవత్సరములో; ఆడపిల్లలకు 3, 5, 7వ నెలలలో చేయవలెను. తప్పనిసరిగా ఉత్తరాయణమునందే చేయవలెను. శిశువు జన్మ మాసము, జన్మ నక్షత్రము, జన్మ రాశిలందు చేయరాదు. అష్టమ శుద్ధి తప్పనిసరి.",
    fields: ["child_gender", "age_mode"]
  },
  karnavedha: {
    id: "karnavedha",
    name_en: "Karnavedha Muhurtham",
    name_te: "కర్ణవేధ ముహూర్తము",
    icon: "👂",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "Ear-piercing on 12th/16th day from birth or in 6th, 7th, 8th month. Strictly during daytime before sunset. Mrigashira, Chitra, Dhanishtha, Hasta, Pushya, Ashwini, Revati auspicious. Ashtama Shuddhi mandatory.",
    rules_te: "శిశువు జన్మించిన 12వ లేదా 16వ రోజున, లేదా 6, 7, 8వ మాసములలో చేయవలెను. తప్పనిసరిగా పగటి వేళ సూర్యాస్తమయమునకు పూర్వమే చేయవలెను. మృగశిర, చిత్త, ధనిష్ఠ, హస్త, పుష్య, అశ్వినీ, రేవతి నక్షత్రములు ప్రశస్తం. అష్టమ శుద్ధి తప్పనిసరి.",
    fields: ["timing_mode"]
  },
  upanayana: {
    id: "upanayana",
    name_en: "Upanayana Muhurtham",
    name_te: "ఉపనయన ముహూర్తము",
    icon: "📿",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "Sacred thread in 8th year (Brahmin), 11th year (Kshatriya), 12th year (Vaishya). Strictly during Uttarayana only. Guru must be strong in Kendra (1, 4, 7, 10) or Kona (5, 9). Avoid Sukra/Guru Moudhya. 16 auspicious stars. Ashtama Shuddhi mandatory. If the guru (acharya) is known, his janma nakshatra Tarabala must also be checked.",
    rules_te: "బ్రాహ్మణులకు 8వ ఏట (గర్భాష్టమం), క్షత్రియులకు 11వ ఏట, వైశ్యులకు 12వ ఏట చేయవలెను. తప్పనిసరిగా ఉత్తరాయణమునందే చేయవలెను. గురుడు కేంద్ర (1, 4, 7, 10) లేదా కోణములలో (5, 9) బలముగా ఉండవలెను. శుక్ర, గురు మౌఢ్యములు వర్జ్యం. 16 ప్రశస్త నక్షత్రములు. అష్టమ శుద్ధి తప్పనిసరి. తల్లి తండ్రి వటువు అవకాశం ఉంటే గురువుగారి నక్షత్రం కూడా చూడాలి — తారాబల పరీక్ష తప్పనిసరి.",
    fields: ["varna", "guru_nak"]
  },
  samavartana: {
    id: "samavartana",
    name_en: "Samavartana Muhurtham",
    name_te: "సమావర్తన ముహూర్తము",
    icon: "🎓",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "Snatakavrata / return from Guru-kula after completing Veda study, in Uttarayana. Mon, Wed, Thu, Fri favorable; Amavasya avoided; Taras 1, 3, 5, 7 avoided; daytime ceremony.",
    rules_te: "వేదాధ్యయనము పూర్తిగావించి గురుకులము నుండి గృహస్థాశ్రమమునకు ప్రవేశించు సంస్కారము. సోమ, బుధ, గురు, శుక్రవారములు శుభం; 4, 9, 14, 30 తిథులు, జన్మ 3 5 7 తారలు నిషిద్ధం; ఉత్తరాయణమున అనుకూలము.",
    fields: ["varna", "study_years"]
  },
  keshanta_godana: {
    id: "keshanta_godana",
    name_en: "Keshanta / Godana Muhurtham",
    name_te: "కేశాంత / గోదాన ముహూర్తము",
    icon: "💈",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "Godana Vrata — first shaving ritual, classically in the 16th year, Uttarayana mandatory. Avoid tithis 2, 8, 13, Amavasya; Taras 1, 3, 5, 7 avoided; daytime only.",
    rules_te: "బ్రహ్మచారి 16వ సంవత్సరమున గోదానవ్రతముతో శ్మశ్రు త్యాగ సంస్కారము. ఉత్తరాయణము తప్పనిసరి. 2, 8, 13, 4, 9, 14, 30 తిథులు నిషిద్ధం; జన్మ, 3, 5, 7 తారలు నిషిద్ధం; పగటివేళ మాత్రమే.",
    fields: ["study_years"]
  },
  aksharabhyasam: {
    id: "aksharabhyasam",
    name_en: "Aksharabhyasam / Vidyarambham",
    name_te: "అక్షరాభ్యాస / విద్యారంభ ముహూర్తము",
    icon: "✍️",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "Writing of first letters — default 5th year, Vasanta/Uttarayana months preferred. Mon, Wed, Thu, Fri favorable; Amavasya avoided; strictly daytime; Anadhyaya (study-prohibited) days excluded.",
    rules_te: "శిశువు తొలిసారి అక్షరములు వ్రాయుటకు / విద్యారంభమునకు — నిర్ణయము: 5వ సంవత్సరము, వసంత ఋతువు (ఉత్తరాయణం) అనుకూలము. సోమ, బుధ, గురు, శుక్రవారములు శుభం; 4, 9, 14, 30 తిథులు నిషిద్ధం; పగటివేళ మాత్రమే; అనధ్యాయ దినములు వర్జ్యం.",
    fields: ["study_years"]
  },
  prajapatya_vrata: {
    id: "prajapatya_vrata",
    name_en: "Prajapatya Vrata Muhurtham",
    name_te: "ప్రాజాపత్య వ్రత ముహూర్తము",
    icon: "🔥",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "First-year Brahmacharya vrata after Upanayana (libation year +1). Shubha lagnas with Ashtama & Lagna Shuddhi; daytime, Uttarayana months.",
    rules_te: "ఉపనయనానంతరము బ్రహ్మచర్య వ్రతములు — ప్రాజాపత్యవ్రతము (మొదటి సంవత్సరము). శుభ లగ్నములు, అష్టమ & లగ్న శుద్ధులు తప్పనిసరి; 4, 9, 14, 30 తిథులు నిషిద్ధం; పగటివేళ, ఉత్తరాయణ మాసములు.",
    fields: ["varna", "study_years"]
  },
  saumya_vrata: {
    id: "saumya_vrata",
    name_en: "Saumya Vrata Muhurtham",
    name_te: "సౌమ్య వ్రత ముహూర్తము",
    icon: "🌙",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "Second-year Brahmacharya vrata after Upanayana (+2). Same auspicious pattern as Prajapatya Vrata — daytime, shubha lagnas, Ashtama & Lagna Shuddhi.",
    rules_te: "ఉపనయనానంతరము బ్రహ్మచర్య వ్రతములు — సౌమ్యవ్రతము (రెండవ సంవత్సరము). ప్రాజాపత్య వ్రతము వలెనే పద్ధతి — పగటివేళ, శుభ లగ్నములు, అష్టమ & లగ్న శుద్ధులు.",
    fields: ["varna", "study_years"]
  },
  agneya_vrata: {
    id: "agneya_vrata",
    name_en: "Agneya Vrata Muhurtham",
    name_te: "ఆగ్నేయ వ్రత ముహూర్తము",
    icon: "🔥",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "Third-year Brahmacharya vrata after Upanayana (+3). Same auspicious pattern as Prajapatya Vrata — daytime, shubha lagnas, Ashtama & Lagna Shuddhi.",
    rules_te: "ఉపనయనానంతరము బ్రహ్మచర్య వ్రతములు — ఆగ్నేయవ్రతము (మూడవ సంవత్సరము). ప్రాజాపత్య వ్రతము వలెనే పద్ధతి — పగటివేళ, శుభ లగ్నములు, అష్టమ & లగ్న శుద్ధులు.",
    fields: ["varna", "study_years"]
  },
  vaishvadeva_vrata: {
    id: "vaishvadeva_vrata",
    name_en: "Vaishvadeva Vrata Muhurtham",
    name_te: "వైశ్వదేవ వ్రత ముహూర్తము",
    icon: "🙏",
    date_label_en: "Child Date of Birth",
    date_label_te: "శిశువు పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "Fourth-year Brahmacharya vrata after Upanayana (+4). Same auspicious pattern as Prajapatya Vrata — daytime, shubha lagnas, Ashtama & Lagna Shuddhi.",
    rules_te: "ఉపనయనానంతరము బ్రహ్మచర్య వ్రతములు — వైశ్వదేవవ్రతము (నాలుగవ సంవత్సరము). ప్రాజాపత్య వ్రతము వలెనే పద్ధతి — పగటివేళ, శుభ లగ్నములు, అష్టమ & లగ్న శుద్ధులు.",
    fields: ["varna", "study_years"]
  },
  vivaha: {
    id: "vivaha",
    name_en: "Vivaha Muhurtham",
    name_te: "వివాహ ముహూర్తము",
    icon: "💍",
    date_label_en: "Groom's Date of Birth",
    date_label_te: "వరుని పుట్టిన తేదీ",
    time_label_en: "Time of Birth",
    time_label_te: "పుట్టిన సమయం",
    rules_en: "Marriage muhurta: shubha masas Magha/Phalguna/Vaishakha; prohibited Ashadha/Shravana/Bhadrapada/Pushya. Guru or Venus must NOT be combust/retrograde. Avoid 18th (Trijashta) star from bride's star. Chandrashtama (bride/groom) strictly avoided.",
    rules_te: "గృహస్థాశ్రమ స్వీకారము. శుభ మాసములు: మాఘ, ఫాల్గుణ, వైశాఖ; నిషిద్ధ మాసములు: ఆషాఢ, శ్రావణ, భాద్రపద, పుష్య ముహుర్తులు. గురు-శుక్రులు అస్తమించి/వక్రగతిన ఉండరాదు. వధువు జన్మ నక్షత్రమునుండి 18వ (త్రిజేష్ఠ) నక్షత్రం వర్జ్యం. వధూవరుల చంద్రాష్టమము అత్యంత నిషిద్ధం.",
    fields: ["study_years", "husband_details"]
  }
};

let currentActiveSamskara = 'namakarana';

// ---- Dynamic Tab Switching System ----
function switchTab(tab) {
  const allTabs = ['panchang', 'garbhadhana', 'pumsavana', 'seemantha', 'jatakarma', 'namakarana', 'annaprashana', 'choodakarana', 'karnavedha', 'upanayana', 'samavartana', 'keshanta_godana', 'aksharabhyasam', 'prajapatya_vrata', 'saumya_vrata', 'agneya_vrata', 'vaishvadeva_vrata', 'vivaha'];

  allTabs.forEach(t => {
    const btnId = `tab_${t}`;
    const btn = el(btnId) || document.querySelector(`[id^="tab${t.charAt(0).toUpperCase() + t.slice(1)}Btn"][onclick="switchTab('${t}')"]`);
    if (btn) {
      if (t === tab) btn.classList.add("active");
      else btn.classList.remove("active");
    }
  });

  if (tab === 'panchang') {
    el("tabPanchangContent").style.display = "block";
    el("tabNamakaranaContent").style.display = "none";
    const pBtn = el("tabPanchangBtn"), sBtn = el("tabSamskarasModeBtn");
    if (pBtn) pBtn.classList.add("active");
    if (sBtn) sBtn.classList.remove("active");
    history.replaceState(null, "", "#panchang");
  } else {
    el("tabPanchangContent").style.display = "none";
    el("tabNamakaranaContent").style.display = "block";
    const pBtn = el("tabPanchangBtn"), sBtn = el("tabSamskarasModeBtn");
    if (pBtn) pBtn.classList.remove("active");
    if (sBtn) sBtn.classList.add("active");
    setupSamskaraView(tab);
    history.replaceState(null, "", `#${tab}`);
  }
}

function setupSamskaraView(sid) {
  const cfg = SAMSKARAS_CONFIG[sid] || SAMSKARAS_CONFIG.namakarana;
  currentActiveSamskara = cfg.id;

  // Update Banner
  el("samskaraBannerIcon").textContent = cfg.icon;
  el("samskaraBannerTitle").textContent = currentLang === "te" ? cfg.name_te : `${cfg.name_en} (${cfg.name_te})`;
  el("samskaraPageBadge").textContent = currentLang === "te" ? "శాస్త్రీయ వైదిక సంస్కారం" : "Classical Vedic Samskara";
  el("samskaraBannerRules").textContent = currentLang === "te" ? cfg.rules_te : cfg.rules_en;

  // Update Date & Time labels
  el("birthDateLabel").textContent = currentLang === "te" ? cfg.date_label_te : cfg.date_label_en;
  el("birthTimeLabel").textContent = currentLang === "te" ? cfg.time_label_te : cfg.time_label_en;

  // Contextual field visibility
  const fields = cfg.fields || [];
  el("fieldChildGender").style.display = fields.includes("child_gender") ? "block" : "none";
  el("fieldCeremonyType").style.display = fields.includes("ceremony_type") ? "block" : "none";
  el("fieldAgeMode").style.display = fields.includes("age_mode") ? "block" : "none";
  el("fieldTimingMode").style.display = fields.includes("timing_mode") ? "block" : "none";
  el("fieldVarna").style.display = fields.includes("varna") ? "block" : "none";
  el("fieldGuruNak").style.display = fields.includes("guru_nak") ? "block" : "none";
  el("fieldHusbandDetails").style.display = fields.includes("husband_details") ? "block" : "none";
  el("fieldStudyYears").style.display = fields.includes("study_years") ? "block" : "none";
  if (fields.includes("study_years")) {
    const fallbacks = { vivaha: "0 (same year)", keshanta_godana: "16", aksharabhyasam: "5", samavartana: "optional", prajapatya_vrata: "optional", saumya_vrata: "optional", agneya_vrata: "optional", vaishvadeva_vrata: "optional" };
    el("studyYearsInput").placeholder = fallbacks[sid] || "e.g. 8";
  }

  // Populate husband nakshatras + guru nakshatras if empty
  const NAKSHATRAS_LIST = [
    "Ashwini (అశ్విని)", "Bharani (భరణి)", "Krittika (కృత్తిక)", "Rohini (రోహిణి)", "Mrigashira (మృగశిర)",
    "Ardra (ఆరుద్ర)", "Punarvasu (పునర్వసు)", "Pushya (పుష్యమి)", "Ashlesha (ఆశ్లేష)", "Magha (మఖ)",
    "Purva Phalguni (పూర్వఫల్గుణి)", "Uttara Phalguni (ఉత్తరఫల్గుణి)", "Hasta (హస్త)", "Chitra (చిత్త)",
    "Swati (స్వాతి)", "Vishakha (విశాఖ)", "Anuradha (అనూరాధ)", "Jyeshtha (జ్యేష్ఠ)", "Moola (మూల)",
    "Purva Ashadha (పూర్వాషాఢ)", "Uttara Ashadha (ఉత్తరాషాఢ)", "Shravana (శ్రవణం)", "Dhanishtha (ధనిష్ఠ)",
    "Shatabhisha (శతభిషం)", "Purva Bhadrapada (పూర్వాభాద్ర)", "Uttara Bhadrapada (ఉత్తరాభాద్ర)", "Revati (రేవతి)"
  ];
  const hNak = el("husbandNakSelect");
  if (hNak && hNak.options.length <= 1) {
    NAKSHATRAS_LIST.forEach((name, i) => {
      const opt = document.createElement("option");
      opt.value = (i + 1).toString();
      opt.textContent = `${i + 1}. ${name}`;
      hNak.appendChild(opt);
    });
  }
  // Guru (acharya) nakshatra for the Upanayana Tarabala check
  const gNak = el("guruNakSelect");
  if (gNak && gNak.options.length <= 1) {
    NAKSHATRAS_LIST.forEach((name, i) => {
      const opt = document.createElement("option");
      opt.value = (i + 1).toString();
      opt.textContent = `${i + 1}. ${name}`;
      gNak.appendChild(opt);
    });
  }

  // Update CTA button text
  const btn = el("findMuhurtaButton");
  btn.textContent = currentLang === "te" ? `${cfg.name_te} లెక్కించండి` : `Find ${cfg.name_en}`;
  btn.setAttribute("data-en", `Find ${cfg.name_en}`);
  btn.setAttribute("data-te", `${cfg.name_te} లెక్కించండి`);
}

// ---- Samskara Calculation Logic ----
function setNStatus(msg, isError) {
  const s = el("namakaranaStatus");
  s.textContent = msg || "";
  s.className = "status" + (isError ? " error" : "");
}

async function findSamskaraMuhurtas() {
  const sid = currentActiveSamskara || 'namakarana';
  const regionId = el("birthRegionSelect").value;
  const dob = el("birthDateInput").value;
  const tob = el("birthTimeInput").value;
  if (!regionId || !dob || !tob) {
    setNStatus("Please enter Date, Time, and Place.", true);
    return;
  }

  let lat, lon, tz_offset, place_name;

  if (regionId === "custom") {
    const query = el("birthCustomPlaceInput").value.trim();
    if (!query) {
      setNStatus("Please enter a custom place name.", true);
      return;
    }
    el("findMuhurtaButton").disabled = true;
    setNStatus("Geocoding place...");
    try {
      const geoRes = await fetch(`${API_BASE}/geocode?place=${encodeURIComponent(query)}`);
      if (!geoRes.ok) {
        const text = await geoRes.text();
        throw new Error(text || `Geocoding failed`);
      }
      const geo = await geoRes.json();
      lat = geo.lat;
      lon = geo.lon;
      tz_offset = geo.tz_offset;
      place_name = geo.label;
    } catch (e) {
      setNStatus(`Geocoding error: ${e.message}`, true);
      el("findMuhurtaButton").disabled = false;
      return;
    }
  } else {
    const r = allRegions.find(x => x.id === regionId);
    if (!r) {
      setNStatus("Selected place not found.", true);
      return;
    }
    lat = r.lat;
    lon = r.lon;
    tz_offset = r.tz_offset;
    place_name = r.label;
  }

  el("findMuhurtaButton").disabled = true;
  const cfg = SAMSKARAS_CONFIG[sid] || SAMSKARAS_CONFIG.namakarana;
  const loadingMsg = currentLang === "te" ?
    `${cfg.name_te} కోసం శుభ ముహూర్తములను గణిస్తున్నాము...` :
    `Calculating auspicious ${cfg.name_en}...`;
  setNStatus(loadingMsg);
  el("namakaranaResults").style.display = "none";

  let url = `${API_BASE}/muhurta/samskara-finder?type=${sid}&dob=${dob}&tob=${tob}&lat=${lat}&lon=${lon}&tz_offset=${tz_offset}&place_name=${encodeURIComponent(place_name)}`;

  if (sid === "annaprashana" || sid === "choodakarana") {
    url += `&child_gender=${el("childGenderSelect").value}`;
  }
  if (sid === "seemantha") {
    url += `&ceremony_type=${el("ceremonyTypeSelect").value}`;
  }
  if (sid === "choodakarana") {
    url += `&age_mode=${el("ageModeSelect").value}`;
  }
  if (sid === "karnavedha") {
    url += `&timing_mode=${el("timingModeSelect").value}`;
  }
  if (sid === "upanayana") {
    url += `&varna=${el("varnaSelect").value}`;
    // Treatise: తల్లి తండ్రి వటువు అవకాశం ఉంటే గురువుగారి నక్షత్రం కూడా చూడాలి
    const gNak = el("guruNakSelect").value;
    if (gNak) url += `&guru_nak_idx=${gNak}`;
  }
  const STUDY_YEARS_IDS = ["samavartana", "keshanta_godana", "aksharabhyasam", "prajapatya_vrata", "saumya_vrata", "agneya_vrata", "vaishvadeva_vrata", "vivaha"];
  if (STUDY_YEARS_IDS.includes(sid)) {
    const syv = el("studyYearsInput").value.trim();
    if (syv !== "") url += `&study_years=${syv}`;
  }
  if (sid === "vivaha") {
    // Partner (bride) janma nakshatra for Tarabala / Trijashta checks
    const hNak = el("husbandNakSelect").value;
    if (hNak) url += `&bride_nak_idx=${hNak}`;
  }
  if (sid === "garbhadhana") {
    const hRasi = el("husbandMoonRasiSelect").value;
    const hNak = el("husbandNakSelect").value;
    const bRitu = el("brideRituLagnaSelect").value;
    if (hRasi) url += `&husband_moon_rasi_idx=${hRasi}`;
    if (hNak) url += `&husband_nak_idx=${hNak}`;
    if (bRitu) url += `&bride_ritu_lagna_idx=${bRitu}`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    const data = await res.json();
    renderNamakarana(data);
    setNStatus("");
  } catch (e) {
    setNStatus(`Error: ${e.message}`, true);
  } finally {
    el("findMuhurtaButton").disabled = false;
  }
}

const findNamakaranaMuhurtas = findSamskaraMuhurtas;

const TARA_NAMES_TE = {
  "Janma": "జన్మ తార (అశుభం)",
  "Sampat": "సంపత్ తార (శుభం)",
  "Vipat": "విపత్ తార (అశుభం)",
  "Kshema": "క్షేమ తార (శుభం)",
  "Pratyak": "ప్రత్యక్ తార (అశుభం)",
  "Sadhana": "సాధన తార (శుభం)",
  "Naidhana": "నైధన తార (అశుభం)",
  "Mitra": "మిత్ర తార (శుభం)",
  "Paramamitra": "పరమమిత్ర తార (శుభం)"
};

const PLANET_ABBRS = {
  en: { L: "Asc", "0": "Su", "1": "Mo", "2": "Ma", "3": "Me", "4": "Ju", "5": "Ve", "6": "Sa", "7": "Ra", "8": "Ke", Mnd: "Mnd", Gk: "Gk" },
  te: { L: "ల", "0": "ర", "1": "చ", "2": "కు", "3": "బు", "4": "గు", "5": "శు", "6": "శ", "7": "రా", "8": "కే", Mnd: "మం", Gk: "గుళి" }
};

const CHART_GRID_POSITIONS = {
  11: { row: 1, col: 1 },
  0:  { row: 1, col: 2 },
  1:  { row: 1, col: 3 },
  2:  { row: 1, col: 4 },
  3:  { row: 2, col: 4 },
  4:  { row: 3, col: 4 },
  5:  { row: 4, col: 4 },
  6:  { row: 4, col: 3 },
  7:  { row: 4, col: 2 },
  8:  { row: 4, col: 1 },
  9:  { row: 3, col: 1 },
  10: { row: 2, col: 1 }
};

const D9_RASI_LABELS = {
  en: ["Mesha", "Vrishabha", "Mithuna", "Karkataka", "Simha", "Kanya", "Tula", "Vrishchika", "Dhanus", "Makara", "Kumbha", "Meena"],
  te: ["మేషం", "వృషభం", "మిథునం", "కర్కాటకం", "సింహం", "కన్య", "తుల", "వృశ్చికం", "ధనుస్సు", "మకరం", "కుంభం", "మీనం"]
};

function buildD1ChartHTML(d1Array, centerLabel, showNakshatras = false) {
  let rasiPlanets = Array.from({ length: 12 }, () => []);

  if (d1Array && d1Array.length > 0) {
    d1Array.forEach(item => {
      let pAbbr = PLANET_ABBRS[currentLang][item.planet] || item.planet;
      const retroTag = currentLang === "te" ? "(వ)" : "(R)";
      const combustTag = currentLang === "te" ? "(మ)" : "(C)";
      
      if (item.is_retro && item.planet !== "L" && item.planet !== "Mnd" && item.planet !== "Gk") {
        pAbbr += `<span class="chart-retro">${retroTag}</span>`;
      }
      if (item.is_combust && item.planet !== "L" && item.planet !== "Mnd" && item.planet !== "Gk") {
        pAbbr += `<span class="chart-combust">${combustTag}</span>`;
      }

      let entry = pAbbr;
      if (showNakshatras && item.nakshatra) {
        const nakName = te(item.nakshatra, NAKSHATRA_NAMES_TE);
        entry = `<div class="chart-planet-entry"><strong class="chart-planet-abbr">${pAbbr}:</strong> <span class="chart-planet-pada">${nakName}(${item.pada})</span></div>`;
      }
      rasiPlanets[item.rasi_index].push(entry);
    });
  }

  let html = `<div class="south-chart">`;
  html += `<div class="chart-center">${centerLabel}</div>`;

  for (let rasiIdx = 0; rasiIdx < 12; rasiIdx++) {
    const pos = CHART_GRID_POSITIONS[rasiIdx];
    const rasiName = D9_RASI_LABELS[currentLang][rasiIdx];
    const pList = showNakshatras ? rasiPlanets[rasiIdx].join("") : rasiPlanets[rasiIdx].join(", ");

    html += `
  <div class="chart-cell" style="grid-row: ${pos.row}; grid-column: ${pos.col};">
    <div class="rasi-label">${rasiName}</div>
    <div class="planets-list">${pList || "—"}</div>
  </div>
`;
  }
  html += `</div>`;
  return html;
}

let currentNamakaranaData = null;
let currentModalIdx = null;

function openMuhurtaModal(idx) {
  currentModalIdx = idx;
  if (!currentNamakaranaData || !currentNamakaranaData.candidates[idx]) return;
  const c = currentNamakaranaData.candidates[idx];
  const b = currentNamakaranaData.birth_details;

  const pct = c.percentage;
  const isAvoid = pct <= 10;
  const isGood = pct >= 75;
  const badgeClass = isAvoid ? "avoid" : (isGood ? "favorable" : "mixed");
  const badgeText = currentLang === "te" ? 
    (isAvoid ? "నిషిద్ధం" : (isGood ? "ఉత్తమ ముహూర్తం" : "మధ్యమ ముహూర్తం")) : 
    (isAvoid ? "Avoid" : (isGood ? "Excellent" : "Medium"));

  const dayLabelText = currentLang === "te" ? 
    (c.day_label_te || `జన్మదినం నుండి ${c.day_number}వ రోజు`) : 
    (c.day_label_en || `Day ${c.day_number} from Birth`);
  
  el("modalTitle").innerHTML = `${dayLabelText} (${c.date})`;

  // Build Modal Body
  let bodyHtml = "";

  // Pushkara Bhaga & Pushkara Navamsha Morning Window (Before 12 PM)
  const pushkara = c.pushkara_info;
  if (pushkara) {
    const pushType = currentLang === "te" ? pushkara.type_te : pushkara.type_en;
    const pushLagna = currentLang === "te" ? te(pushkara.lagna_name, RASI_NAMES_TE) : pushkara.lagna_name;
    const statement = currentLang === "te" ? pushkara.statement_te : pushkara.statement_en;
    const avoidNote = currentLang === "te" ? pushkara.avoid_note_te : pushkara.avoid_note_en;

    let pushSubDetails = [];
    if (pushkara.pushkara_bhaga && pushkara.pushkara_bhaga.is_available) {
      const pb = pushkara.pushkara_bhaga;
      pushSubDetails.push(currentLang === "te" ?
        `📌 <strong>పుష్కర భాగ ముహూర్తం:</strong> ${pb.precise_time} (సమయ వ్యవధి: ${pb.time_window})` :
        `📌 <strong>Pushkara Bhaga Muhurta:</strong> ${pb.precise_time} (Window: ${pb.time_window})`
      );
    }
    if (pushkara.pushkara_navamsha && pushkara.pushkara_navamsha.is_available) {
      const pn = pushkara.pushkara_navamsha;
      pushSubDetails.push(currentLang === "te" ?
        `📌 <strong>పుష్కర నవాంశ ముహూర్తం:</strong> ${pn.precise_time} (సమయ వ్యవధి: ${pn.time_window})` :
        `📌 <strong>Pushkara Navamsha Muhurta:</strong> ${pn.precise_time} (Window: ${pn.time_window})`
      );
    }
    if (pushSubDetails.length === 0) {
      pushSubDetails.push(currentLang === "te" ?
        `📌 <strong>సమయ వ్యవధి:</strong> ${pushkara.time_window} (${pushLagna} ${pushType})` :
        `📌 <strong>Window:</strong> ${pushkara.time_window} (${pushLagna} ${pushType})`
      );
    }

    bodyHtml += `
      <div class="rec-time-box">
        <h4 class="rec-time-box__title">☀️ ${currentLang === "te" ? "శుభ ముహూర్త సమయ నిర్ణయం" : "Recommended Time Prediction"}</h4>
        <div class="rec-time-box__time">
          ⏰ ${statement}
        </div>
        <div class="rec-time-box__details">
          ${pushSubDetails.join("<br>")}
        </div>
        ${avoidNote ? `
          <div class="rec-time-box__note">
            ⚠️ ${currentLang === "te" ? "గమనిక:" : "Note:"} ${avoidNote}
          </div>
        ` : ''}
      </div>
    `;
  }

  // 2. Native Profile & Transit Strength (Janma Nakshatra, Janma Rasi, Tarabalam, Chandrabalam)
  const d = c.detailed_eval;
  const cb = d?.chandrabalam || c.panchang?.chandrabalam;
  if (b || cb) {
    const bNakTe = b ? te(b.janma_nakshatra || "", NAKSHATRA_NAMES_TE) : "";
    const bRasiTe = b?.birth_moon_rasi ? (te(b.birth_moon_rasi, RASI_NAMES_TE) || b.birth_moon_rasi) : "";
    const cbDesc = cb ? (currentLang === "te" ? cb.desc_te : cb.desc_en) : "";
    const cbBadgeClass = cb?.is_pass ? "native-profile-box__badge--pass" : "native-profile-box__badge--fail";
    bodyHtml += `
      <div class="native-profile-box">
        <div class="native-profile-box__header">
          <strong class="native-profile-box__title">👤 ${currentLang === "te" ? "వ్యక్తిగత సమాచారం & గోచారం (Native & Transit)" : "Native Profile & Transit Details"}</strong>
          ${cb ? `<span class="native-profile-box__badge ${cbBadgeClass}">🌙 ${currentLang === "te" ? "చంద్రబలం:" : "Chandrabalam:"} ${cb.house ? cb.house + 'వ ఇల్లు' : 'అనుకూలం'}</span>` : ''}
        </div>
        <div class="native-profile-box__grid">
          ${b ? `<span><strong>${currentLang === "te" ? "జన్మ నక్షత్రం:" : "Janma Nakshatra:"}</strong> ${bNakTe || b.janma_nakshatra} (${b.janma_nakshatra_pada} పాదం)</span>` : ''}
          ${b?.birth_moon_rasi ? `<span><strong>${currentLang === "te" ? "జన్మ రాశి:" : "Janma Rasi:"}</strong> ${bRasiTe}</span>` : ''}
          ${c.tara ? `<span><strong>${currentLang === "te" ? "తారాబలం:" : "Tarabalam:"}</strong> ${te(c.tara, TARA_NAMES_TE) || c.tara}</span>` : ''}
        </div>
        ${cbDesc ? `<div class="native-profile-box__footer">ℹ️ ${cbDesc}</div>` : ''}
      </div>`;
  }

  // 3. Chandramana Header (Samvatsara, Ayanam, Ruthu, Maasam, Paksham)
  const cm = c.panchang?.chandramana;
  let cmBanner = "";
  if (cm) {
    const samName = currentLang === "te" ? `${cm.samvatsara_name} (${cm.samvatsara_telugu}) నామ సంవత్సరం` : `${cm.samvatsara_name} Samvatsara`;
    const ayanam = currentLang === "te" ? (cm.ayanam_te || cm.ayanam_en) : cm.ayanam_en;
    const ruthu = currentLang === "te" ? (cm.ruthu_te || cm.ruthu_en) : cm.ruthu_en;
    const maasa = currentLang === "te" ? (cm.month_telugu || cm.month_name) : `${cm.month_name} Masam`;
    const paksha = currentLang === "te" ? (cm.paksha_te || cm.paksha_en) : `${cm.paksha_en} Paksham`;
    cmBanner = `
      <div class="cm-banner">
        <span class="cm-banner__sam">🪔 ${samName}</span>
        <span>·</span>
        <span class="cm-banner__ayanam">${ayanam}</span>
        <span>·</span>
        <span class="cm-banner__ruthu">${ruthu}</span>
        <span>·</span>
        <span class="cm-banner__maasa">${maasa}</span>
        <span>·</span>
        <span class="cm-banner__paksha">${paksha}</span>
      </div>`;
  }

  // 1. Candidate Panchang Grid
  const vaaraTe = VAARA_NAMES[currentLang][c.panchang.vaara] || c.panchang.vaara;
  const nakTe = te(c.panchang.nakshatra, NAKSHATRA_NAMES_TE);
  const taraTe = te(c.tara, TARA_NAMES_TE);
  const isAbhijitAuspicious = c.panchang.abhijit_kala_muhurtham && c.panchang.abhijit_kala_muhurtham.status === 'auspicious';

  bodyHtml += `
    <div class="detail-card">
      <h4 class="detail-card__title">📌 ${currentLang === "te" ? "పంచాంగ వివరాలు (ఉదయం 10:00)" : "Panchang Details (10:00 AM)"}</h4>
      ${cmBanner}
      <div class="detail-card__grid">
        <div><strong>${currentLang === "te" ? "వారం:" : "Weekday:"}</strong> ${vaaraTe}</div>
        <div><strong>${currentLang === "te" ? "తిథి:" : "Tithi:"}</strong> ${c.panchang.tithi}</div>
        <div><strong>${currentLang === "te" ? "నక్షత్రం:" : "Nakshatra:"}</strong> ${nakTe}</div>
        <div><strong>${currentLang === "te" ? "తారాబలం:" : "Tarabalam:"}</strong> ${taraTe}</div>
        <div><strong>${currentLang === "te" ? "యోగం:" : "Yoga:"}</strong> ${c.panchang.yoga}</div>
        <div><strong>${currentLang === "te" ? "కరణం:" : "Karana:"}</strong> ${c.panchang.karana}</div>
        <div><strong>${currentLang === "te" ? "సూర్యోదయం:" : "Sunrise:"}</strong> ${c.panchang.sunrise || "—"}</div>
        <div><strong>${currentLang === "te" ? "సూర్యాస్తమయం:" : "Sunset:"}</strong> ${c.panchang.sunset || "—"}</div>
        <div><strong>${currentLang === "te" ? "అభిజిత్ ముహూర్తం:" : "Abhijit:"}</strong> ${c.panchang.abhijit_muhurta ? (c.panchang.abhijit_muhurta.start + ' – ' + c.panchang.abhijit_muhurta.end) : '—'}</div>
        <div class="abhijit-strip ${isAbhijitAuspicious ? 'abhijit-strip--auspicious' : 'abhijit-strip--inauspicious'}">
          <span>${isAbhijitAuspicious ? '✨' : '⚠️'}</span>
          <span>
            <strong>${currentLang === "te" ? "అభిజిత్ కాల ముహూర్తం:" : "Abhijit Kala Muhurtham:"}</strong>
            ${c.panchang.abhijit_kala_muhurtham ? 
              (currentLang === 'te' ? c.panchang.abhijit_kala_muhurtham.msg_te : c.panchang.abhijit_kala_muhurtham.msg_en) : 
              '—'
            }
          </span>
        </div>
      </div>
    </div>
  `;

  // 4. Panchaka Rahitam Card
  const pan = c.panchang?.panchaka_rahitam || d?.panchaka;
  if (pan) {
    const panName = currentLang === "te" ? pan.name_te : pan.name_en;
    const panEffect = currentLang === "te" ? pan.effect_te : pan.effect_en;
    const panPariharam = currentLang === "te" ? pan.pariharam_te : pan.pariharam_en;
    const isPass = pan.is_pass;
    bodyHtml += `
      <div class="panchaka-box ${isPass ? 'panchaka-box--pass' : 'panchaka-box--fail'}">
        <div class="panchaka-box__header">
          <h4 class="panchaka-box__title ${isPass ? 'panchaka-box__title--pass' : 'panchaka-box__title--fail'}">
            ☸️ ${currentLang === "te" ? "పంచక రహిత విశ్లేషణ (Panchaka Rahitam)" : "Panchaka Rahitam Analysis"}
          </h4>
          <span class="panchaka-box__badge ${isPass ? 'panchaka-box__badge--pass' : 'panchaka-box__badge--fail'}">
            ${isPass ? (currentLang === "te" ? "శుభ పంచకం (దోష రహితం)" : "Subha (Clean)") : (currentLang === "te" ? "అశుభ పంచకం" : "Dosha")}
          </span>
        </div>
        <div class="panchaka-box__body">
          <div><strong>${currentLang === "te" ? "పంచక నిర్ణయ సూత్రం:" : "Formula:"}</strong> <code>${pan.formula || `(తిథి + వారం + నక్షత్రం + లగ్నం) % 9 = శేషం ${pan.remainder}`}</code></div>
          <div class="panchaka-box__classification"><strong>${currentLang === "te" ? "పంచక ఫలితం:" : "Classification:"}</strong> <span class="${isPass ? 'panchaka-box__classification-name--pass' : 'panchaka-box__classification-name--fail'}">${panName}</span> — <em>${panEffect}</em></div>
          ${panPariharam && !isPass ? `
            <div class="panchaka-box__remedy">
              <strong>🌿 ${currentLang === "te" ? "శాస్త్రోక్త పరిహారం:" : "Classical Remedy:"}</strong> ${panPariharam}
            </div>
          ` : ''}
        </div>
      </div>`;
  }

  // 5. Daily 5-Fold Division (Kala Vibhajana)
  const kv = c.panchang?.kala_vibhajana;
  if (kv) {
    bodyHtml += `
      <div class="kv-section">
        <h4 class="kv-header">
          <span>⏳ ${currentLang === "te" ? "రోజు మొత్తంలో కాల విభజన (పంచధా కాల విభజన)" : "Daily 5-Fold Time Division (Kala Vibhajana)"}</span>
          <span class="kv-header__sub">${currentLang === "te" ? "పగలు 5 భాగాలు + రాత్రి పవిత్ర కాలాలు" : "5 Day divisions + Night Sacred Periods"}</span>
        </h4>
        <div class="kv-grid">
          <div class="kv-card">
            <div class="kv-card__name kv-card__name--pratah">🌅 ${currentLang === "te" ? kv.pratah_kalam?.name_te : kv.pratah_kalam?.name_en}</div>
            <div class="kv-card__time">${kv.pratah_kalam?.start} – ${kv.pratah_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.pratah_kalam?.desc_te : kv.pratah_kalam?.desc_en}</div>
          </div>
          <div class="kv-card">
            <div class="kv-card__name kv-card__name--sangava">🌾 ${currentLang === "te" ? kv.sangava_kalam?.name_te : kv.sangava_kalam?.name_en}</div>
            <div class="kv-card__time">${kv.sangava_kalam?.start} – ${kv.sangava_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.sangava_kalam?.desc_te : kv.sangava_kalam?.desc_en}</div>
          </div>
          <div class="kv-card kv-card--highlight">
            <div class="kv-card__name kv-card__name--madhya">☀️ ${currentLang === "te" ? kv.madhyahnika_kalam?.name_te : kv.madhyahnika_kalam?.name_en} <span class="kv-tag">అభిజిత్</span></div>
            <div class="kv-card__time">${kv.madhyahnika_kalam?.start} – ${kv.madhyahnika_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.madhyahnika_kalam?.desc_te : kv.madhyahnika_kalam?.desc_en}</div>
          </div>
          <div class="kv-card">
            <div class="kv-card__name kv-card__name--aparahna">⛅ ${currentLang === "te" ? kv.aparahna_kalam?.name_te : kv.aparahna_kalam?.name_en}</div>
            <div class="kv-card__time">${kv.aparahna_kalam?.start} – ${kv.aparahna_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.aparahna_kalam?.desc_te : kv.aparahna_kalam?.desc_en}</div>
          </div>
          <div class="kv-card">
            <div class="kv-card__name kv-card__name--sayahna">🌇 ${currentLang === "te" ? kv.sayahna_kalam?.name_te : kv.sayahna_kalam?.name_en}</div>
            <div class="kv-card__time">${kv.sayahna_kalam?.start} – ${kv.sayahna_kalam?.end}</div>
            <div class="kv-card__desc">${currentLang === "te" ? kv.sayahna_kalam?.desc_te : kv.sayahna_kalam?.desc_en}</div>
          </div>
          <div class="kv-card kv-card--sacred">
            <div class="kv-card__name kv-card__name--sacred">🕉️ ${currentLang === "te" ? "రాత్రి విశేష కాలములు" : "Night Sacred Timings"}</div>
            <div class="kv-card__sacred-times">
              <strong>${currentLang === "te" ? "ప్రదోషం:" : "Pradosha:"}</strong> ${kv.pradosha_kalam?.start} – ${kv.pradosha_kalam?.end}<br>
              <strong>${currentLang === "te" ? "నిశీథ కాలం:" : "Nisitha:"}</strong> ${kv.nisitha_kalam?.start} – ${kv.nisitha_kalam?.end}<br>
              <strong>${currentLang === "te" ? "బ్రాహ్మీ ముహూర్తం:" : "Brahma:"}</strong> ${kv.brahma_muhurtham?.start} – ${kv.brahma_muhurtham?.end}
            </div>
          </div>
        </div>
      </div>`;
  }

  // 6. Lagna Schedule (ప్రతి లగ్న అంతము)
  const lsched = c.panchang?.lagna_schedule;
  if (lsched && lsched.length > 0) {
    const currentLagnaName = d?.lagna_shuddhi?.muhurta_lagna || "";
    bodyHtml += `
      <div class="lagna-section">
        <h4 class="lagna-section__title">
          <span>🏛️ ${currentLang === "te" ? "ప్రతి లగ్న అంతము (సూర్యోదయం నుండి 12 లగ్నాలు)" : "Daily Lagna Schedule (Lagna Antyalu - All 12 Signs)"}</span>
          <span class="lagna-section__subtitle">${currentLang === "te" ? "ముహూర్త లగ్నం హైలైట్ చేయబడినది" : "Muhurta Lagna Highlighted"}</span>
        </h4>
        <div class="lagna-grid">`;
    lsched.forEach(l => {
      const isCurrent = currentLagnaName && (l.lagna_name === currentLagnaName || l.lagna_name_te === currentLagnaName);
      const lName = currentLang === "te" ? l.lagna_name_te : l.lagna_name;
      bodyHtml += `
        <div class="lagna-item ${isCurrent ? 'lagna-item--current' : ''}">
          <div class="lagna-item__header">
            <strong class="lagna-item__name">${lName}</strong>
            ${isCurrent ? `<span class="lagna-item__muhurta-tag">ముహూర్తం</span>` : ''}
          </div>
          <div class="lagna-item__time">${l.start_time} – ${l.end_time}</div>
        </div>`;
    });
    bodyHtml += `</div></div>`;
  }

  // 7. Inauspicious Timings Section + Explanation Note
  const ip = (c.panchang && c.panchang.inauspicious_periods) ? c.panchang.inauspicious_periods : (c.panchang || {});
  function fmtP(p) {
    if (!p) return "—";
    if (typeof p === 'string') return p.trim() || "—";
    if (Array.isArray(p)) {
      if (p.length === 0) return "—";
      return p.map(item => {
        if (!item) return "";
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item.start && item.end) return `${item.start} – ${item.end}`;
        return String(item);
      }).filter(Boolean).join(" & ") || "—";
    }
    if (typeof p === 'object' && p.start && p.end) return `${p.start} – ${p.end}`;
    return String(p) || "—";
  }

  bodyHtml += `
    <div class="inauspicious-card">
      <h4 class="inauspicious-card__title">⏳ ${currentLang === "te" ? "అశుభ సమయములు (Inauspicious Timings)" : "Inauspicious Timings"}</h4>
      <div class="inauspicious-card__grid">
        <div><strong>${currentLang === "te" ? "రాహు కాలం:" : "Rahu Kalam:"}</strong> ${fmtP(ip.rahu_kalam)}</div>
        <div><strong>${currentLang === "te" ? "యమగండం:" : "Yamagandam:"}</strong> ${fmtP(ip.yamagandam)}</div>
        <div><strong>${currentLang === "te" ? "గుళిక కాలం:" : "Gulika Kalam:"}</strong> ${fmtP(ip.gulika_kalam)}</div>
        <div><strong>${currentLang === "te" ? "దుర్ముహూర్తం:" : "Durmuhurtam:"}</strong> ${fmtP(ip.durmuhurtam)}</div>
        <div><strong>${currentLang === "te" ? "వర్జ్యం:" : "Varjyam:"}</strong> ${fmtP(ip.varjyam)}</div>
      </div>
      <div class="inauspicious-card__note">
        ℹ️ <strong>${currentLang === "te" ? "పంచాంగ సమయాల వివరణ:" : "Note on Astrological Timings Across Apps:"}</strong> 
        ${currentLang === "te" ? 
          "ఒక App లో ఒక రకంగా, ఇంకో App లో వేరే రకంగా ఉండటానికి కారణం: ఈ యాప్ ఖచ్చితమైన స్థానిక దృక్సిద్ధాంతం (Drik-Ganita Topocentric Swiss Ephemeris) ఆధారంగా ఆ ప్రదేశపు నిజ సూర్యోదయ/సూర్యాస్తమయ సమయాలను అనుసరించి 8 సమాన భాగాలుగా రాహుకాలం, యమగండం, దుర్ముహూర్తములను గణిస్తుంది. ప్రామాణిక 12 గంటల ఫిక్స్‌డ్ సమయాలను కాకుండా ఖగోళ సంబంధిత కచ్చితమైన సమయాన్ని ఇస్తుంది." : 
          "Timings may slightly vary across different panchang apps. This app calculates precise Drik-Ganita topocentric astronomical sunrise/sunset for your exact location, dividing the local daylight period into 8 equal Ashtabhaga intervals. This provides authentic classical accuracy rather than fixed standard calendar estimates."}
      </div>
    </div>
  `;

  // 8. Candidate D1 Chart
  const mTimeStr = c.pushkara_info ? c.pushkara_info.precise_time : "";
  const chartTitle = currentLang === "te" ? `📊 ముహూర్త దిన D1 (రాశి) చక్రం (${c.date}${mTimeStr ? ' ' + mTimeStr : ''})` : `📊 Muhurta Day D1 (Rasi) Chart (${c.date}${mTimeStr ? ' ' + mTimeStr : ''})`;
  const chartHtml = buildD1ChartHTML(c.d1_chart, currentLang === "te" ? `ముహూర్త D1<br>(${mTimeStr || c.date})` : `MUHURTA D1<br>(${mTimeStr || c.date})`, false);

  bodyHtml += `
    <div class="chart-card">
      <h4 class="chart-card__title">${chartTitle}</h4>
      ${chartHtml}
    </div>
  `;

  // 9. Exhaustive Rule Verification Grid
  bodyHtml += `
    <h4 class="rules-eval-title">📜 ${currentLang === "te" ? "ముహూర్త నియమ విశ్లేషణ & దోష శోధన" : "Muhurta Rules & Dosha Evaluation"}</h4>
    <div class="rule-grid">
  `;

  const sMetaNameTe = c.samskara_name_te || (SAMSKARAS_CONFIG[currentActiveSamskara] ? SAMSKARAS_CONFIG[currentActiveSamskara].name_te : "సంస్కారము");
  const sMetaNameEn = c.samskara_name_en || (SAMSKARAS_CONFIG[currentActiveSamskara] ? SAMSKARAS_CONFIG[currentActiveSamskara].name_en : "Samskara");

  // Vaara rule
  const vPass = d?.vaara ? d.vaara.is_pass : (c.panchang?.vaara !== "Tuesday" && c.panchang?.vaara !== "Saturday" && c.panchang?.vaara !== "Sunday");
  bodyHtml += `
    <div class="rule-card ${vPass ? 'pass' : 'fail'}">
      <div class="rule-title">
        <span>${currentLang === "te" ? "1. వార శుద్ధి (Weekday)" : "1. Weekday Check"}</span>
        <span>${vPass ? '✓' : '✕'}</span>
      </div>
      <div class="rule-desc">
        ${currentLang === "te" ? 
          `${vaaraTe} — ${vPass ? `${sMetaNameTe}కు శ్రేష్ఠమైన వారము.` : `${sMetaNameTe}కు నిషిద్ధం/అనుకూలం కాని వారము.`}` :
          `${c.panchang?.vaara} — ${vPass ? `Auspicious day for ${sMetaNameEn}.` : `Not recommended for ${sMetaNameEn}.`}`}
      </div>
    </div>
  `;

  // Tithi rule
  const tPass = d?.tithi ? d.tithi.is_pass : !(c.reasons && c.reasons.some(r => r.includes("Tithi")));
  bodyHtml += `
    <div class="rule-card ${tPass ? 'pass' : 'fail'}">
      <div class="rule-title">
        <span>${currentLang === "te" ? "2. తిథి శుద్ధి (Tithi)" : "2. Tithi Check"}</span>
        <span>${tPass ? '✓' : '✕'}</span>
      </div>
      <div class="rule-desc">
        ${c.panchang?.tithi} — ${tPass ? (currentLang === "te" ? "అనుకూలమైన శుభ తిథి." : "Auspicious Tithi.") : (currentLang === "te" ? "రిక్త / నిషిద్ధ తిథి (చతుర్థి, అష్టమి, నవమి, చతుర్దశి, పౌర్ణమి, అమావాస్య నిషిద్ధం)." : "Avoided Tithi (Chaturthi, Ashtami, Navami, Chaturdashi, Purnima, Amavasya strictly avoided).")}
      </div>
    </div>
  `;

  // Nakshatra rule
  const nPass = d?.nakshatra ? d.nakshatra.is_pass : !(c.reasons && c.reasons.some(r => r.includes("Nakshatra") && r.includes("not recommended")));
  bodyHtml += `
    <div class="rule-card ${nPass ? 'pass' : 'fail'}">
      <div class="rule-title">
        <span>${currentLang === "te" ? "3. నక్షత్ర శుద్ధి (Nakshatra)" : "3. Nakshatra Check"}</span>
        <span>${nPass ? '✓' : '✕'}</span>
      </div>
      <div class="rule-desc">
        ${nakTe} — ${nPass ? (currentLang === "te" ? `${sMetaNameTe} శాస్త్రోక్త శ్రేష్ఠ నక్షత్రముల యందు ఉన్నది.` : `In the prescribed favorable star list for ${sMetaNameEn}.`) : (currentLang === "te" ? `${sMetaNameTe} శాస్త్రోక్త నక్షత్రముల యందు లేదు.` : `Not in the prescribed favorable star list for ${sMetaNameEn}.`)}
      </div>
    </div>
  `;

  // Tarabalam rule
  const taraPass = d?.tara ? d.tara.is_pass : (c.is_tara_good ?? true);
  bodyHtml += `
    <div class="rule-card ${taraPass ? 'pass' : 'fail'}">
      <div class="rule-title">
        <span>${currentLang === "te" ? "4. తారాబలము (Tarabalam)" : "4. Tarabalam Check"}</span>
        <span>${taraPass ? '✓' : '✕'}</span>
      </div>
      <div class="rule-desc">
        ${taraTe} — ${taraPass ? (currentLang === "te" ? "శ్రేష్ఠమైన శుభ తార." : "Auspicious Tara strength.") : (currentLang === "te" ? "నిషిద్ధ/అశుభ తార (జన్మ, విపత్, ప్రత్యక్, నైధన తారలు నిషిద్ధం)." : "Inauspicious Tara (Janma, Vipat, Pratyak, Naidhana avoided).")}
      </div>
    </div>
  `;

  // Chandrabalam rule
  if (d && d.chandrabalam) {
    const cbInfo = d.chandrabalam;
    const cbPass = cbInfo.is_pass;
    bodyHtml += `
      <div class="rule-card ${cbPass ? 'pass' : 'fail'}">
        <div class="rule-title">
          <span>${currentLang === "te" ? "5. చంద్రబలము (Chandrabalam)" : "5. Chandrabalam Check"}</span>
          <span>${cbPass ? '✓' : '✕'}</span>
        </div>
        <div class="rule-desc">
          ${currentLang === "te" ? cbInfo.desc_te : cbInfo.desc_en}
        </div>
      </div>
    `;
  }

  // Panchaka rule
  if (d && d.panchaka) {
    const pkInfo = d.panchaka;
    const pkPass = pkInfo.is_pass;
    bodyHtml += `
      <div class="rule-card ${pkPass ? 'pass' : 'fail'}">
        <div class="rule-title">
          <span>${currentLang === "te" ? "6. పంచక శుద్ధి (Panchaka Rahitam)" : "6. Panchaka Check"}</span>
          <span>${pkPass ? '✓' : '✕'}</span>
        </div>
        <div class="rule-desc">
          ${currentLang === "te" ? pkInfo.name_te : pkInfo.name_en} — ${currentLang === "te" ? pkInfo.effect_te : pkInfo.effect_en}
        </div>
      </div>
    `;
  }

  // Ashtama Lagna rule
  const alDosha = d?.ashtama_lagna ? d.ashtama_lagna.is_dosha : (c.reasons && c.reasons.some(r => r.includes("Ashtama Lagna")));
  const bLagnaName = (d?.ashtama_lagna && d.ashtama_lagna.birth_lagna) ? d.ashtama_lagna.birth_lagna : (b?.birth_lagna || "Birth Lagna");
  const mLagnaName = (d?.ashtama_lagna && d.ashtama_lagna.muhurta_lagna) ? d.ashtama_lagna.muhurta_lagna : (d?.ashtama_shuddhi?.muhurta_lagna || c.lagna_name || "Muhurta Lagna");
  bodyHtml += `
    <div class="rule-card ${!alDosha ? 'pass' : 'fail'}">
      <div class="rule-title">
        <span>${currentLang === "te" ? "7. అష్టమ లగ్న దోషం (Ashtama Lagna)" : "7. Ashtama Lagna Check"}</span>
        <span>${!alDosha ? '✓' : '✕'}</span>
      </div>
      <div class="rule-desc">
        ${!alDosha ? 
          (currentLang === "te" ? `జన్మ లగ్నం (${bLagnaName}) మరియు ముహూర్త లగ్నం (${mLagnaName}) మధ్య అష్టమ లగ్న దోషం లేదు.` : `Clean! Muhurta Lagna (${mLagnaName}) is not the 8th house from Birth Lagna (${bLagnaName}).`) :
          (currentLang === "te" ? `అష్టమ లగ్న దోషం ఉంది! ముహూర్త లగ్నం (${mLagnaName}) జన్మ లగ్నం (${bLagnaName}) నుండి 8వ ఇల్లు.` : `Ashtama Lagna Dosha present! Muhurta Lagna (${mLagnaName}) is the 8th house from Birth Lagna (${bLagnaName}).`)}
      </div>
    </div>
  `;

  // Ashtama Shuddhi rule
  const asShuddhi = d?.ashtama_shuddhi ? d.ashtama_shuddhi.has_shuddhi : !(c.reasons && c.reasons.some(r => r.includes("No Ashtama Shuddhi")));
  const pIn8 = (d?.ashtama_shuddhi?.planets_in_8th && d.ashtama_shuddhi.planets_in_8th.length > 0) ? d.ashtama_shuddhi.planets_in_8th.join(", ") : "";
  const mLagnaTe = d?.ashtama_shuddhi?.muhurta_lagna ? (te(d.ashtama_shuddhi.muhurta_lagna, RASI_NAMES_TE) || d.ashtama_shuddhi.muhurta_lagna) : (te(mLagnaName, RASI_NAMES_TE) || mLagnaName);
  const aRasiTe = d?.ashtama_shuddhi?.ashtama_rasi ? (te(d.ashtama_shuddhi.ashtama_rasi, RASI_NAMES_TE) || d.ashtama_shuddhi.ashtama_rasi) : "";
  const aRasiEn = d?.ashtama_shuddhi?.ashtama_rasi || "8th house";

  bodyHtml += `
    <div class="rule-card ${asShuddhi ? 'pass' : 'fail'}">
      <div class="rule-title">
        <span>${currentLang === "te" ? "8. అష్టమ శుద్ధి (8th House Vacant)" : "8. Ashtama Shuddhi Check"}</span>
        <span>${asShuddhi ? '✓' : '✕'}</span>
      </div>
      <div class="rule-desc">
        ${asShuddhi ? 
          (currentLang === "te" ? `అష్టమ శుద్ధి పరిపూర్ణంగా ఉన్నది (ముహూర్త లగ్నం ${mLagnaTe} నుండి 8వ ఇల్లు ${aRasiTe} ఖాళీగా ఉంది).` : `Ashtama Shuddhi clean! 8th house (${aRasiEn}) from Muhurta Lagna (${mLagnaName}) is completely vacant.`) :
          (currentLang === "te" ? `అష్టమ శుద్ధి లేదు! ముహూర్త లగ్నం ${mLagnaTe} నుండి 8వ ఇంట్లో (${aRasiTe}) గ్రహాలు ఉన్నాయి (${pIn8}).` : `Ashtama Shuddhi violated! Planets (${pIn8}) occupying the 8th house (${aRasiEn}) from Muhurta Lagna (${mLagnaName}).`)}
      </div>
    </div>
  `;

  // Navama Shuddhi rule (Seemantha)
  if (d && d.navama_shuddhi) {
    const nsPass = d.navama_shuddhi.has_shuddhi;
    const pIn9 = d.navama_shuddhi.planets_in_9th && d.navama_shuddhi.planets_in_9th.length > 0 ? d.navama_shuddhi.planets_in_9th.join(", ") : "";
    bodyHtml += `
      <div class="rule-card ${nsPass ? 'pass' : 'fail'}">
        <div class="rule-title">
          <span>${currentLang === "te" ? "నవమ శుద్ధి (9వ ఇల్లు ఖాళీ - సీమంతం)" : "Navama Shuddhi Check (9th House Vacant - Seemantha)"}</span>
          <span>${nsPass ? '✓' : '✕'}</span>
        </div>
        <div class="rule-desc">
          ${nsPass ? 
            (currentLang === "te" ? "నవమ శుద్ధి పరిపూర్ణంగా ఉన్నది (ముహూర్త లగ్నం నుండి 9వ ఇల్లు పూర్తిగా ఖాళీగా ఉంది)." : "Navama Shuddhi clean! 9th house from Muhurta Lagna is completely vacant.") :
            (currentLang === "te" ? `నవమ శుద్ధి లేదు! 9వ ఇంట్లో గ్రహాలు ఉన్నాయి (${pIn9}).` : `Navama Shuddhi violated! Planets (${pIn9}) occupying the 9th house.`)}
        </div>
      </div>
    `;
  }

  // Dashama Shuddhi rule (Annaprashana)
  if (d && d.dashama_shuddhi) {
    const dsPass = d.dashama_shuddhi.has_shuddhi;
    const pIn10 = d.dashama_shuddhi.planets_in_10th && d.dashama_shuddhi.planets_in_10th.length > 0 ? d.dashama_shuddhi.planets_in_10th.join(", ") : "";
    bodyHtml += `
      <div class="rule-card ${dsPass ? 'pass' : 'fail'}">
        <div class="rule-title">
          <span>${currentLang === "te" ? "దశమ శుద్ధి (10వ ఇల్లు ఖాళీ - అన్నప్రాశన)" : "Dashama Shuddhi Check (10th House Vacant - Annaprashana)"}</span>
          <span>${dsPass ? '✓' : '✕'}</span>
        </div>
        <div class="rule-desc">
          ${dsPass ? 
            (currentLang === "te" ? "దశమ శుద్ధి పరిపూర్ణంగా ఉన్నది (ముహూర్త లగ్నం నుండి 10వ ఇల్లు పూర్తిగా ఖాళీగా ఉంది)." : "Dashama Shuddhi clean! 10th house from Muhurta Lagna is completely vacant.") :
            (currentLang === "te" ? `దశమ శుద్ధి లేదు! 10వ ఇంట్లో గ్రహాలు ఉన్నాయి (${pIn10}).` : `Dashama Shuddhi violated! Planets (${pIn10}) occupying the 10th house.`)}
        </div>
      </div>
    `;
  }

  // Guru Strength rule (Upanayana)
  if (d && d.guru_strength) {
    const gsPass = d.guru_strength.is_strong;
    const gsDesc = d.guru_strength.desc;
    bodyHtml += `
      <div class="rule-card ${gsPass ? 'pass' : 'fail'}">
        <div class="rule-title">
          <span>${currentLang === "te" ? "గురు బలం (ఉపనయనం)" : "Guru Bala Check (Upanayana)"}</span>
          <span>${gsPass ? '✓' : '✕'}</span>
        </div>
        <div class="rule-desc">
          ${gsDesc}
        </div>
      </div>
    `;
  }

  // Yoga rule
  const yPass = d?.yoga ? d.yoga.is_pass : !(c.reasons && c.reasons.some(r => r.includes("yoga!")));
  bodyHtml += `
    <div class="rule-card ${yPass ? 'pass' : 'fail'}">
      <div class="rule-title">
        <span>${currentLang === "te" ? "9. యోగ పరిశీలన (Yoga)" : "9. Yoga Check"}</span>
        <span>${yPass ? '✓' : '✕'}</span>
      </div>
      <div class="rule-desc">
        ${c.panchang?.yoga} — ${yPass ? (currentLang === "te" ? "అనుకూల యోగము." : "Favorable Yoga.") : (currentLang === "te" ? "నిషిద్ధ/అశుభ యోగము (వైధృతి, గండ, వ్యతీపాత, పరిఘ నిషిద్ధం)." : "Avoided/Inauspicious Yoga.")}
      </div>
    </div>
  `;

  // Karana rule
  const kPass = d?.karana ? d.karana.is_pass : !(c.reasons && c.reasons.some(r => r.includes("karana!")));
  bodyHtml += `
    <div class="rule-card ${kPass ? 'pass' : 'fail'}">
      <div class="rule-title">
        <span>${currentLang === "te" ? "10. కరణ పరిశీలన (Karana)" : "10. Karana Check"}</span>
        <span>${kPass ? '✓' : '✕'}</span>
      </div>
      <div class="rule-desc">
        ${c.panchang?.karana} — ${kPass ? (currentLang === "te" ? "అనుకూల కరణము." : "Favorable Karana.") : (currentLang === "te" ? "నిషిద్ధ/అశుభ కరణము (విష్టి/భద్ర, శకుని, చతుష్పాద, నాగ, కింస్తుఘ్న నిషిద్ధం)." : "Avoided/Inauspicious Karana (Vishti/Bhadra, Shakuni, etc. avoided).")}
      </div>
    </div>
  `;

  // Special Yogas rule / section
  if (c.special_yogas && c.special_yogas.length > 0) {
    let syItems = "";
    c.special_yogas.forEach(y => {
      const yName = currentLang === "te" ? y.name_te : y.name_en;
      const yDesc = currentLang === "te" ? y.desc_te : y.desc_en;
      syItems += `<div><strong>✨ ${yName}:</strong> ${yDesc}</div>`;
    });
    bodyHtml += `
      <div class="rule-card pass rule-card--full">
        <div class="rule-title">
          <span>${currentLang === "te" ? "11. విశేష యోగములు (Special Muhurta Yogas)" : "11. Special Muhurta Yogas"}</span>
          <span>✨</span>
        </div>
        <div class="rule-desc rule-desc--col">
          ${syItems}
        </div>
      </div>
    `;
  }

  bodyHtml += `</div>`; // rule-grid ends

  // 10. 21 Maha Doshas Evaluation
  if (d && d.maha_doshas && d.maha_doshas.length > 0) {
    const mahaPass = d.maha_doshas.filter(m => m.is_pass).length;
    const mahaScore = mahaPass * 10;
    bodyHtml += `
      <div class="dosha-panel dosha-panel--maha">
        <div class="dosha-panel__header dosha-panel__header--maha">
          <span>🔥 ${currentLang === "te" ? "ఏకవింశతి మహాదోషముల విశ్లేషణ (21 Maha Doshas)" : "21 Maha Doshas Evaluation"}</span>
          <span class="dosha-panel__score dosha-panel__score--maha">${mahaScore} / 210</span>
        </div>
        <div class="dosha-panel__body dosha-panel__body--maha">`;
    d.maha_doshas.forEach(m => {
      const mTitle = currentLang === "te" ? m.name_te : m.name_en;
      const mDesc = currentLang === "te" ? m.desc_te : m.desc_en;
      bodyHtml += `
        <div class="dosha-item ${m.is_pass ? 'dosha-item--pass' : 'dosha-item--fail-maha'}">
          <div class="dosha-item__header">
            <strong class="dosha-item__name">${mTitle}</strong>
            <span class="dosha-item__badge ${m.is_pass ? 'dosha-item__badge--pass' : 'dosha-item__badge--fail'}">${m.score}/10</span>
          </div>
          <div class="${m.is_pass ? 'dosha-item__desc--pass' : 'dosha-item__desc--fail'}">${mDesc}</div>
        </div>`;
    });
    bodyHtml += `</div></div>`;
  }

  // 11. 10 Dashavidha Doshas Evaluation
  if (d && d.dashavidha_doshas && d.dashavidha_doshas.length > 0) {
    const dashaPass = d.dashavidha_doshas.filter(m => m.is_pass).length;
    const dashaScore = dashaPass * 10;
    bodyHtml += `
      <div class="dosha-panel dosha-panel--dasha">
        <div class="dosha-panel__header dosha-panel__header--dasha">
          <span>⚡ ${currentLang === "te" ? "దశవిధ దోషముల విశ్లేషణ (10 Dashavidha Doshas)" : "10 Dashavidha Doshas Evaluation"}</span>
          <span class="dosha-panel__score dosha-panel__score--dasha">${dashaScore} / 100</span>
        </div>
        <div class="dosha-panel__body dosha-panel__body--dasha">`;
    d.dashavidha_doshas.forEach(m => {
      const mTitle = currentLang === "te" ? m.name_te : m.name_en;
      const mDesc = currentLang === "te" ? m.desc_te : m.desc_en;
      bodyHtml += `
        <div class="dosha-item ${m.is_pass ? 'dosha-item--pass' : 'dosha-item--fail-dasha'}">
          <div class="dosha-item__header">
            <strong class="dosha-item__name">${mTitle}</strong>
            <span class="dosha-item__badge ${m.is_pass ? 'dosha-item__badge--pass' : 'dosha-item__badge--fail'}">${m.score}/10</span>
          </div>
          <div class="${m.is_pass ? 'dosha-item__desc--pass' : 'dosha-item__desc--fail'}">${mDesc}</div>
        </div>`;
    });
    bodyHtml += `</div></div>`;
  }

  // 12. Muhurta Dosha Pariharams (ముహూర్తములో దోషాలకు పరిహారములు)
  const pariharas = d?.pariharas;
  if (pariharas && pariharas.length > 0) {
    bodyHtml += `
      <div class="dosha-panel dosha-panel--pariharam">
        <div class="dosha-panel__header dosha-panel__header--pariharam">
          <span>🛡️ ${currentLang === "te" ? "ముహూర్తములో దోషాలకు పరిహారములు (Muhurta Dosha Remedies)" : "Muhurta Dosha Cancellation Remedies (Pariharams)"}</span>
          <span class="dosha-panel__score dosha-panel__score--pariharam">${pariharas.length} ${currentLang === "te" ? "పరిహారములు వర్తించును" : "Active Remedies"}</span>
        </div>
        <div class="dosha-panel__body dosha-panel__body--pariharam">`;
    pariharas.forEach(pr => {
      const prTitle = currentLang === "te" ? pr.name_te : pr.name_en;
      const prDesc = currentLang === "te" ? pr.desc_te : pr.desc_en;
      bodyHtml += `
        <div class="pariharam-item">
          <div class="pariharam-item__header">
            <strong class="pariharam-item__name">✨ ${prTitle}</strong>
            <span class="pariharam-item__badge">${pr.status}</span>
          </div>
          ${pr.shloka ? `<div class="pariharam-item__shloka">"${pr.shloka}"</div>` : ''}
          <div class="pariharam-item__desc">${prDesc}</div>
        </div>`;
    });
    bodyHtml += `</div></div>`;
  }

  el("modalBody").innerHTML = bodyHtml;
  el("muhurtaModal").style.display = "flex";
}

function closeMuhurtaModal() {
  el("muhurtaModal").style.display = "none";
}

function renderNamakarana(data) {
  currentNamakaranaData = data;
  el("namakaranaResults").style.display = "block";

  // Birth / Reference details header
  const b = data.birth_details;
  if (b.janma_nakshatra) {
    const birthNakTe = te(b.janma_nakshatra, NAKSHATRA_NAMES_TE) || b.janma_nakshatra;
    const padaLabel = currentLang === "te" ? "పాదం" : "pada";
    const bLagnaTe = te(b.birth_lagna, RASI_NAMES_TE) || b.birth_lagna || "";
    el("nbirthStar").textContent = `${birthNakTe} · ${padaLabel} ${b.janma_nakshatra_pada || 1} ${bLagnaTe ? `· ${bLagnaTe}` : ''}`;
  } else {
    const bLagnaTe = te(b.birth_lagna, RASI_NAMES_TE) || b.birth_lagna || "—";
    el("nbirthStar").textContent = currentLang === "te" ? `రిఫరెన్స్ లగ్నం: ${bLagnaTe}` : `Reference Lagna: ${bLagnaTe}`;
  }

  const bdtText = currentLang === "te" ?
    `తేదీ: ${b.dob} · సమయం: ${b.tob} · స్థలం: ${b.place}` :
    `Date: ${b.dob} · Time: ${b.tob} · Place: ${b.place}`;
  el("nbirthDetails").textContent = bdtText;

  // Update Results Header Title
  const sMeta = data.samskara || SAMSKARAS_CONFIG[currentActiveSamskara] || SAMSKARAS_CONFIG.namakarana;
  const sName = currentLang === "te" ? sMeta.name_te : sMeta.name_en;
  const candCount = (data.candidates || []).length;
  const hdrTitle = el("samskaraResultsHeaderTitle");
  if (hdrTitle) {
    hdrTitle.textContent = currentLang === "te" ? 
      `శుభ ముహూర్తములు: ${sName} (${candCount} రోజులు పరిశీలించబడినవి)` : 
      `Auspicious Muhurtas: ${sName} (${candCount} Dates Evaluated)`;
  }

  // Birth D1 Chart
  const birthCenterTitle = currentLang === "te" ? "జన్మ (D1)<br>చక్రం" : "BIRTH (D1)<br>CHART";
  el("d1ChartContainer").innerHTML = buildD1ChartHTML(b.d1_chart, birthCenterTitle, false);

  // Candidates
  const listDiv = el("namakaranaList");
  listDiv.innerHTML = "";

  data.candidates.forEach((c, idx) => {
    const pct = c.percentage;
    const isAvoid = pct <= 10;
    const isGood = pct >= 75;
    const badgeClass = isAvoid ? "avoid" : (isGood ? "favorable" : "mixed");
    const badgeText = currentLang === "te" ?
      (isAvoid ? "నిషిద్ధం" : (isGood ? "ఉత్తమ ముహూర్తం" : "మధ్యమ ముహూర్తం")) :
      (isAvoid ? "Avoid" : (isGood ? "Excellent" : "Medium"));

    const dateStr = c.date;
    const dayLabelText = currentLang === "te" ? 
      (c.day_label_te || `జన్మదినం నుండి ${c.day_number}వ రోజు`) : 
      (c.day_label_en || `Day ${c.day_number} from Birth`);

    // Anga translations
    const vaaraTe = VAARA_NAMES[currentLang][c.panchang.vaara] || c.panchang.vaara;
    const nakTe = te(c.panchang.nakshatra, NAKSHATRA_NAMES_TE);

    let tithiFull = c.panchang.tithi;
    const tName = tithiFull.split(" ")[0];
    const pName = tithiFull.includes("Shukla") ? "Shukla" : "Krishna";
    const tNameTe = te(tName, TITHI_NAMES_TE);
    const pNameTe = PAKSHA_NAMES[currentLang][pName] || pName;
    const tithiTe = `${tNameTe} (${pNameTe})`;

    const taraTe = te(c.tara, TARA_NAMES_TE);

    const infoSubtitle = currentLang === "te" ?
      `వారం: ${vaaraTe} · తిథి: ${tithiTe} · నక్షత్రం: ${nakTe} · తారాబలం: ${taraTe}` :
      `Weekday: ${vaaraTe} · Tithi: ${tithiTe} · Nakshatra: ${nakTe} · Tarabalam: ${c.tara}`;

    // Reasons bullet list
    let bulletsHtml = "";
    c.reasons.forEach(r => {
      let text = r;
      if (currentLang === "te") {
        text = text
          .replace("is favorable", "అనుకూలముగా ఉన్నది")
          .replace("is unfavorable", "అనుకూలముగా లేదు")
          .replace("is not recommended", "నిర్ణీత నక్షత్రముల యందు లేదు")
          .replace("must be avoided!", "నిషేధించబడినది!")
          .replace("Tarabalam is", "తారాబలం:")
          .replace("unfavorable", "అనుకూలముగా లేదు")
          .replace("favorable", "అనుకూలముగా ఉన్నది")
          .replace("Nakshatra", "నక్షత్రం")
          .replace("Tithi", "తిథి")
          .replace("Ashtama Lagna Dosha (Muhurta Lagna is the 8th house from birth Lagna)!", "అష్టమ లగ్న దోషం (ముహూర్త లగ్నం జన్మ లగ్నం నుండి 8వ ఇల్లు)!")
          .replace("No Ashtama Shuddhi (", "అష్టమ శుద్ధి లేదు (")
          .replace(" in 8th house from Lagna)!", " లగ్నం నుండి 8వ ఇంట్లో ఉన్నారు)!")
          .replace("Ashtama Shuddhi is clean (8th house is vacant).", "అష్టమ శుద్ధి బాగుంది (8వ ఇల్లు ఖాళీగా ఉంది).")
          .replace("Avoid: Unfavorable ", "నిషేధించబడినది: అశుభమైన ")
          .replace(" yoga!", " యోగం!")
          .replace(" karana!", " కరణం!")
          .replace("Sun", "సూర్యుడు")
          .replace("Moon", "చంద్రుడు")
          .replace("Mars", "కుజుడు")
          .replace("Mercury", "బుధుడు")
          .replace("Jupiter", "గురుడు")
          .replace("Venus", "శుక్రుడు")
          .replace("Saturn", "శని")
          .replace("Rahu", "రాహువు")
          .replace("Ketu", "కేతువు");
      }
      bulletsHtml += `<li>${text}</li>`;
    });

    const pushkara = c.pushkara_info;
    let pushkaraHtml = "";
    if (pushkara) {
      const pushType = currentLang === "te" ? pushkara.type_te : pushkara.type_en;
      const pushLagna = currentLang === "te" ? te(pushkara.lagna_name, RASI_NAMES_TE) : pushkara.lagna_name;
      const statement = currentLang === "te" ? pushkara.statement_te : pushkara.statement_en;

      let cardSubDetails = [];
      if (pushkara.pushkara_bhaga && pushkara.pushkara_bhaga.is_available) {
        const pb = pushkara.pushkara_bhaga;
        cardSubDetails.push(currentLang === "te" ?
          `📌 <strong>పుష్కర భాగ సమయం:</strong> ${pb.precise_time} (వ్యవధి: ${pb.time_window})` :
          `📌 <strong>Pushkara Bhaga Time:</strong> ${pb.precise_time} (Range: ${pb.time_window})`
        );
      }
      if (pushkara.pushkara_navamsha && pushkara.pushkara_navamsha.is_available) {
        const pn = pushkara.pushkara_navamsha;
        cardSubDetails.push(currentLang === "te" ?
          `📌 <strong>పుష్కర నవాంశ సమయం:</strong> ${pn.precise_time} (వ్యవధి: ${pn.time_window})` :
          `📌 <strong>Pushkara Navamsha Time:</strong> ${pn.precise_time} (Range: ${pn.time_window})`
        );
      }
      if (cardSubDetails.length === 0) {
        cardSubDetails.push(currentLang === "te" ?
          `📌 <strong>శుభ ముహూర్త సమయ వ్యవధి:</strong> ${pushkara.time_window}` :
          `📌 <strong>Auspicious Window:</strong> ${pushkara.time_window}`
        );
      }

      const noteText = currentLang === "te" ? pushkara.avoid_note_te : pushkara.avoid_note_en;
      const noteBadge = noteText ? `
        <div class="samskara-note-badge">
          ⚠️ ${currentLang === "te" ? "గమనిక:" : "Note:"} ${noteText}
        </div>
      ` : '';

      pushkaraHtml = `
        <div class="samskara-pushkara-box">
          <strong class="samskara-pushkara-title">⏰ ${statement}</strong>
          <div class="samskara-pushkara-details">
            ${cardSubDetails.join("<br>")}
            ${noteBadge ? `<br>${noteBadge}` : ''}
            <br>🏛️ <strong>${currentLang === "te" ? "లగ్న కాలము (లగ్నాంతాలు):" : "Lagna Duration:"}</strong> ${pushkara.lagna_full_window || pushkara.lagna_duration || "—"} (${pushLagna || ''} ${pushType || ''})
          </div>
        </div>
      `;
    }

    let specYogasHtml = "";
    if (c.special_yogas && c.special_yogas.length > 0) {
      c.special_yogas.forEach(y => {
        const yName = currentLang === "te" ? y.name_te : y.name_en;
        const yDesc = currentLang === "te" ? y.desc_te : y.desc_en;
        let yogaClass = "yoga-item--good";
        if (y.type === "bad") { yogaClass = "yoga-item--bad"; }
        else if (y.type === "info") { yogaClass = "yoga-item--info"; }
        specYogasHtml += `
          <div class="yoga-item yoga-item--compact ${yogaClass}">
            ✨ ${yName} — <span class="yoga-item__desc">${yDesc}</span>
          </div>
        `;
      });
    }

    listDiv.innerHTML += `
  <div class="activity-item activity-item--muhurta" onclick="openMuhurtaModal(${idx})">
    <div class="activity-name">
      <span><strong>${dayLabelText}</strong> (${dateStr})</span>
    </div>
    <div class="activity-subtitle">
      ${infoSubtitle}
    </div>
    ${pushkaraHtml}
    ${specYogasHtml}
    <ul class="activity-reasons">
      ${bulletsHtml}
    </ul>
    <div class="activity-actions">
      <button type="button" onclick="event.stopPropagation(); openMuhurtaModal(${idx})" class="btn btn--primary btn--sm">
        🔍 ${currentLang === "te" ? "సమగ్ర విశ్లేషణ & D1 చక్రం చూడండి ➔" : "View Full Analysis & D1 Chart Popup ➔"}
      </button>
    </div>
  </div>
`;
  });
}



