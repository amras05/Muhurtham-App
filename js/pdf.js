// ============================================================
// Muhurtham App · component: PDF doc builders
// (panchang + samskara candidates + candidate detail)
// requires: js/pdf-core.js (font pipeline, exportPdf)
// ============================================================

async function buildSamskaraDoc(data) {
  const cfg = SAMSKARAS_CONFIG[currentActiveSamskara] || SAMSKARAS_CONFIG.namakarana;
  const te_ = currentLang === "te";
  const b = data.birth_details || {};
  const content = [
{ text: te_ ? `${cfg.name_te} — ముహూర్త ఫలితాలు` : `${cfg.name_en} — Muhurtha Results`, style: "title" },
{ text: cfg.rules_te, style: "subtitle", margin: [0, 4, 0, 10] },
  ];

  // Birth details
  const birthRows = [];
  if (b && (b.dob || b.date || b.birth_dob)) {
const parts = [
  [te_ ? "జన్మ తేదీ / సమయం" : "Date / Time of birth", [b.dob, b.tob || b.birth_tob].filter(Boolean).join(", ") || [b.date, b.tob].filter(Boolean).join(", ")],
  [te_ ? "జన్మ స్థలం" : "Place", b.place || b.place_name || ""],
  [te_ ? "జన్మ నక్షత్రం" : "Janma Nakshatra", pdfNakTe(b.janma_nakshatra) + (b.janma_nakshatra_pada ? " (" + b.janma_nakshatra_pada + (te_ ? " పాదం" : " pada") + ")" : "")],
  [te_ ? "జన్మ రాశి" : "Janma Rasi", pdfLagnaTe(b.birth_moon_rasi)],
];
parts.forEach(([k, v]) => { if (v) birthRows.push([{ text: k, style: "tdb" }, { text: v, style: "td" }]); });
  }

  if (b.birth_details) { // some payloads nest birth_details inside itself
const bb = b.birth_details;
const parts2 = [
  [te_ ? "జన్మ నక్షత్రం" : "Janma Nakshatra", pdfNakTe(bb.janma_nakshatra)],
  [te_ ? "జన్మ రాశి" : "Janma Rasi", pdfLagnaTe(bb.birth_moon_rasi)],
  [te_ ? "జన్మ పాదం" : "Janma Pada", bb.janma_nakshatra_pada],
];
parts2.forEach(([k, v]) => { if (v) birthRows.push([{ text: k, style: "tdb" }, { text: v, style: "td" }]); });
  }

  if (birthRows.length) {
content.push({ text: te_ ? "జాతక సమాచారం" : "Native Details", style: "h2" },
  { table: { widths: [150, "*"], body: birthRows }, margin: [0, 0, 0, 8] });
  }

  // Summary table
  content.push({ text: te_ ? "శుభ ముహూర్త అభ్యర్థులు" : "Candidate Muhurtas", style: "h2" });
  const sumRows = [[
{ text: te_ ? "తేదీ" : "Date", style: "th" },
{ text: te_ ? "వారం" : "Day", style: "th" },
{ text: te_ ? "తిథి" : "Tithi", style: "th" },
{ text: te_ ? "నక్షత్రం" : "Nakshatra", style: "th" },
{ text: te_ ? "లగ్నం" : "Lagna", style: "th" },
{ text: te_ ? "ఎల్లిక" : "Verdict", style: "th" },
{ text: te_ ? "స్కోరింగ్" : "Score", style: "th" },
  ]];
  (data.candidates || []).forEach((c) => {
const p = c.panchang || {};
sumRows.push([
  { text: c.date || "—", style: "tdb" },
  { text: (te_ && (c.day_label_te || c.day_label_en)) || c.day_label_en || c.day_label_te || "—", style: "td" },
  { text: p.tithi || "—", style: "td" },
  { text: pdfNakTe(p.nakshatra), style: "td" },
  { text: pdfLagnaTe(c.lagna_name || (p.lagna_rasi !== undefined ? p.lagna_rasi : "")), style: "td" },
  { text: pdfVerdictText(c.verdict), style: pdfVerdictStyle(c.percentage) },
  { text: c.percentage !== undefined ? (c.percentage + "%") : "—", style: "tdb" },
]);
  });
  content.push({ table: { widths: [62, 55, 70, 70, 62, 70, 45], body: sumRows, keepInMemory: true }, margin: [0, 0, 0, 4] });

  // Detail sections (top candidates with best-window / reasons)
  (data.candidates || []).slice(0, 10).forEach((c) => {
if (c.percentage !== undefined && c.percentage <= 10) return; // skip avoid rows in detail
const det = [];
const push = c.pushkara_info;
if (push) {
  det.push([
    { text: te_ ? (push.type_te || "పుష్కర") : (push.type_en || "Pushkara"), style: "tdb" },
    { text: (te_ ? push.statement_te : push.statement_en) || push.statement || "—", style: "td" },
  ]);
  if (push.precise_time || push.time_window) {
    det.push([{ text: te_ ? "సమయం" : "Time", style: "tdb" },
              { text: push.precise_time || push.time_window || "—", style: "td" }]);
  }
  if (push.avoid_note) {
    det.push([{ text: te_ ? "గమనిక" : "Note", style: "tdb" },
              { text: (te_ ? push.avoid_note_te : push.avoid_note_en) || push.avoid_note, style: "td" }]);
  }
}
const cb = c.chandrabalam || (c.detailed_eval && c.detailed_eval.chandrabalam) || (c.panchang && c.panchang.chandrabalam);
if (cb && cb.desc_te) {
  det.push([{ text: te_ ? "చంద్రబలం" : "Chandrabalam", style: "tdb" },
            { text: te_ ? cb.desc_te : (cb.desc_en || cb.desc_te), style: "td" }]);
}
const pReasons = (c.reasons || []).filter(Boolean);
if (pReasons.length) {
  det.push([{ text: te_ ? "కారణాలు" : "Reasons", style: "tdb" }, ...pReasons]);
}
if (det.length) {
  content.push({ text: (c.date || "") + (c.day_label_te && te_ ? " — " + c.day_label_te : ""), style: "h2" });
  det.forEach((row) => {
    const [label, ...rest] = row;
    const labelNode = (label && typeof label === "object") ? label : { text: String(label), style: "tdb" };
    if (rest.length > 1) {
      // reasons-style row: label + multiple strings
      const items = rest.map((x) => (typeof x === "string" ? x : (x && x.text) || String(x)));
      content.push({
        table: { widths: [110, "*"], body: [[labelNode, { ul: items, style: "td" }]] },
        margin: [0, 0, 0, 5],
      });
    } else {
      const value = rest[0];
      const valueNode = (value && typeof value === "object") ? value : { text: value === undefined || value === null ? "" : String(value), style: "td" };
      content.push({
        table: { widths: [110, "*"], body: [[labelNode, valueNode]] },
        margin: [0, 0, 0, 5],
      });
    }
  });
}
  });

  return Object.assign({ content }, PDF_BASE);
}

