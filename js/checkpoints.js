// ============================================================
// Muhurtham App · component: Samskara Checkpoints page
// (16 Shodasa Samskaras muhurta check-list → pdfmake PDF)
// requires: js/pdf-core.js (Telugu font pipeline, applyPdfFonts)
// ============================================================

const COMMON_CHECKS = [
  ["వార శుద్ధి", "శుభ వారము ఎంపిక; నిషిద్ధ వారములు (ఉదా: మంగళ, శనివారములు) వర్జింపబడును"],
  ["తిథి శుద్ధి", "ఆ సంస్కారమునకు శాస్త్రమున నిర్దేశింపబడిన నిషిద్ధ తిథులు వర్జింపబడును"],
  ["నక్షత్ర శుద్ధి", "ఆ సంస్కారమునకు ప్రసిద్ధి చెందిన శుభ నక్షత్రములు మాత్రమే స్వీకరింపబడును"],
  ["లగ్న శుద్ధి", "శుభ లగ్నములు (వృషభ, మిథున, కర్కాటక, కన్య, ధను, మీన) శ్రేష్ఠం; లగ్నమున పాపగ్రహములు ఉండరాదు"],
  ["అష్టమ శుద్ధి", "ముహూర్త లగ్నము నుండి 8వ స్థానము గ్రహరహితముగా ఉండవలెను"],
  ["తారాబలం", "జన్మ నక్షత్రమునుండి గణించు నవతారలు — జన్మ, విపత్ (3), ప్రత్యరి (5), వధ (7) తారలు నిషిద్ధం"],
  ["చంద్రబలం / చంద్రాష్టమము", "జన్మరాశి నుండి ముహూర్త చంద్ర 1,3,6,7,10,11 స్థానములు శుభం; 8వ = చంద్రాష్టమము అత్యంత నిషిద్ధం"],
  ["పంచక రహితం", "(తిథి+వారం+నక్షత్రం+లగ్నం) % 9 = 5 అయినచో పంచకరహితము — శుభం"],
  ["పుష్కరాంశ / పుష్కర భాగం", "లగ్నము పుష్కర స్థానములలో ఉండిన సమస్త దోషాలు శాంతించును"],
  ["పరిహార పరీక్ష", "గురు కేంద్రదృష్టి, పుష్కర, అభిజిత్, పంచక శాస్త్ర, అష్టమలగ్న పరిహారములు — దోష నివృత్తి పరీక్ష"],
  ["రాహు/గుళిక/యమగండ/దుర్ముహూర్త వర్జన", "ముహూర్త కాలము అశుభ కాలములలో తగిలినయెడల వర్జింపబడును"],
];
// వివాహానికి మాత్రము వర్తించు పరీక్షలు: ఋక్త తిథులు, 21 మహాదోషాలు, 10 దశవిధ దోషాలు
const VIVAH_ONLY = [
  ["వివాహ తిథి నిషిద్ధము", "ఋక్త తిథులు (4, 9, 14), అమావాస్య — ఇవి వివాహమునకు మాత్రము వర్జితము; మిగతా సంస్కారములకు వర్తింపవు"],
  ["ఏకవింశతి మహాదోష పరీక్ష (21)", "సంక్రాంతి, పాపపడ్వర్గ, కర్తరి, లగ్నాష్టమ, అష్టమ చంద్రుడు, గండాంత, వ్యతీపాత/వైదృతి మొదలగు 21 మహాదోషముల పరీక్ష — వివాహమునకు మాత్రము"],
  ["దశవిధ దోష పరీక్ష (10)", "లత్తా, పాత, యుతి, వేద, జామిత్ర, మృత పంచక, ఏకార్గళ, ఉపగ్రహ, క్రాంతి సామ్య, దగ్ధ తిథి — 10 దోష పరీక్ష — వివాహమునకు మాత్రము"],
];
const SPECIAL = {
  chandrashtama_both: ["వధూవరుల చంద్రాష్టమ పరీక్ష", "భర్త-భార్యల జన్మరాశులకు 8వ ఇంట చంద్రుడు ఉండరాదు"],
  ritu_lagna_6_8: ["ఋతు లగ్న 6/8 పరీక్ష", "వధువు ప్రథమ ఋతు లగ్నానికి ముహూర్త లగ్నం 6 / 8 ఉండరాదు"],
  star_7_prohibited: ["7వ నక్షత్ర నిషేధం", "జన్మ నక్షత్రం నుండి 7వ నక్షత్రం (విపత్) నిషిద్ధం"],
  month_3_pregnancy: ["3వ గర్భ మాస పరీక్ష", "తొలి గర్భమున 3వ మాసమునందే పుంసవనము"],
  ashtama_lagna: ["అష్టమ లగ్న నిషేధం", "జన్మ లగ్నం నుండి ముహూర్త లగ్నం 8వ అవ్వరాదు"],
  navama_shuddhi: ["నవమ శుద్ధి", "ముహూర్త లగ్నం నుండి 9వ స్థానము ఖాళీ"],
  dashama_shuddhi: ["దశమ శుద్ధి", "ముహూర్త లగ్నం నుండి 10వ స్థానము ఖాళీ"],
  gender_parity: ["లింగ భేద మాస నియమము", "పుత్రులకు సరి మాసములు, పుత్రికలకు బేసి మాసములు"],
  uttarayana_only: ["ఉత్తరాయణ పరీక్ష", "సూర్యుడు మకర–మిథున రాశిలో (ఉత్తరాయణం) ఉండవలెను"],
  guru_strength: ["గురు బల పరీక్ష", "గురుడు కేంద్ర/కోణములలో బలముగా (మకర కాక) ఉండవలెను"],
  kendras_clean: ["కేంద్ర శుచిత్వము", "లగ్నం నుండి కేంద్రముల (1,4,7,10) పాపగ్రహములు ఉండరాదు"],
  daytime_only: ["పగటివేళ పరీక్ష", "సూర్యోదయ–సూర్యాస్తమయముల మధ్య మాత్రమే చేయుదగినది"],
  guru_shukra_avastha: ["గురు-శుక్ర అవస్థ పరీక్ష", "ముహూర్త సమయంలో గురు/శుక్రులు అస్తగత గానీ వక్రగతిన గానీ ఉండరాదు"],
  trijashta_star: ["త్రిజేష్ఠ నక్షత్ర పరీక్ష", "వధువు జన్మ నక్షత్రం నుండి 18వ (త్రిజేష్ఠ) నక్షత్రం వర్జ్యం"],
  vivaha_masas: ["మాస శుద్ధి పరీక్ష", "ఆషాఢ, శ్రావణ, భాద్రపద, పుష్య మాసములు నిషిద్ధ; శుభ మాసములు శ్రేష్టం"],
};
const ANTYESHTI = [
  ["తిథి నిర్ణయము", "దహనార్థము ఏకాదశి తిథి వర్జ్యం; మరణ దినమున లేనిచో తరువాతి తిథిశుద్ధ దినము"],
  ["సపిండీకరణము", "12వ దినము ముఖ్యము; తిథి వర్జ్యతల పరిగణింపబడును"],
  ["అస్థి సంచయము", "3వ (లేక 4వ) దినము అస్థి సంగ్రహము"],
  ["సంక్రాంతి పుణ్యకాలము", "వార్షిక సంక్రాంతి దినముల గుర్తింపు — పితృకార్య పుణ్యకాలము"],
  ["అష్టకా శ్రాద్ధము", "కృష్ణపక్ష అష్టమి దినముల వార్షిక లెక్కింపు"],
  ["తిలోదక / వసోదకము", "దహనానంతర 10 దినముల తిలోదక-వసోదక విధానము"],
];

