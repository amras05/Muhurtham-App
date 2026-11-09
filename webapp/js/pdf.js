// ============================================================
// Muhurtham App · Panchang page PDF (plan R8, F1)
// The server prints the page section with correct Telugu (js/pdf-download.js); the old
// browser-side pdfmake builders were removed with pdf-core.js.
// ============================================================

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
