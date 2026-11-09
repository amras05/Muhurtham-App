// ============================================================
// Muhurtham App · component: share one day's panchang (Month tab day panel)
// panchangDaySections(day, place) is the single list of what a day shows; the on-screen panel,
// the PNG card and the text message are all built from it, so they always agree.
//   PDF  → printed on the server (js/pdf-download.js), shared or downloaded
//   PNG  → drawn in the browser on a <canvas> (the browser shapes Telugu correctly)
//   Text → plain message for WhatsApp / SMS, shared or copied
// On phones the share sheet opens; elsewhere files download and text is copied.
// ============================================================

function _tr(en, te_) { return currentLang === "te" ? te_ : en; }

function _pairText(p) { return p ? `${p.start} – ${p.end}` : "—"; }
function _listText(list) { return list && list.length ? list.map(_pairText).join(" & ") : "—"; }

// One day (a /panchang/month entry) → heading, sub-heading and labelled rows.
function panchangDaySections(d, place) {
  const L = currentLang === "te";
  const until = (t) => (t ? (L ? `${t} వరకు` : `until ${t}`) : "—");
  const heading = new Date(`${d.date}T00:00:00`).toLocaleDateString(L ? "te-IN" : "en-IN",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const cm = d.chandramana || {};
  const lunar = cm.month_name
    ? `${te(cm.month_name, MONTH_NAMES_TE)}${cm.is_adhika_masa ? _tr(" (Adhika)", " (అధిక)") : ""} · ${PAKSHA_NAMES[currentLang][d.tithi.paksha] || d.tithi.paksha} ${_tr("paksha", "పక్షం")}`
    : "";
  const vaara = L ? (VAARA_NAMES.te[d.vaara] || d.vaara) : d.vaara;
  return {
    heading,
    sub: [vaara, lunar].filter(Boolean).join(" · "),
    place: place || "",
    sections: [
      {
        title: _tr("Panchang", "పంచాంగం"),
        rows: [
          [_tr("Tithi", "తిథి"), `${te(d.tithi.name, TITHI_NAMES_TE)} · ${until(d.tithi.end_time)}`],
          [_tr("Nakshatra", "నక్షత్రం"), `${te(d.nakshatra.name, NAKSHATRA_NAMES_TE)} (${_tr("pada", "పాదం")} ${d.nakshatra.pada}) · ${until(d.nakshatra.end_time)}`],
          [_tr("Yoga", "యోగం"), `${te(d.yoga.name, YOGA_NAMES_TE)} · ${until(d.yoga.end_time)}`],
          [_tr("Karana", "కరణం"), `${te(d.karana.name, KARANA_NAMES_TE)} · ${until(d.karana.end_time)}`],
          [_tr("Sunrise", "సూర్యోదయం"), d.sunrise || "—"],
          [_tr("Sunset", "సూర్యాస్తమయం"), d.sunset || "—"],
        ],
      },
      {
        title: _tr("Timings to avoid / use", "అశుభ / శుభ సమయాలు"),
        rows: [
          [_tr("Rahu Kalam", "రాహు కాలం"), _pairText(d.rahu_kalam)],
          [_tr("Yamagandam", "యమగండం"), _pairText(d.yamagandam)],
          [_tr("Gulika Kalam", "గుళిక కాలం"), _pairText(d.gulika_kalam)],
          [_tr("Durmuhurtam", "దుర్ముహూర్తం"), _listText(d.durmuhurtam)],
          [_tr("Varjyam", "వర్జ్యం"), _pairText(d.varjyam)],
          [_tr("Abhijit Muhurta", "అభిజిత్ ముహూర్తం"), _pairText(d.abhijit_muhurta)],
          [_tr("Amrit Kalam", "అమృత కాలం"), _listText(d.amrit_kalam)],
        ],
      },
    ],
    yogas: (d.special_yogas || []).map(y => ({
      name: L ? y.name_te : y.name_en,
      type: y.type === "bad" ? "bad" : (y.type === "info" ? "info" : "good"),
    })),
    footer: _tr("Drik Panchang (Lahiri) · Muhurtham", "దృక్ పంచాంగం (లాహిరి) · ముహూర్తం"),
  };
}

// ---- HTML (the Month panel on screen, and what the server prints as the PDF) ----------
function _esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function panchangSectionsHead(s, extraHtml) {
  return '<div class="month-detail__head">' +
    `<div><h3 class="month-detail__title">${_esc(s.heading)}</h3>` +
    `<div class="month-detail__sub">${_esc([s.place, s.sub].filter(Boolean).join(" · "))}</div></div>` +
    (extraHtml || "") + "</div>";
}

function panchangSectionsBody(s) {
  const cols = s.sections.map(sec =>
    `<div class="kaala-section"><div class="kaala-title">${_esc(sec.title)}</div>` +
    sec.rows.map(([k, v]) =>
      `<div class="kaala-row"><span class="kname">${_esc(k)}</span><span class="ktime">${_esc(v)}</span></div>`).join("") +
    "</div>").join("");
  const yogas = s.yogas.map(y => `<span class="month-yoga month-yoga--${y.type}">${_esc(y.name)}</span>`).join("");
  return `<div class="month-detail__cols">${cols}</div>` + (yogas ? `<div class="month-detail__yogas">${yogas}</div>` : "");
}

// A detached element for PdfDownload: the same content as the PNG and text, with no live state.
function panchangPdfElement(s) {
  const node = document.createElement("div");
  node.innerHTML = panchangSectionsHead(s) + panchangSectionsBody(s);
  return node;
}

// ---- Text ----------------------------------------------------------------------
function panchangDayText(s) {
  const lines = [`🪔 ${_tr("Panchang", "పంచాంగం")} · ${s.heading}`, [s.place, s.sub].filter(Boolean).join(" · ")];
  s.sections.forEach(sec => {
    lines.push("", `*${sec.title}*`);
    sec.rows.forEach(([k, v]) => lines.push(`${k}: ${v}`));
  });
  if (s.yogas.length) lines.push("", `✨ ${_tr("Special yogas", "విశేష యోగాలు")}: ${s.yogas.map(y => y.name).join(", ")}`);
  lines.push("", `— ${s.footer}`);
  return lines.join("\n");
}

// ---- PNG card ------------------------------------------------------------------
const CARD = { w: 1080, pad: 64, maroon: "#6f1725", gold: "#c59b27", ink: "#211a18", muted: "#655c57",
               line: "#ded6cc", bg: "#fbfaf8", good: "#1f7a45", bad: "#b42318", info: "#175cd3" };

function _font(weight, size) {
  return `${weight} ${size}px "Noto Sans Telugu", "Outfit", "Inter", sans-serif`;
}

// Break text into lines no wider than maxW (splits on spaces).
function _wrap(ctx, text, maxW) {
  const words = String(text).split(" ");
  const lines = [];
  let cur = "";
  words.forEach(w => {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxW || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  });
  if (cur) lines.push(cur);
  return lines;
}

// Draws the card; with ctx = null it only measures, returning the height needed.
function _drawCard(ctx, s, measureCtx) {
  const c = ctx || measureCtx;
  const { w, pad } = CARD;
  const inner = w - pad * 2;
  let y = 0;

  // Header band
  const headLines = (() => { c.font = _font(700, 46); return _wrap(c, s.heading, inner); })();
  const headH = 70 + 34 + headLines.length * 58 + 56 + 40;
  if (ctx) {
    ctx.fillStyle = CARD.maroon; ctx.fillRect(0, 0, w, headH);
    ctx.fillStyle = CARD.gold; ctx.fillRect(0, headH - 8, w, 8);
    ctx.fillStyle = "#f4dca0"; ctx.font = _font(600, 28);
    ctx.fillText(`${_tr("PANCHANG", "పంచాంగం")}${s.place ? " · " + s.place : ""}`, pad, 84);
    ctx.fillStyle = "#ffffff"; ctx.font = _font(700, 46);
    headLines.forEach((ln, i) => ctx.fillText(ln, pad, 150 + i * 58));
    ctx.fillStyle = "#f6e7ea"; ctx.font = _font(500, 30);
    ctx.fillText(s.sub, pad, 150 + headLines.length * 58 + 12);
  }
  y = headH + 50;

  // Sections
  s.sections.forEach(sec => {
    if (ctx) {
      ctx.fillStyle = CARD.gold; ctx.font = _font(700, 26);
      ctx.fillText(sec.title.toUpperCase(), pad, y);
      ctx.fillStyle = CARD.line; ctx.fillRect(pad, y + 16, inner, 2);
    }
    y += 64;
    sec.rows.forEach(([k, v]) => {
      c.font = _font(500, 32);
      const labelW = Math.min(c.measureText(k).width, inner * 0.42);
      c.font = _font(700, 32);
      const valLines = _wrap(c, v, inner - labelW - 32);
      if (ctx) {
        ctx.fillStyle = CARD.muted; ctx.font = _font(500, 32); ctx.textAlign = "left";
        ctx.fillText(k, pad, y);
        ctx.fillStyle = CARD.maroon; ctx.font = _font(700, 32); ctx.textAlign = "right";
        valLines.forEach((ln, i) => ctx.fillText(ln, w - pad, y + i * 42));
        ctx.textAlign = "left";
      }
      y += valLines.length * 42 + 22;
    });
    y += 30;
  });

  // Special yogas as wrapped chips
  if (s.yogas.length) {
    if (ctx) { ctx.fillStyle = CARD.gold; ctx.font = _font(700, 26); ctx.fillText(_tr("SPECIAL YOGAS", "విశేష యోగాలు"), pad, y); }
    y += 30;
    let x = pad;
    c.font = _font(600, 28);
    s.yogas.forEach(yg => {
      const tw = c.measureText(yg.name).width + 40;
      if (x + tw > w - pad) { x = pad; y += 62; }
      if (ctx) {
        ctx.strokeStyle = CARD[yg.type]; ctx.lineWidth = 3;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, tw, 50, 25); else ctx.rect(x, y, tw, 50);   // older Safari
        ctx.stroke();
        ctx.fillStyle = CARD[yg.type]; ctx.font = _font(600, 28);
        ctx.fillText(yg.name, x + 20, y + 35);
      }
      x += tw + 12;
    });
    y += 90;
  }

  // Footer
  if (ctx) {
    ctx.fillStyle = CARD.line; ctx.fillRect(pad, y, inner, 2);
    ctx.fillStyle = CARD.muted; ctx.font = _font(500, 24);
    ctx.fillText(s.footer, pad, y + 44);
  }
  return y + 80;
}