let pdfBytes = null;

async function fetchSamskaras(base) {
  const res = await fetch(`${base}/muhurta/samskaras/list`);
  if (!res.ok) throw new Error("API error " + res.status + " (server running? " + base + ")");
  return res.json();
}

function buildDoc(samskaras) {
  const content = [
    { text: "షోడశ సంస్కారముల — ముహూర్త పరీక్షాంశములు (చెక్ పాయింట్లు)", style: "title", alignment: "center" },
    { text: "జ్యోతిష్య గ్రంథము ఆధారితము · ముహూర్తం-ఆప్ ఇంజన్ నిర్ధారణలు", style: "small", alignment: "center", margin: [0, 0, 0, 14] },
  ];
  const addCard = (icon, nameTe, nameEn, taglineTe, rulesTe, checks) => {
    content.push({ columns: [
      { text: `${nameTe}`, style: "sname", width: "*" },
      { text: `(${nameEn})`, style: "snameEn", width: "auto", alignment: "right" },
    ], margin: [0, 6, 0, 2] });
    content.push({ text: taglineTe, style: "tagline" });
    content.push({ text: rulesTe, style: "rules", margin: [0, 3, 0, 6] });
    content.push({
      table: {
        headerRows: 1,
        widths: [28, "*", "*"],
        body: [
          [{ text: "సూక్తి", style: "th" }, { text: "పరీక్షాంశము", style: "th" }, { text: "వివరణ", style: "th" }],
          ...checks.map(([n, d], i) => [String(i + 1), { text: n, style: "tdb" }, { text: d, style: "td" }]),
        ],
      },
      margin: [0, 0, 0, 10]
    });
  };

  samskaras.forEach((s) => {
    const checks = COMMON_CHECKS.slice();
    if (s.id === "vivaha") VIVAH_ONLY.forEach((v) => checks.push(v));
    (s.special_checks || []).forEach((sc) => { if (SPECIAL[sc]) checks.push(SPECIAL[sc]); });
    addCard(s.icon, s.name_te, s.name_en, s.tagline_te || "", s.rules_summary_te || "", checks);
  });

  addCard("🕯️", "అంత్యేష్టి / పితృక్రియ", "Antyeshti / Pitrukarya Engine",
    "లగ్న-ఆధారితము కాదు — తిథి-ఆధారిత నిర్ణయము",
    "API: /muhurta/pitrukarya-finder (mode: pending | calendar)", ANTYESHTI);

  return {
    defaultStyle: { font: "Telugu", fontSize: 10.5, color: "#2b1a08" },
    pageMargins: [30, 34, 30, 30],
    styles: {
      title: { fontSize: 17, bold: true, color: "#7b1f00" },
      small: { fontSize: 9, color: "#777777" },
      sname: { fontSize: 13, bold: true, color: "#7b1f00" },
      snameEn: { fontSize: 9, color: "#888888" },
      tagline: { fontSize: 10, color: "#555555" },
      rules: { fontSize: 10, fillColor: "#fff8ee", padding: [6, 6, 6, 6] },
      th: { bold: true, color: "#ffffff", fillColor: "#7b1f00", fontSize: 10 },
      tdb: { color: "#3b2200", bold: true },
      td: { color: "#333333" },
    },
    content,
  };
}

