// ============================================================
// Muhurtham App · component: EN/TE language system
// ============================================================
// ---- Language system ----
let currentLang = "en";

const RASI_NAMES = {
  en: ["Mesha", "Vrishabha", "Mithuna", "Karkataka", "Simha", "Kanya",
    "Tula", "Vrishchika", "Dhanus", "Makara", "Kumbha", "Meena"],
  te: ["మేషం", "వృషభం", "మిథునం", "కర్కాటకం", "సింహం", "కన్య",
    "తుల", "వృశ్చికం", "ధనుస్సు", "మకరం", "కుంభం", "మీనం"]
};

const RASI_NAMES_TE = {
  "Mesha": "మేష", "Vrishabha": "వృషభ", "Mithuna": "మిథున", "Karkataka": "కర్కాటక",
  "Simha": "సింహ", "Kanya": "కన్యా", "Tula": "తుల", "Vrishchika": "వృశ్చిక",
  "Dhanus": "ధనుస్సు", "Makara": "మకర", "Kumbha": "కుంభ", "Meena": "మీన"
};

const VAARA_NAMES = {
  en: {
    Sunday: "Sunday", Monday: "Monday", Tuesday: "Tuesday", Wednesday: "Wednesday",
    Thursday: "Thursday", Friday: "Friday", Saturday: "Saturday"
  },
  te: {
    Sunday: "ఆదివారం", Monday: "సోమవారం", Tuesday: "మంగళవారం", Wednesday: "బుధవారం",
    Thursday: "గురువారం", Friday: "శుక్రవారం", Saturday: "శనివారం"
  }
};

const PAKSHA_NAMES = {
  en: { Shukla: "Shukla", Krishna: "Krishna", shukla: "Shukla", krishna: "Krishna" },
  te: { Shukla: "శుక్ల", Krishna: "కృష్ణ", shukla: "శుక్ల", krishna: "కృష్ణ" }
};

const NAKSHATRA_NAMES_TE = {
  "Ashwini": "అశ్విని", "Bharani": "భరణి", "Krittika": "కృత్తిక",
  "Rohini": "రోహిణి", "Mrigashira": "మృగశిర", "Ardra": "ఆర్ద్ర",
  "Punarvasu": "పునర్వసు", "Pushya": "పుష్యమి", "Ashlesha": "ఆశ్లేష",
  "Magha": "మఖ", "Purva Phalguni": "పూర్వ ఫల్గుణి", "Uttara Phalguni": "ఉత్తర ఫల్గుణి",
  "Hasta": "హస్త", "Chitra": "చిత్త", "Swati": "స్వాతి",
  "Vishakha": "విశాఖ", "Anuradha": "అనురాధ", "Jyeshtha": "జ్యేష్ఠ",
  "Mula": "మూల", "Purva Ashadha": "పూర్వాషాఢ", "Uttara Ashadha": "ఉత్తరాషాఢ",
  "Shravana": "శ్రవణం", "Dhanishtha": "ధనిష్ఠ", "Shatabhisha": "శతభిషం",
  "Purva Bhadrapada": "పూర్వాభాద్ర", "Uttara Bhadrapada": "ఉత్తరాభాద్ర", "Revati": "రేవతి"
};

const TITHI_NAMES_TE = {
  "Prathama": "పాడ్యమి", "Dwitiya": "విదియ", "Tritiya": "తదియ",
  "Chaturthi": "చవితి", "Panchami": "పంచమి", "Shashti": "షష్ఠి",
  "Saptami": "సప్తమి", "Ashtami": "అష్టమి", "Navami": "నవమి",
  "Dashami": "దశమి", "Ekadashi": "ఏకాదశి", "Dwadashi": "ద్వాదశి",
  "Trayodashi": "త్రయోదశి", "Chaturdashi": "చతుర్దశి",
  "Purnima": "పూర్ణిమ", "Amavasya": "అమావాస్య"
};

const YOGA_NAMES_TE = {
  "Vishkambha": "విష్కంభ", "Priti": "ప్రీతి", "Ayushman": "ఆయుష్మాన్",
  "Saubhagya": "సౌభాగ్య", "Shobhana": "శోభన", "Atiganda": "అతిగండ",
  "Sukarma": "సుకర్మ", "Dhriti": "ధృతి", "Shula": "శూల",
  "Ganda": "గండ", "Vriddhi": "వృద్ధి", "Dhruva": "ధ్రువ",
  "Vyaghata": "వ్యాఘాత", "Harshana": "హర్షణ", "Vajra": "వజ్ర",
  "Siddhi": "సిద్ధి", "Vyatipata": "వ్యతీపాత", "Variyana": "వరీయాన్",
  "Parigha": "పరిఘ", "Shiva": "శివ", "Siddha": "సిద్ధ",
  "Sadhya": "సాధ్య", "Shubha": "శుభ", "Shukla": "శుక్ల",
  "Brahma": "బ్రహ్మ", "Indra": "ఇంద్ర", "Vaidhriti": "వైధృతి"
};

const KARANA_NAMES_TE = {
  "Bava": "బవ", "Balava": "బాలవ", "Kaulava": "కౌలవ", "Taitila": "తైతిల",
  "Gara": "గర", "Vanija": "వణిజ", "Vishti (Bhadra)": "విష్టి (భద్ర)",
  "Shakuni": "శకుని", "Chatushpada": "చతుష్పద", "Naga": "నాగ", "Kimstughna": "కింస్తుఘ్న"
};

const MONTH_NAMES_TE = {
  "Chaitra": "చైత్రం", "Vaishakha": "వైశాఖం", "Jyeshtha": "జ్యేష్ఠం",
  "Ashadha": "ఆషాఢం", "Shravana": "శ్రావణం", "Bhadrapada": "భాద్రపదం",
  "Ashwina": "ఆశ్వయుజం", "Kartika": "కార్తీకం", "Margashira": "మార్గశిరం",
  "Pushya": "పుష్యం", "Magha": "మాఘం", "Phalguna": "ఫాల్గుణం"
};

function te(name, map) {
  return currentLang === "te" ? (map[name] || name) : name;
}

function setLang(lang) {
  currentLang = lang;
  const langEn = el("langEn"), langTe = el("langTe");
  if (langEn && langTe) {
    langEn.className = "lang-btn" + (lang === "en" ? " active" : "");
    langTe.className = "lang-btn" + (lang === "te" ? " active" : "");
  }

  // Update all data-en / data-te labels
  document.querySelectorAll("[data-en]").forEach(elem => {
    elem.textContent = elem.getAttribute("data-" + lang) || elem.getAttribute("data-en");
  });

  // Re-render if we have data (panels are page-optional)
  if (typeof lastPanchang !== "undefined" && lastPanchang && typeof render === "function") render(lastPanchang);
  if (typeof setupSamskaraView === "function" && typeof currentActiveSamskara !== "undefined") {
    setupSamskaraView(currentActiveSamskara);
  }
  if (typeof currentNamakaranaData !== "undefined" && currentNamakaranaData && typeof renderNamakarana === "function") {
    renderNamakarana(currentNamakaranaData);
  }
}

let lastPanchang = null;

function setStatus(msg, isError) {
  const s = el("status") || el("mfStatus") || el("statusCheckpoint");
  if (!s) return;
  s.textContent = msg || "";
  s.className = "status" + (isError ? " error" : "");
}
