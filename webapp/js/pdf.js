// ============================================================
// Muhurtham App · component: PDF doc builders
// (panchang; the samskara PDFs were retired with the old samskara mode, plan R4)
// requires: js/pdf-core.js (font pipeline, exportPdf)
// ============================================================

function buildPanchangDoc(P) {
  const te_ = currentLang === "te";
  const content = [
{ text: te_ ? "దృక్ పంచాంగం" : "Drik Panchang Summary", style: "title" },
{ text: [P.date, P.place, P.time].filter(Boolean).join(" · "), style: "subtitle", margin: [0, 2, 0, 10] },
  ];

  const cm = P.chandramana || {};
  if (cm) {
const cmLine = [cm.samvatsara_telugu || cm.samvatsara_name, cm.ayanam_te || cm.ayanam_en, cm.ruthu_te || cm.ruthu_en, cm.month_telugu || cm.month_name, cm.paksha_te || cm.paksha_en].filter(Boolean).join(" · ");
if (cmLine) content.push({ text: cmLine, style: "h2", color: "#5d4037" });
  }

  const mainRows = [
[te_ ? "వారం" : "Weekday", te_ ? (VAARA_NAMES.te[P.vaara] || P.vaara || "—") : (P.vaara || "—")],
[te_ ? "తిథి" : "Tithi", P.tithi ? ((P.tithi.name || "") + ((P.tithi.name && P.tithi.paksha) ? " (" + P.tithi.paksha + ")" : "")) : "—"],
[te_ ? "నక్షత్రం" : "Nakshatra", P.nakshatra ? (pdfNakTe(P.nakshatra.name) + (P.nakshatra.pada ? " (" + P.nakshatra.pada + (te_ ? " పాదం" : " pada") + ")" : "")) : "—"],
[te_ ? "యోగం" : "Yoga", pdfVal(P.yoga) || "—"],
[te_ ? "కరణం" : "Karana", pdfVal(P.karana) || "—"],
[te_ ? "సూర్యోదయం" : "Sunrise", P.sunrise || "—"],
[te_ ? "సూర్యాస్తమయం" : "Sunset", P.sunset || "—"],
[te_ ? "లగ్నం (ఉదయం)" : "Lagna (Morning)", te_ ? pdfLagnaTe(P.lagna_rasi) : (P.lagna_rasi || "—")],
  ];
  // Rahu, Yama, Gulika, Durmuhurta, Abhijit, Brahma, Godhuli, Varjyam, Amrit
  const kRows = [
["రాహు కాలం / Rahu Kalam", pdfT(P.rahu_kalam)],
["యమగండం / Yamagandam", pdfT(P.yamagandam)],
["గుళిక కాలం / Gulika Kalam", pdfT(P.gulika_kalam)],
["దుర్ముహూర్తం / Durmuhurtam", Array.isArray(P.durmuhurtam) ? P.durmuhurtam.map(pdfT).join("; ") : pdfT(P.durmuhurtam)],
["అభిజిత్ / Abhijit", pdfT(P.abhijit_muhurta)],
["బ్రహ్మ ముహూర్తం / Brahma", pdfT(P.brahma_muhurta)],
["గోధూళి / Godhuli", pdfT(P.godhuli_muhurta)],
["వర్జ్యం / Varjyam", pdfT(P.varjyam)],
["అమృత కాలం / Amrit Kalam", pdfT(P.amrit_kalam)],
  ];

  content.push({ text: te_ ? "ప్రధాన పంచాంగ వివరాలు" : "Main Panchang", style: "h2" },
{ table: { widths: [110, "*"], body: mainRows.map(([k, v]) => [{ text: k, style: "tdb" }, { text: String(v), style: "td" }]) }, margin: [0, 0, 0, 10] });
  content.push({ text: te_ ? "శుభాశుభ కాలములు" : "Auspicious / Inauspicious Times", style: "h2" },
{ table: { widths: ["45%", "*"], body: kRows.map(([k, v]) => [{ text: k, style: "tdb" }, { text: String(v), style: "td" }]) }, margin: [0, 0, 0, 10] });

  // Special yogas
  const sy = P.special_yogas;
  if (sy) {
content.push({ text: te_ ? "విశేష యోగములు" : "Special Yogas", style: "h2" });
const syRows = Array.isArray(sy) ? sy.map(x => typeof x === "string" ? x : ((x.name || x.name_te || x.name_en || "") + (x.description || x.desc || x.effect || "" ? " — " + (x.description || x.desc || x.effect) : ""))) : Object.entries(sy).map(([k, v]) => k + ": " + v);
syRows.filter(String).forEach(r => content.push({ ul: [r], margin: [0, 0, 0, 3] }));
content.push({ text: "", margin: [0, 0, 0, 6] });
  }

  const pan = P.panchaka_rahitam;
  if (pan && (pan.name_te || pan.name_en)) {
content.push({ text: te_ ? "పంచక రహితం" : "Panchaka Rahitam", style: "h2" });
content.push({ table: { widths: [110, "*"], body: [
  [te_ ? "వర్గీకరణ" : "Classification", te_ ? (pan.name_te || "—") : (pan.name_en || "—")],
  [te_ ? "ఫలితం" : "Effect", (te_ ? (pan.effect_te || "—") : (pan.effect_en || "—"))],
] } });
  }

  const ls = P.lagna_schedule;
  if (Array.isArray(ls) && ls.length) {
content.push({ text: te_ ? "లగ్న సమయ పట్టిక" : "Lagna Schedule", style: "h2" });
const lRows = [[{ text: te_ ? "సమయం" : "Time", style: "th" }, { text: te_ ? "లగ్నం" : "Lagna", style: "th" }]];
ls.forEach(x => {
  const t = pdfT(x), n = x.lagna_rasi || x.rasi || x.name || "—";
  lRows.push([{ text: t, style: "td" }, { text: pdfLagnaTe(n), style: "td" }]);
});
content.push({ table: { widths: ["40%", "*"], body: lRows }, margin: [0, 0, 0, 8] });
  }

  return Object.assign({ content }, PDF_BASE);
}

/* ---------- Dispatchers ---------- */
// Normalize a possibly-object panchang field ({name,...}) to a display string
function exportPdf(name, doc) {
  try {
const fixed = applyPdfFonts(JSON.parse(JSON.stringify(doc)));
pdfMake.createPdf(fixed).download(name);
  } catch (e) {
console.error("PDF download failed:", e);
alert("PDF generation failed: " + e.message);
  }
}

async function exportPanchangPdf(button) {
  if (!lastPanchang) { return; }
  // Printed on the server (plan R8) so Telugu conjuncts come out right; pdfmake can't join them.
  const P = lastPanchang.panchang || {};
  const te_ = currentLang === "te";
  return PdfDownload.fromElement("results", {
    kind: "panchang",
    title: (te_ ? "పంచాంగం · " : "Panchang · ") + (P.date || ""),
    subtitle: P.place_name || P.place || lastPanchang.place_name || "",
    filename: PdfDownload.fileName("panchang", P.date),
  }, button || document.getElementById("printSmartBtn"));
}

async function exportSmartPdf() {
  return exportPanchangPdf();
}
