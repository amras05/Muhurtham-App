// ============================================================
// Muhurtham App · "Download PDF" (plan R8)
// Sends the section on screen to POST /pdf/render; the server prints it as an A4 PDF with
// correct Telugu (WeasyPrint) and the browser saves the file.
//   PdfDownload.fromElement(element, { kind, title, subtitle, filename }, button)
// kind: muhurta | results | panchang | pitru | yogas
// ============================================================
window.PdfDownload = (function () {
  function tr(en, te) { return (typeof currentLang !== "undefined" && currentLang === "te") ? te : en; }

  async function fromElement(element, opts, button) {
    var node = typeof element === "string" ? document.getElementById(element) : element;
    if (!node || !node.innerHTML.trim()) {
      AppShell.toast(tr("There is nothing to put in the PDF yet.", "PDF లో చేర్చడానికి ఇంకా ఏమీ లేదు."), "error");
      return;
    }
    var label = button ? button.innerHTML : null;
    if (button) { button.disabled = true; button.textContent = tr("Making PDF…", "PDF తయారవుతోంది…"); }
    try {
      var res = await fetch(API_BASE + "/pdf/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: opts.kind, title: (opts.title || "Muhurtham").slice(0, 160),
          subtitle: opts.subtitle ? String(opts.subtitle).slice(0, 300) : null,
          lang: (typeof currentLang !== "undefined" && currentLang === "te") ? "te" : "en",
          html: node.innerHTML, filename: opts.filename || null,
        }),
      });
      if (!res.ok) {
        var data = await res.json().catch(function () { return null; });
        throw new Error((data && typeof data.detail === "string" && data.detail) || ("HTTP " + res.status));
      }
      var blob = await res.blob();
      var cd = res.headers.get("Content-Disposition") || "";
      var m = /filename="([^"]+)"/.exec(cd);
      var name = m ? m[1] : "muhurtham.pdf";
      // opts.share: open the phone's share sheet when it can take a file (js/panchang-share.js).
      if (opts.share && typeof shareOrDownload === "function") {
        await shareOrDownload(blob, name, opts.title);
        return;
      }
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    } catch (e) {
      AppShell.toast(tr("Couldn't make the PDF: ", "PDF తయారు కాలేదు: ") + e.message, "error");
    } finally {
      if (button) { button.disabled = false; button.innerHTML = label; }
    }
  }

  // "2026-12-24 Vivaha" → "Muhurtham_vivaha_2026-12-24"
  function fileName() {
    return ["Muhurtham"].concat(Array.prototype.slice.call(arguments)).filter(Boolean).join("_")
      .replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 90);
  }

  return { fromElement: fromElement, fileName: fileName };
})();