/* ---------- Single candidate detail PDF (modal button) ---------- */
async function buildCandidateDoc(data, idx) {
  await loadPdfFonts();
  const cfg = SAMSKARAS_CONFIG[currentActiveSamskara] || SAMSKARAS_CONFIG.namakarana;
  const c = data.candidates[idx];
  if (!c) return null;
  const b = data.birth_details || {};
  const p = c.panchang || {};
  const d = c.detailed_eval || {};

  const cm = p.chandramana || {};
  const cmLine = cm ? [
cm.samvatsara_telugu || cm.samvatsara_name,
cm.ayanam_te || cm.ayanam_en,
cm.ruthu_te || cm.ruthu_en,
cm.month_telugu || cm.month_name,
cm.paksha_te || cm.paksha_en,
  ].filter(Boolean).join(" · ") : "—";

  const content = [
{ text: currentLang === "te" ? `${cfg.name_te}` : `${cfg.name_en}`, style: "title" },
{ text: (c.date || "") + " · " + (currentLang === "te" ? (c.day_label_te || "") : (c.day_label_en || "")) + " · " + (c.percentage !== undefined ? c.percentage + "%" : ""), style: "subtitle", margin: [0, 2, 0, 10] },
  ];

  const rows = [
[currentLang === "te" ? "స్థలం" : "Place", b.place || b.place_name || data.place_name || "—"],
[currentLang === "te" ? "సూర్యోదయం" : "Sunrise", p.sunrise || "—"],
[currentLang === "te" ? "సూర్యాస్తమయం" : "Sunset", p.sunset || "—"],
[currentLang === "te" ? "వారం" : "Weekday", currentLang === "te" ? (VAARA_NAMES.te[p.vaara] || p.vaara || "—") : (p.vaara || "—")],
[currentLang === "te" ? "తిథి" : "Tithi", p.tithi || "—"],
[currentLang === "te" ? "నక్షత్రం" : "Nakshatra", pdfNakTe(p.nakshatra)],
[currentLang === "te" ? "తారాబలం" : "Tarabalam", pdfTaraTe(c.tara)],
[currentLang === "te" ? "యోగం" : "Yoga", pdfVal(p.yoga) || "—"],
[currentLang === "te" ? "కరణం" : "Karana", pdfVal(p.karana) || "—"],
[currentLang === "te" ? "చంద్రమానం" : "Chandramana", cmLine],
[currentLang === "te" ? "లగ్నం" : "Lagna", pdfLagnaTe(c.lagna_name)],
[currentLang === "te" ? "ఎల్లిక" : "Verdict", pdfVerdictText(c.verdict)],
  ];
  content.push({ table: { widths: [120, "*"], body: rows.map(([k, v]) => [{ text: k, style: "tdb" }, { text: String(v), style: "td" }]) }, margin: [0, 0, 0, 10] });

  if (b && (b.janma_nakshatra || b.birth_moon_rasi)) {
content.push({ text: currentLang === "te" ? "జాతక సమాచారం" : "Native Details", style: "h2" });
content.push({ table: { widths: [120, "*"], body: [
  [currentLang === "te" ? "జన్మ నక్షత్రం" : "Janma Nakshatra", (pdfNakTe(b.janma_nakshatra) || "—") + (b.janma_nakshatra_pada ? " (" + b.janma_nakshatra_pada + " పాదం)" : "")],
  [currentLang === "te" ? "జన్మ రాశి" : "Janma Rasi", pdfLagnaTe(b.birth_moon_rasi)],
] } });
  }

  const push = c.pushkara_info;
  if (push) {
content.push({ text: currentLang === "te" ? "శుభ ముహూర్త నిర్ణయం" : "Recommended Time Prediction", style: "h2" });
const pb = push.pushkara_bhaga && push.pushkara_bhaga.is_available ? push.pushkara_bhaga : null;
const pn = push.pushkara_navamsha && push.pushkara_navamsha.is_available ? push.pushkara_navamsha : null;
const tRows = [
  [currentLang === "te" ? "నిర్ణయం" : "Prediction", (currentLang === "te" ? push.statement_te : push.statement_en) || push.statement || "—"],
  [currentLang === "te" ? (pb ? "పుష్కర భాగం" : "కాల వ్యవధి") : (pb ? "Pushkara Bhaga" : "Window"), (pb ? (pb.precise_time + " (" + pb.time_window + ")") : push.precise_time || push.time_window || "—")],
];
if (pn) tRows.push([currentLang === "te" ? "పుష్కర నవాంశ" : "Pushkara Navamsha", pn.precise_time + " (" + pn.time_window + ")"]);
if (push.avoid_note) tRows.push([currentLang === "te" ? "గమనిక" : "Note", (currentLang === "te" ? push.avoid_note_te : push.avoid_note_en) || push.avoid_note]);
content.push({ table: { widths: [120, "*"], body: tRows.map(([k, v]) => [{ text: k, style: "tdb" }, { text: String(v), style: "td" }]) }, margin: [0, 0, 0, 10] });
  }

  const cb = c.chandrabalam || d.chandrabalam || p.chandrabalam;
  if (cb && (cb.is_pass !== undefined || cb.desc_te)) {
content.push({ text: currentLang === "te" ? "చంద్రబలం / చంద్రాష్టమం" : "Chandrabalam / Chandrashtama", style: "h2" });
content.push({ table: { widths: [120, "*"], body: [
  [currentLang === "te" ? "అనుకూలత" : "Status", cb.is_pass ? (currentLang === "te" ? "అనుకూలం" : "Favorable") : (currentLang === "te" ? "పరీక్షించండి" : "Review")],
  [currentLang === "te" ? "స్థానం" : "House", cb.house ? cb.house + (currentLang === "te" ? "వ ఇంట" : "th house") : "—"],
  [currentLang === "te" ? "వివరణ" : "Analysis", (currentLang === "te" ? cb.desc_te : (cb.desc_en || cb.desc_te)) || "—"],
].filter(r => r[0] !== undefined) } });
  }

  const pan = c.panchaka_rahitam || p.panchaka_rahitam || d.panchaka;
  if (pan && (pan.name_te || pan.name_en)) {
content.push({ text: currentLang === "te" ? "పంచక రహితం" : "Panchaka Rahitam", style: "h2" });
const pRows = [
  [currentLang === "te" ? "వర్గీకరణ" : "Classification", (currentLang === "te" ? pan.name_te : pan.name_en) || "—"],
  [currentLang === "te" ? "ఫలితం" : "Effect", (currentLang === "te" ? pan.effect_te : pan.effect_en) || "—"],
];
if ((currentLang === "te" ? pan.pariharam_te : pan.pariharam_en) && !pan.is_pass) {
  pRows.push([currentLang === "te" ? "పరిహారం" : "Remedy", (currentLang === "te" ? pan.pariharam_te : pan.pariharam_en)]);
}
content.push({ table: { widths: [120, "*"], body: pRows.map(([k, v]) => [{ text: k, style: "tdb" }, { text: String(v || "—"), style: "td" }]) } });
  }

  const pReasons = (c.reasons || []).filter(Boolean);
  if (pReasons.length) {
content.push({ text: currentLang === "te" ? "నిర్ణయానికి కారణాలు" : "Reasons behind the verdict", style: "h2" });
pReasons.forEach(r => content.push({ ul: [String(r)], margin: [0, 0, 0, 4] }));
  }

  return Object.assign({ content }, PDF_BASE);
}

