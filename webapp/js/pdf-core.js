// ============================================================
// Muhurtham App · component: shared PDF pipeline (all pages)
// Telugu font loading + font-safe content walker + export helper
// ============================================================

/* ============ Shared pdfmake pipeline (Telugu-safe) ============ */
const PDF_FONT_URL = "https://notofonts.github.io/telugu/fonts/NotoSansTelugu/hinted/ttf/NotoSansTelugu-Regular.ttf";
let _pdfFontPromise = null;

async function loadPdfFonts() {
  if (_pdfFontPromise) return _pdfFontPromise;
  _pdfFontPromise = (async () => {
// NOTE: the full variable font (888 KB) makes pdfmake's getBase64 hang indefinitely;
// the hinted CDN copy renders correctly in Chrome — use it.
const res = await fetch(PDF_FONT_URL);
if (!res.ok) throw new Error("Telugu font fetch failed: " + res.status);
const buf = await res.arrayBuffer();
let bin = "";
const bytes = new Uint8Array(buf);
for (let i = 0; i < bytes.length; i += 0x8000) {
  bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
}
pdfMake.vfs["NotoSansTelugu.ttf"] = btoa(bin);
// keep pdfmake's built-in Roboto entries for Latin fallback
pdfMake.fonts = {
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
  },
  Telugu: {
    normal: "NotoSansTelugu.ttf",
    bold: "NotoSansTelugu.ttf",
    italics: "NotoSansTelugu.ttf",
    bolditalics: "NotoSansTelugu.ttf",
  },
};
  })();
  return _pdfFontPromise;
}

const PDF_BASE = {
  defaultStyle: { font: "Telugu", fontSize: 10, color: "#2b1a08" },
  pageMargins: [32, 36, 32, 32],
  header: () => ({
columns: [
  { text: currentLang === "te" ? "పంచాంగం · ముహూర్తం" : "Panchangam · Muhurtam", style: "hdr" },
  { text: new Date().toLocaleString(), style: "hdrSub", alignment: "right" },
],
  }),
  footer: (pg) => ({
columns: [
  { text: "Muhurtham App — Drik Ganita (Lahiri Ayanamsa)", style: "ftr" },
  { text: pg ? "" : "", style: "ftr" },
],
  }),
  styles: {
hdr: { fontSize: 10, bold: true, color: "#7b1f00" },
hdrSub: { fontSize: 8, color: "#999999" },
ftr: { fontSize: 7.5, color: "#aaaaaa" },
title: { fontSize: 16, bold: true, color: "#7b1f00", alignment: "center" },
subtitle: { fontSize: 10, color: "#666666", alignment: "center" },
h2: { fontSize: 12, bold: true, color: "#7b1f00", margin: [0, 8, 0, 4] },
th: { bold: true, color: "#ffffff", fillColor: "#7b1f00", fontSize: 9 },
td: { fontSize: 9, color: "#333333" },
tdb: { fontSize: 9, bold: true, color: "#3b2200" },
good: { fontSize: 9, bold: true, color: "#1b5e20" },
mid: { fontSize: 9, bold: true, color: "#e65100" },
bad: { fontSize: 9, bold: true, color: "#b71c1c" },
  },
};

function pdfVerdictStyle(pct) {
  if (pct <= 10) return "bad";
  if (pct >= 75) return "good";
  return "mid";
}
function pdfVerdictText(v) {
  if (currentLang !== "te") return v || "—";
  return { favorable: "అనుకూలం", "very favorable": "అత్యంత అనుకూలం", mixed: "మధ్యమం", unfavorable: "ప్రతికూలం", avoid: "నిషిద్ధం", neutral: "తటస్థం" }[v] || v || "—";
}

function pdfLagnaTe(name) {
  return currentLang === "te" ? (te(name || "", RASI_NAMES_TE) || name || "—") : (name || "—");
}
function pdfNakTe(name) {
  return currentLang === "te" ? (te(name || "", NAKSHATRA_NAMES_TE) || name || "—") : (name || "—");
}
function pdfTaraTe(name) {
  return currentLang === "te" ? (te(name || "", TARA_NAMES_TE) || name || "—") : (name || "—");
}
function pdfT(x) {
  if (x === null || x === undefined) return "—";
  if (typeof x === "string") return x;
  const s = x.start !== undefined ? x.start : x.start_time;
  const e = x.end !== undefined ? x.end : x.end_time;
  if (s && e) return s + " – " + e;
  if (s) return s;
  return "—";
}

/* ---------- Samskara results PDF (all candidates) ---------- */
function pdfVal(x) {
  if (x === null || x === undefined) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object" && x.name) return String(x.name);
  return String(x);
}

function pickPdfFont(s) {
  return /[A-Za-z·]/.test(String(s)) ? "Roboto" : "Telugu";
}

// Split a string into contiguous runs of Telugu vs Latin-ish text, each with its own font.
function splitPdfRuns(s) {
  const isTe = (ch) => /[\u0C00-\u0C7F]/.test(ch);
  const segs = [];
  let cur = "";
  let curTe = null;
  for (const ch of String(s)) {
if (curTe === null && ch === " ") { cur += ch; continue; }
const te = isTe(ch);
if (curTe === null) { curTe = te; cur = ch; continue; }
if (te !== curTe) {
  const trimmed = cur.replace(/ +$/, "");
  const trail = cur.slice(trimmed.length);
  if (trimmed) segs.push({ text: trimmed, font: curTe ? "Telugu" : "Roboto" });
  cur = trail + ch;
  curTe = te;
} else {
  cur += ch;
}
  }
  if (!segs.length) return null; // single-language string — no split needed
  if (cur) {
if (cur.trim()) segs.push({ text: cur.trim() === cur ? cur : cur, font: curTe ? "Telugu" : "Roboto" });
else segs[segs.length - 1].text += cur;
  }
  return segs;
}

function applyPdfFonts(node) {
  if (node === null || node === undefined) return node;
  if (typeof node === "string") {
const t = String(node).replace(/·/g, "-");
const runs = splitPdfRuns(t);
return runs ? { text: runs } : { text: t, font: pickPdfFont(t) };
  }
  if (Array.isArray(node)) return node.map(applyPdfFonts);
  if (typeof node === "object") {
if (Array.isArray(node.text)) {
  node.text = node.text.map((t) => (typeof t === "string" ? applyPdfFonts(t) : t));
} else if (typeof node.text === "string") {
  node.text = node.text.replace(/·/g, "-");
  if (!node.font) {
    const runs = splitPdfRuns(node.text);
    if (runs) { node.text = runs; node.font = undefined; }
    else node.font = pickPdfFont(node.text);
  }
}
if (node.table && Array.isArray(node.table.body)) {
  node.table.body = node.table.body.map((row) => (Array.isArray(row) ? row.map(applyPdfFonts) : row));
}
if (Array.isArray(node.ul)) node.ul = node.ul.map(applyPdfFonts);
if (Array.isArray(node.ol)) node.ol = node.ol.map(applyPdfFonts);
if (Array.isArray(node.columns)) node.columns = node.columns.map(applyPdfFonts);
if (node.stack) node.stack = node.stack.map(applyPdfFonts);
if (Array.isArray(node.content)) node.content = node.content.map(applyPdfFonts);
if (node.header) node.header = applyPdfFonts(node.header);
if (node.footer) node.footer = applyPdfFonts(node.footer);
  }
  return node;
}