async function generate() {
  const btn = document.getElementById("genBtn");
  btn.disabled = true;
  try {
    const base = document.getElementById("apiBase").value.trim().replace(/\/+$/, "");
    await loadPdfFonts();
    setStatus("API నుండి సంస్కార డేటా సేకరణ…");
    const samskaras = await fetchSamskaras(base);
    setStatus("PDF రూపకల్పన…");
    const doc = buildDoc(samskaras);
    await new Promise((resolve, reject) => {
      pdfMake.createPdf(applyPdfFonts(doc)).getDataUrl((dataUrl) => {
        pdfBytes = dataUrl;
        document.getElementById("preview").src = dataUrl;
        document.getElementById("dlBtn").disabled = false;
        setStatus("PDF సిద్ధము! (డౌన్‌లోడ్ బటన్ ఉపయోగించండి)");
        resolve();
      });
    });
  } catch (e) {
    setStatus("ఏరర్: " + e.message, true);
    console.error(e);
  } finally {
    btn.disabled = false;
  }
}

function download() {
  if (!pdfBytes) return;
  const a = document.createElement("a");
  a.href = pdfBytes;
  a.download = "SAMSKARA_CHECKPOINTS_TE.pdf";
  a.click();
}

document.getElementById("genBtn").addEventListener("click", generate);
document.getElementById("dlBtn").addEventListener("click", download);
setStatus("సిద్ధము — 'PDF తయారుచేయి' నొక్కండి (బ్యాకెండ్ పరిగిస్తుండాలి: http://127.0.0.1:8555)");