/* ---------- Panchang day summary PDF (panchang tab) ---------- */
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

async function exportSamskaraCandidatesPdf() {
  if (!currentNamakaranaData) { return; }
  setStatus("📄 Building PDF…");
  await loadPdfFonts();
  const doc = await buildSamskaraDoc(currentNamakaranaData);
  exportPdf(`MUHURTHAM_${currentActiveSamskara}_muhurtas.pdf`, doc);
  setStatus("PDF downloaded ✓");
}

async function exportCandidateDetailPdf() {
  if (currentModalIdx === null || !currentNamakaranaData) { return; }
  const doc = await buildCandidateDoc(currentNamakaranaData, currentModalIdx);
  if (doc) {
exportPdf(`MUHURTHAM_${currentActiveSamskara}_${currentNamakaranaData.candidates[currentModalIdx].date}_detail.pdf`, doc);
  }
}

async function exportPanchangPdf() {
  if (!lastPanchang) { return; }
  await loadPdfFonts();
  const doc = buildPanchangDoc(lastPanchang.panchang);
  exportPdf(`PANCHANGAM_${lastPanchang.panchang.date}_summary.pdf`, doc);
}

async function exportSmartPdf() {
  if (currentNamakaranaData && currentNamakaranaData.candidates) {
return exportSamskaraCandidatesPdf();
  }
  return exportPanchangPdf();
}