async function panchangDayPng(s) {
  // Make sure the page fonts are ready, or the canvas falls back to a system font.
  if (document.fonts && document.fonts.load) {
    await Promise.all([
      document.fonts.load(_font(700, 46), s.heading),
      document.fonts.load(_font(500, 32), "అ"),
      document.fonts.load(_font(700, 32), "అ"),
    ]);
  }
  const measure = document.createElement("canvas").getContext("2d");
  const height = Math.ceil(_drawCard(null, s, measure));
  const canvas = document.createElement("canvas");
  canvas.width = CARD.w;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = CARD.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  _drawCard(ctx, s, null);
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("The image could not be made."))), "image/png"));
}

// ---- Share or save ---------------------------------------------------------------
// Opens the share sheet when the browser can share this file; otherwise downloads it.
async function shareOrDownload(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;           // the person closed the share sheet
      console.warn("Share failed, downloading instead:", e);   // e.g. the tap was too long ago
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function shareText(text, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (e) {
      if (e.name === "AbortError") return "cancelled";
      console.warn("Share failed, copying instead:", e);
    }
  }
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }
  // Plain-http sites (before HTTPS, plan F6) have no clipboard API or share sheet.
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error(_tr("the browser blocked copying", "బ్రౌజర్ కాపీని అనుమతించలేదు"));
  return "copied";
}

