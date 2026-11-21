// ============================================================
// Muhurtham App · component: EN/TE language system
// ============================================================
// ---- Language system ----
// The chosen language is kept in this browser (21 Nov 2026), so it applies on every page and every open tab:
// a change in one tab switches the others at once (the "storage" event). Before, each page started in English.
const LANG_KEY = "gj_lang";
function savedLang() {
  try { const v = localStorage.getItem(LANG_KEY); return v === "te" || v === "en" ? v : null; }
  catch (e) { return null; }          // private mode or blocked storage: the page still works, in English
}
let currentLang = savedLang() || "en";

// ---- Translations (21 Nov 2026): all Telugu page text lives in i18n/te.js (window.I18N_TE), loaded just
// before this file. Pages are written in English:
//   t("Add a person")                        → the Telugu from te.js in Telugu mode, else the English
//   t("Disable {name}?", { name: p.name })   → {placeholders} filled in after the lookup
//   t("Add a person@@family")                → "@@context" picks a separate te.js entry when one English text
//                                              needs two Telugu wordings; the English shown drops "@@…"
//   <span data-i18n>Add a person</span>      → the element's English text is the key
//   data-i18n-placeholder / -title / -aria-label="English"  → the same for those attributes
// A text missing from te.js shows in English and is listed once on the browser console.
const I18N_TE = (typeof window !== "undefined" && window.I18N_TE) || {};
const i18nMissing = new Set();
function t(key, vars) {
  const k = String(key);
  const cut = k.indexOf("@@");
  let s = cut >= 0 ? k.slice(0, cut) : k;
  if (currentLang === "te") {
    const te = I18N_TE[k] || (cut >= 0 ? I18N_TE[s] : undefined);
    if (te) s = te;
    else if (!i18nMissing.has(k)) { i18nMissing.add(k); console.info("[i18n] No Telugu in i18n/te.js for:", k); }
  }
  return vars ? s.replace(/\{(\w+)\}/g, (m, name) => (name in vars && vars[name] != null ? String(vars[name]) : m)) : s;
}
// Data that arrives in both languages (server fields such as name_en / name_te, the book's texts): pick the
// one for the page's language. This is for data only; page wording goes through t() and i18n/te.js.
function pickLang(en, te) { return currentLang === "te" ? (te || en) : en; }
const I18N_ATTRS = ["placeholder", "title", "aria-label"];
function applyI18n(root) {
  const scope = root || document;
  scope.querySelectorAll("[data-i18n]").forEach(node => {
    // The element's own text is the key; line breaks from HTML formatting count as one space.
    if (node.dataset.i18nKey === undefined) node.dataset.i18nKey = node.getAttribute("data-i18n") || node.textContent.replace(/\s+/g, " ").trim();
    node.textContent = t(node.dataset.i18nKey);
  });
  I18N_ATTRS.forEach(attr => {
    scope.querySelectorAll("[data-i18n-" + attr + "]").forEach(node => node.setAttribute(attr, t(node.getAttribute("data-i18n-" + attr))));
  });
}

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

function setLang(lang, opts) {
  if (lang !== "te" && lang !== "en") return;
  currentLang = lang;
  if (!(opts && opts.fromOtherTab)) {
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* not saved: this page still switches */ }
  }
  document.documentElement.lang = lang;   // css/base.css gives Telugu text more height (Experience Plan U2)
  const langEn = el("langEn"), langTe = el("langTe");
  if (langEn && langTe) {
    langEn.className = "lang-btn" + (lang === "en" ? " active" : "");
    langTe.className = "lang-btn" + (lang === "te" ? " active" : "");
  }

  // Pages moved to i18n/te.js (data-i18n), then the older data-en / data-te labels still being moved
  applyI18n();
  document.querySelectorAll("[data-en]").forEach(elem => {
    elem.textContent = elem.getAttribute("data-" + lang) || elem.getAttribute("data-en");
  });

  // Re-render if we have data (panels are page-optional)
  if (typeof lastPanchang !== "undefined" && lastPanchang && typeof render === "function") render(lastPanchang);
  if (typeof populateActivityDropdown === "function") {
    populateActivityDropdown();
  }
  if (window.Auth) Auth.renderMenu();
  if (window.SiteConfig && SiteConfig.applyTexts) SiteConfig.applyTexts();   // Settings › Texts in the new language
  if (typeof window.onLangChange === "function") window.onLangChange();
}

let lastPanchang = null;

function setStatus(msg, isError) {
  const s = el("status") || el("mfStatus");
  if (!s) return;
  s.textContent = msg || "";
  s.className = "status" + (isError ? " error" : "");
}


// Apply the saved language when the page opens, and follow changes made in other tabs.
function hasSavedLang() { return savedLang() !== null; }
(function applySavedLang() {
  const start = () => { if (currentLang !== "en") setLang(currentLang, { fromOtherTab: true }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.addEventListener("storage", e => {
    if (e.key === LANG_KEY && (e.newValue === "te" || e.newValue === "en") && e.newValue !== currentLang) {
      setLang(e.newValue, { fromOtherTab: true });
    }
  });
})();