// The dashboard's Today card (/dashboard/today) → the same shape as panchangDaySections.
function panchangTodaySections(d) {
  const L = currentLang === "te";
  const m = d.masa || {};
  const nak = (n) => (L && typeof NAKSHATRA_NAMES_TE !== "undefined" && NAKSHATRA_NAMES_TE[n]) || n;
  const till = (t) => (t ? (L ? `${t} వరకు` : `till ${t}`) : "—");
  const heading = new Date(`${d.date}T12:00:00`).toLocaleDateString(L ? "te-IN" : "en-IN",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const sub = L
    ? [m.samvatsara_te, `${m.name_te || ""}${m.adhika ? " (అధిక)" : ""}`, m.paksha_te]
    : [m.samvatsara_en, `${m.name_en || ""}${m.adhika ? " (adhika)" : ""}`, m.paksha_en];
  return {
    heading,
    sub: sub.filter(Boolean).join(" · "),
    place: (d.place && d.place.name) || "",
    sections: [
      {
        title: _tr("Panchang", "పంచాంగం"),
        rows: [
          [_tr("Tithi", "తిథి"), `${d.tithi.name} · ${till(d.tithi.end)}`],
          [_tr("Nakshatra", "నక్షత్రం"), `${nak(d.nakshatra.name)} (${_tr("pada", "పాదం")} ${d.nakshatra.pada}) · ${till(d.nakshatra.end)}`],
          [_tr("Yoga", "యోగం"), `${d.yoga.name} · ${till(d.yoga.end)}`],
          [_tr("Karana", "కరణం"), `${d.karana.name} · ${till(d.karana.end)}`],
          [_tr("Sunrise", "సూర్యోదయం"), d.sunrise || "—"],
          [_tr("Sunset", "సూర్యాస్తమయం"), d.sunset || "—"],
        ],
      },
      {
        title: _tr("Avoid today", "ఈ రోజు నివారించవలసినవి"),
        rows: (d.periods || []).map(p => [_tr(p.name_en, p.name_te), `${p.start} – ${p.end}`]),
      },
    ],
    yogas: (d.special_yogas || []).map(y => ({ name: _tr(y.name_en, y.name_te), type: y.type === "bad" ? "bad" : "good" })),
    footer: _tr("Drik Panchang (Lahiri) · Muhurtham", "దృక్ పంచాంగం (లాహిరి) · ముహూర్తం"),
  };
}

// The Share row (PDF · Image · Text). It is no-print, so it never appears inside the PDF.
function panchangShareBar() {
  const L = currentLang === "te";
  return '<div class="share-bar no-print" role="group" aria-label="' + (L ? "పంచుకోండి" : "Share") + '">' +
    `<span class="share-bar__label">${L ? "పంచుకోండి" : "Share"}</span>` +
    '<button type="button" class="btn btn--sm share-bar__btn" data-share="pdf">PDF</button>' +
    `<button type="button" class="btn btn--sm share-bar__btn" data-share="png">${L ? "చిత్రం (PNG)" : "Image (PNG)"}</button>` +
    `<button type="button" class="btn btn--sm share-bar__btn" data-share="text">${L ? "పాఠ్యం" : "Text"}</button>` +
    "</div>";
}

// Wires the Share row inside `root`.
//   getSections: () => sections (called at click time, so the current language is used)
//   date, place: for the title and file name
function bindPanchangShare(root, opts) {
  const base = PdfDownload.fileName("panchang", opts.date);
  const title = `${_tr("Panchang", "పంచాంగం")} · ${opts.date}`;
  const btn = (kind) => root.querySelector(`[data-share="${kind}"]`);

  btn("pdf").addEventListener("click", (e) => {
    PdfDownload.fromElement(panchangPdfElement(opts.getSections()), {
      kind: "panchang", title, subtitle: opts.place || "", filename: base, share: true,
    }, e.currentTarget);
  });

  btn("png").addEventListener("click", async (e) => {
    const b = e.currentTarget, label = b.innerHTML;
    b.disabled = true; b.textContent = _tr("Making image…", "చిత్రం తయారవుతోంది…");
    try {
      const blob = await panchangDayPng(opts.getSections());
      await shareOrDownload(blob, `${base}.png`, title);
    } catch (err) {
      alert(_tr("Couldn't make the image: ", "చిత్రం తయారు కాలేదు: ") + err.message);
    } finally {
      b.disabled = false; b.innerHTML = label;
    }
  });

  btn("text").addEventListener("click", async (e) => {
    const b = e.currentTarget, label = b.innerHTML;
    try {
      const how = await shareText(panchangDayText(opts.getSections()), title);
      if (how === "copied") {
        b.textContent = _tr("Copied ✓", "కాపీ అయింది ✓");
        setTimeout(() => { b.innerHTML = label; }, 2000);
      }
    } catch (err) {
      alert(_tr("Couldn't share or copy the text: ", "పాఠ్యం పంపడం / కాపీ కాలేదు: ") + err.message);
    }
  });
}
