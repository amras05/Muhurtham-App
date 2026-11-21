// ============================================================
// Muhurtham App · Muhurta Finder component: Result list: D1 chart, month names, result detail helpers, dosha rows, results, audit banner.
// Split from finder.js (21 Nov 2026). Plain script: the page loads the finder-*.js files in order
// (see muhurta-finder.html); they share one global scope, and finder-init.js runs last.
// requires: js/config.js, js/i18n.js, js/regions.js, js/stars.js
// ============================================================

// ---- D1 Chart Builder ----
function buildD1ChartHTML(d1Array, centerLabel) {
  let rasiPlanets = Array.from({ length: 12 }, () => []);
  if (d1Array && d1Array.length > 0) {
    d1Array.forEach(item => {
      let pAbbr = PLANET_ABBRS[currentLang][item.planet] || item.planet;
      if (item.is_retro && item.planet !== "L" && item.planet !== "Mnd" && item.planet !== "Gk") {
        pAbbr += `<span class="chart-retro">${t("(R)")}</span>`;
      }
      if (item.is_combust && item.planet !== "L" && item.planet !== "Mnd" && item.planet !== "Gk") {
        pAbbr += `<span class="chart-combust">${t("(C)")}</span>`;
      }
      rasiPlanets[item.rasi_index].push(pAbbr);
    });
  }
  let html = `<div class="south-chart">`;
  html += `<div class="chart-center">${centerLabel}</div>`;
  for (let rasiIdx = 0; rasiIdx < 12; rasiIdx++) {
    const pos = CHART_GRID_POSITIONS[rasiIdx];
    const rasiName = D9_RASI_LABELS[currentLang][rasiIdx];
    const pList = rasiPlanets[rasiIdx].join(", ");
    html += `
      <div class="chart-cell" style="grid-row: ${pos.row}; grid-column: ${pos.col};">
        <div class="rasi-label">${rasiName}</div>
        <div class="planets-list">${pList || "—"}</div>
      </div>`;
  }
  html += `</div>`;
  return html;
}
// ---- Month names: Amanta (as the rules use) or Purnimanta (display only) ----
const LUNAR_MONTHS = [
  { en: "Chaitra", te: "చైత్ర మాసం" }, { en: "Vaishakha", te: "వైశాఖ మాసం" }, { en: "Jyeshtha", te: "జ్యేష్ఠ మాసం" },
  { en: "Ashadha", te: "ఆషాఢ మాసం" }, { en: "Shravana", te: "శ్రావణ మాసం" }, { en: "Bhadrapada", te: "భాద్రపద మాసం" },
  { en: "Ashwina", te: "ఆశ్వయుజ మాసం" }, { en: "Kartika", te: "కార్తీక మాసం" }, { en: "Margashira", te: "మార్గశిర మాసం" },
  { en: "Pushya", te: "పుష్య మాసం" }, { en: "Magha", te: "మాఘ మాసం" }, { en: "Phalguna", te: "ఫాల్గుణ మాసం" },
];

function displayMasa(cm) {
  const amanta = currentLang === "te" ? (cm.month_telugu || cm.month_name) : `${cm.month_name} Masam`;
  const n = Number(cm.month_number);
  const krishna = String(cm.paksha_en || "").toLowerCase().startsWith("krishna");
  if (el("mfMasaSystem")?.value !== "purnimanta" || !krishna || !(n >= 1 && n <= 12)) return amanta;
  // Purnimanta months end at the full moon, so Krishna paksha belongs to the next month.
  const m = LUNAR_MONTHS[n % 12];
  return t("{month} Masam (Purnimanta)", { month: currentLang === "te" ? m.te : m.en });
}

// ---- Result detail (Phase 12: what each result must show) ----
function roleLabel(role, rule) {
  const spec = ((rule || currentRule())?.participants || []).find(p => p.role === role);
  return spec ? T(spec.label_en, spec.label_te) : role;
}

function limbWithTimes(lt, fallback) {
  if (!lt) return escapeHtml(fallback);
  const pada = lt.pada ? t(", pada {pada}", { pada: lt.pada }) : "";
  return `${escapeHtml(lt.name)}${pada}<br><small class="limb-time">${escapeHtml(lt.start)} – ${escapeHtml(lt.end)}</small>`;
}

function peopleStrengthHTML(people, rule) {
  const rows = people.filter(p => p.tara || p.chandrabala).map(p => {
    const tara = p.tara
      ? `<span class="pill ${p.tara.is_pass ? "pill--pass" : "pill--fail"}">${escapeHtml(T(p.tara.name, p.tara.name_te || p.tara.name))}</span>`
      : `<span class="pill pill--muted">${t("Not given")}</span>`;
    const cb = p.chandrabala
      ? `<span class="pill ${p.chandrabala.is_pass ? "pill--pass" : "pill--fail"}">${t("House {house}", { house: p.chandrabala.house })}</span>`
      : `<span class="pill pill--muted">${t("Not given")}</span>`;
    const basis = p.star_basis_used ? (p.star_basis_used === "nama" ? t("nama star") : t("janma star")) : "";
    return `<tr><th scope="row">${escapeHtml(roleLabel(p.role, rule))}${p.name ? `<br><small>${escapeHtml(p.name)}</small>` : ""}</th>
      <td>${tara}${basis ? `<br><small>${basis}</small>` : ""}</td><td>${cb}</td></tr>`;
  });
  if (!rows.length) return "";
  return `<div class="detail-card">
    <h4 class="detail-card__title">${Icon("users")} ${t("Strength for each person")}</h4>
    <div class="table-scroll"><table class="people-table">
      <thead><tr><th>${t("Person")}</th><th>${t("Tarabala")}</th><th>${t("Chandrabala")}</th></tr></thead>
      <tbody>${rows.join("")}</tbody></table></div></div>`;
}

const PLANET_LABEL = { jupiter: ["Jupiter (Guru)"], venus: ["Venus (Shukra)"], moon: ["Moon"] };
function lagnaStrengthHTML(det) {
  const lg = det.lagna || {};
  const strength = (det.planet_strength || []).map(s => {
    const [en, te] = PLANET_LABEL[s.planet] || [s.planet, s.planet];
    const bad = s.state === "combust" || s.state === "bala" || s.state === "vriddha";
    const extra = s.planet === "moon" ? ` · ${s.illumination}%` : (s.days ? t(" · {days} days", { days: s.days }) : "");
    const stateEn = { clear: "Strong", combust: "Combust", bala: "Child (bala)", vriddha: "Old (vriddha)", waxing: "Waxing", waning: "Waning" }[s.state] || s.state;
    return `<span class="pill ${bad ? "pill--fail" : "pill--pass"}">${t(en)}: ${escapeHtml(T(stateEn, s.state_te || stateEn))}${extra}</span>`;
  }).join(" ");
  const deg = lg.degree_dms ? t(" · {degree_dms} at {degree_at}", { degree_dms: lg.degree_dms, degree_at: lg.degree_at }) : "";
  return `<div class="detail-card">
    <h4 class="detail-card__title">${Icon("landmark")} ${t("Lagna and planet strength")}</h4>
    <div class="detail-card__grid">
      <div><strong>${t("Lagna:")}</strong> ${escapeHtml(T(lg.name || "—", lg.name_te || lg.name || "—"))}${escapeHtml(deg)}</div>
      <div><strong>${t("Navamsa:")}</strong> ${escapeHtml(te(lg.navamsa || "—", RASI_NAMES_TE))}${lg.is_pushkara_navamsa ? t(" (pushkara") + (lg.pushkara_minutes ? " " + escapeHtml(lg.pushkara_minutes.replace(/ \([^)]*\)/g, "")) : "") + ")" : ""}</div>
    </div>
    <div class="strength-row">${strength}</div>
  </div>`;
}

// Record-only details shown under the event on the Parishilana (names, gotra, shakha...).
const RECORD_FIELDS = [
  ["veda_shakha", "Veda shakha"], ["sutra", "Sutra"], ["varna", "Varna"],
  ["business_name", "Business"], ["business_type", "Business type"],
  ["origin", "From@@finder-results"], ["destination", "To"], ["travel_mode", "Mode"],
  ["house_type", "House"], ["vehicle_type", "Vehicle"],
];
// ---- Dosha rows ----
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const DOSHA_STATUS_LABEL = {
  pass: "Clear@@dosha", fail: "Dosha", not_evaluated: "Not evaluated", excepted: "Excepted",
  to_confirm: "To be confirmed", not_applicable: "N/A",
};

function doshaStatus(m) {
  if (m.status) return m.status;
  if (m.is_pass === null || m.is_pass === undefined) return "not_evaluated";
  return m.is_pass ? "pass" : "fail";
}

// Panchang limbs arrive as a string ("Saptami (Shukla)") or an object ({name, paksha}).
function limbName(x) {
  if (x === null || x === undefined || x === "") return "—";
  if (typeof x !== "object") return String(x);
  const name = x.name || x.name_en || "—";
  return x.paksha ? `${name} (${x.paksha})` : name;
}

// Shown on a dosha panel whose set the super admin left out of the score (Settings, 20 Nov 2026).
function notScoredNote() {
  return `<p class="portal-hint">${t("Shown for information only: this event has no score for these (switched off in Settings).")}</p>`;
}

function doshaTally(list) {
  const n = s => list.filter(m => doshaStatus(m) === s).length;
  return t("{n} clear · {m} dosha", { n: n("pass"), m: n("fail") }) + (n("excepted") ? " · " + t("{n} excepted", { n: n("excepted") }) : "")
    + " · " + t("{n} not evaluated", { n: n("not_evaluated") });
}

function doshaItemHTML(m, title, desc, kind) {
  const status = doshaStatus(m);
  const itemCls = status === "fail" ? `dosha-item--fail-${kind}` : status === "pass" ? "dosha-item--pass" : (status === "excepted" || status === "to_confirm") ? "dosha-item--excepted" : "dosha-item--muted";
  const badgeCls = status === "fail" ? "dosha-item__badge--fail" : status === "pass" ? "dosha-item__badge--pass" : (status === "excepted" || status === "to_confirm") ? "dosha-item__badge--excepted" : "dosha-item__badge--muted";
  const descCls = status === "fail" ? "dosha-item__desc--fail" : status === "pass" ? "dosha-item__desc--pass" : "dosha-item__desc--muted";
  const label = t(DOSHA_STATUS_LABEL[status] || DOSHA_STATUS_LABEL.pass);
  const sev = status === "fail" && m.severity && m.severity !== "info" ? ` · ${m.severity}` : "";
  const ref = m.book_ref ? `<div class="dosha-item__ref">${escapeHtml(m.book_ref)}</div>` : "";
  return `
        <div class="dosha-item ${itemCls}">
          <div class="dosha-item__header">
            <strong class="dosha-item__name">${escapeHtml(title)}</strong>
            <span class="dosha-item__badge ${badgeCls}">${label}${sev}</span>
          </div>
          <div class="${descCls}">${escapeHtml(desc)}</div>
          ${ref}
        </div>`;
}

// ---- Render Results ----
// Best 1-2 a day (21 Nov 2026): the server marks each day's best two lagnas day_best; the rest are hidden
// until the user asks for them. Results saved before then have no day_best and are always shown.
var showOtherLagnas = false;
function toggleOtherLagnas() {
  showOtherLagnas = !showOtherLagnas;
  if (lastData) renderResults(lastData);
}

function renderResults(data) {
  el("mfResults").style.display = "block";
  // `results` stays the full list so every card's index still points into lastData.results ("Full analysis");
  // `inView` is the day's best 1-2 (or everything once "Show the other lagnas" is on).
  const results = data.results || data.candidates || [];
  const hiddenOther = results.filter(r => r.day_best === false).length;
  const inView = r => showOtherLagnas || r.day_best !== false;
  const visible = results.filter(inView);
  const title = currentLang === "te" ? (data.title_te || data.title_en) : data.title_en;

  // Summary boxes double as filters (11 Nov 2026): Excellent >= 75 %, Medium 50-74 %, Avoid < 50 %.
  const band = r => { const p = r.percentage || 0; return p >= 75 ? "excellent" : p >= 50 ? "medium" : "avoid"; };
  const count = b => visible.filter(r => band(r) === b).length;
  const tile = (key, n, numCls, en, te) => `
    <button type="button" class="summary-stat summary-stat--filter${bandFilter === key ? " is-active" : ""}" data-band="${key}"
            aria-pressed="${bandFilter === key}" title="${escapeHtml(t("Show only these"))}">
      <span class="num ${numCls}">${n}</span>
      <span class="label">${escapeHtml(t(en))}</span>
    </button>`;
  // Notices the search must show, e.g. Godavari Pushkaralu (13 Nov 2026): no muhurtas near the river then.
  const notices = (data.notices || []).map(n =>
    `<div class="info-banner notice-banner" role="note">${escapeHtml(T(n.en, n.te))}</div>`).join("");
  el("summaryBar").innerHTML = notices +
    tile("excellent", count("excellent"), "num--excellent", "Excellent@@finder-results") +
    tile("medium", count("medium"), "num--favorable", "Medium@@finder-results") +
    tile("avoid", count("avoid"), "num--unfavorable", "Avoid@@finder-results") +
    tile("", visible.length, "num--muhurta", "All muhurtas") +
    (hiddenOther ? `<button type="button" class="btn btn--sm btn--outline other-lagnas-toggle" onclick="toggleOtherLagnas()" aria-pressed="${showOtherLagnas}">${escapeHtml(showOtherLagnas
      ? t("Show only the best 1–2 a day")
      : t("Show the other lagnas ({hiddenOther})", { hiddenOther: hiddenOther }))}</button>` : "");

  // Day cards
  const grid = el("dayGrid");
  grid.innerHTML = "";

  // Minimum score (11 Nov 2026): hide cards below it, but keep each card's index into lastData so
  // "Full analysis" still opens the right one.
  const minScore = Number(el("mfMinScore")?.value || 0);
  const passes = r => inView(r) && (r.percentage || 0) >= minScore && (!bandFilter || band(r) === bandFilter)
                    && (!eventFilter || (r._event && r._event.id === eventFilter));
  renderEventFilter(data, results);
  const shownCount = results.filter(passes).length;
  const bandName = { excellent: t("Excellent"), medium: t("Medium"), avoid: t("Avoid") }[bandFilter];
  if (results.length > 0 && shownCount === 0 && bandFilter) {
    grid.innerHTML = `<div class="empty-state"><p>${escapeHtml(t("No {bandName} muhurtas among the {results} loaded so far. Choose \"All muhurtas\" to see every one.", { bandName: bandName, results: results.length }))}</p></div>`;
    return;
  }
  if (results.length > 0 && shownCount === 0) {
    const top = Math.max(...results.map(r => r.percentage || 0));
    grid.innerHTML = `<div class="empty-state"><p>${escapeHtml(t("{results} muhurtas were found, but none reaches {minScore}%. The best is {top}%. Lower the minimum score to see them.", { results: results.length, minScore: minScore, top: top }))}</p></div>`;
    return;
  }
  if (minScore > 0 || bandFilter) {
    const what = [bandName, minScore > 0 ? t("{minScore}% or above", { minScore: minScore }) : ""].filter(Boolean).join(", ");
    grid.innerHTML = `<p class="results-filter-note">${escapeHtml(t("Showing {shownCount} of {results} muhurtas: {what}.", { shownCount: shownCount, results: results.length, what: what }))}</p>`;
  }

  if (results.length === 0) {
    const reasons = (data.rejection_summary || []).slice(0, 5)
      .map(x => `<li>${escapeHtml(x.reason)} <span class="reject-count">× ${x.count}</span></li>`).join("");
    const strictNote = data.strictness === "strict"
      ? (t("This app is set to Strict: windows with a mahadosha or a missed rule are hidden. Switching Settings › Finder to \"Show all\" lists them, marked."))
      : "";
    grid.innerHTML = `
      <div class="empty-state">
        <p>${t(data.monthRanges ? (data.poolDone ? "No muhurta for this event in the chosen months. Try other months or another year." : "Nothing yet; looking through the next month…")
          : (paging && !paging.done ? "Nothing in the first {days} days; looking further…" : (paging && paging.payload.date_to ? "No muhurta for this event between the chosen dates. Try other dates." : "No muhurta passed the book's rules within one year of the start date. Try another start date.")),
          { days: data.days_scanned })}</p>
        ${reasons ? `<p class="empty-state__label">${t("Most common reasons windows were rejected:")}</p><ul class="empty-state__reasons">${reasons}</ul>` : ""}
        ${strictNote ? `<p class="empty-state__note">${strictNote}</p>` : ""}
      </div>`;
    return;
  }

  if (resultView === "compact" || data.allEvents) {
    renderCompactList(data, results, passes, grid);
    return;
  }

  let lastMonthHead = null;
  results.forEach((r, idx) => {
    if (!passes(r)) return;
    if (data.monthRanges) {
      const m = data.monthRanges.find(x => r.date >= x.start && r.date <= x.end);
      const key = m ? m.start : null;
      if (m && key !== lastMonthHead) {
        lastMonthHead = key;
        grid.insertAdjacentHTML("beforeend", `<h3 class="pool-month">${escapeHtml(T(m.name_en, m.name_te))} <small>${escapeHtml(m.start)} – ${escapeHtml(m.end)}</small></h3>`);
      }
    }
    const vaaraTe = VAARA_NAMES[currentLang][r.panchang?.vaara] || r.panchang?.vaara || "—";
    const nakRaw = typeof r.panchang?.nakshatra === 'object' ? r.panchang.nakshatra.name : (r.panchang?.nakshatra || "");
    const nakTe = te(nakRaw, NAKSHATRA_NAMES_TE) || nakRaw || "—";
    const tithiRaw = typeof r.panchang?.tithi === 'object' ? `${r.panchang.tithi.name || ''} (${r.panchang.tithi.paksha || ''})` : (r.panchang?.tithi || "—");
    const tName = typeof tithiRaw === 'string' ? tithiRaw.split(" ")[0] : "";
    const pName = typeof tithiRaw === 'string' && tithiRaw.toLowerCase().includes("shukla") ? "Shukla" : "Krishna";
    const tithiTe = currentLang === "te" ? `${te(tName, TITHI_NAMES_TE) || tName} (${PAKSHA_NAMES.te[pName] || pName})` : tithiRaw;

    const pct = r.percentage || 70;
    const isAvoid = pct < 50;
    const isGood = pct >= 75;
    const verdictClass = isAvoid ? "unfavorable" : (isGood ? "highly_favorable" : "favorable");
    const verdictText = t(isAvoid ? "Avoid@@verdict" : (isGood ? "Excellent@@verdict" : "Medium@@verdict"));
    // Amsha of the lagna inside this window (Pushkaramsha / Vargottamamsha / Shubhamsha) and when it starts.
    const am = r.amsha;
    const amshaHtml = am && am.type !== "none"
      ? `<div class="amsha-row"><span class="amsha-badge amsha-badge--${escapeHtml(am.type)}">${escapeHtml(T(am.name_en, am.name_te))}</span>` +
        `<span class="amsha-row__time">${escapeHtml(t("best from {at}", { at: am.at }))}${am.navamsa ? ` · ${escapeHtml(t("{navamsa} navamsa", { navamsa: am.navamsa }))}` : ""}</span></div>`
      : "";
    // Doshapavada (book paras 1972-78): the book's exceptions present in this lagna. "all" ones cancel the
    // lagna doshas (not mahadoshas); "partial" ones count as a plus.
    const apv = r.doshapavada || [];
    const apavadaHtml = apv.length ? `<div class="apavada-row">${apv.map(a =>
      `<span class="apavada-chip apavada-chip--${a.kind === "all" ? "all" : "partial"}">✓ ${escapeHtml(T(a.en, a.te))}</span>`).join("")}</div>` : "";
    // Rahu kalam / Yamagandam / Gulika inside the window: information only. Book para 1681: by shastra only
    // the vara-janita durmuhurtas are followed, so these no longer cut windows or lower the score.
    const kalas = r.custom_kalas || [];
    const kalaHtml = kalas.length ? `<div class="custom-kala-note">${escapeHtml(t("Overlaps {end}: a custom, not shastra (book para 1681), so it is not counted.", { end: kalas.map(k => `${k.name} ${k.start}–${k.end}`).join(", ") }))}</div>` : "";
    // Age of the child on this date (only when the birth date was given): 0 preferred, 1 "if needed", 2 outside.
    const ag = r.age;
    const ageHtml = ag ? `<div class="amsha-row"><span class="bala bala--${ag.tier === 0 ? "ok" : ag.tier === 1 ? "warn" : "bad"}">${
      ag.tier === 0 ? "✓" : ag.tier === 1 ? "!" : "✕"} ${escapeHtml(t("Age"))}: ${escapeHtml(ag.text)}</span></div>` : "";
    // Each person's tarabala and chandrabala for this window (only when their star was given).
    const people = (r.detail?.people || []).filter(p => p.tara || p.chandrabala);
    const personalHtml = people.length ? `<div class="personal-bala">${people.map(p => {
      const who = p.name || (p.role ? String(p.role) : t("Person"));
      const tara = p.tara ? `<span class="bala bala--${p.tara.is_pass ? "ok" : "bad"}">${p.tara.is_pass ? "✓" : "✕"} ${escapeHtml(t("Tarabala"))}: ${escapeHtml(T(p.tara.name, p.tara.name_te || p.tara.name))}</span>` : "";
      const cb = p.chandrabala ? `<span class="bala bala--${p.chandrabala.is_pass ? "ok" : "bad"}">${p.chandrabala.is_pass ? "✓" : "✕"} ${escapeHtml(t("Chandrabala"))}${p.chandrabala.house ? ` (${p.chandrabala.house}${t("th")})` : ""}</span>` : "";
      return `<div class="personal-bala__row"><strong>${escapeHtml(who)}</strong>${tara}${cb}</div>`;
    }).join("")}</div>` : "";
    const mahaCount = r.audit?.mahadosha?.failed || 0;
    const mahaTag = mahaCount ? ` · ${t("{mahaCount} mahadosha not matched", { mahaCount: mahaCount })}` : "";

    const windowTimeStr = r.window_start ? `${r.window_start} – ${r.window_end}` : (r.start_time ? `${r.start_time} – ${r.end_time}` : "");
    const lagnaLabel = currentLang === "te" ? (r.lagna_te || r.lagna_en || "") : (r.lagna_en || "");

    // Eval dots
    const d = r.detailed_eval;
    let dotsHtml = "";
    if (d) {
      const checks = [
        { label: t("Vaara"), pass: d.vaara?.is_pass },
        { label: t("Tithi@@finder-results"), pass: d.tithi?.is_pass },
        { label: t("Nak"), pass: d.nakshatra?.is_pass },
        { label: t("8th"), pass: d.ashtama_shuddhi?.has_shuddhi },
      ];
      if (d.lagna?.is_pushkara_navamsa) {
        checks.push({ label: t("P.Nav"), pass: true });
      }
      if (d.tara) {
        checks.push({ label: t("Tara"), pass: d.tara?.is_pass });
      }
      if (d.chandrabalam) {
        checks.push({ label: t("Chandra"), pass: d.chandrabalam?.is_pass });
      }
      if (d.panchaka) {
        checks.push({ label: t("Panchaka@@finder-results"), pass: d.panchaka?.is_pass });
      }
      dotsHtml = `<div class="eval-dots" style="margin-top: 8px;">${checks.map(c =>
        `<span class="eval-dot ${c.pass ? 'pass' : 'fail'}">${c.pass ? '✓' : '✕'} ${c.label}</span>`
      ).join("")}</div>`;
    }

    // Pushkara Box
    let pushMini = "";
    if (r.pushkara_info) {
      const pi = r.pushkara_info;
      const stmt = currentLang === "te" ? pi.statement_te : pi.statement_en;
      pushMini = `
        <div class="pushkara-mini" style="margin-top: 10px;">
          <strong>${Icon("clock")} ${stmt}</strong>
          <div class="pushkara-mini__details" style="font-size: 12px; margin-top: 4px; color: #555;">
            ${windowTimeStr ? `${Icon("landmark")} <strong>${t("Muhurtha Window:")}</strong> ${windowTimeStr} (${escapeHtml(t("{name} lagna", { name: lagnaLabel }))})` : ""}
            ${pi.pushkara_bhaga?.is_available ? `<br>${Icon("pin")} <strong>${t("P. Bhaga:")}</strong> ${pi.pushkara_bhaga.precise_time} (${pi.pushkara_bhaga.time_window})` : ""}
            ${pi.pushkara_navamsha?.is_available ? `<br>${Icon("pin")} <strong>${t("P. Navamsha:")}</strong> ${pi.pushkara_navamsha.precise_time}` : ""}
          </div>
        </div>`;
    }

    // Reasons chips
    let reasonsHtml = "";
    if (r.reasons && r.reasons.length > 0) {
      reasonsHtml = `<ul class="activity-reasons" style="margin-top: 8px; font-size: 12px; color: #444; line-height: 1.5;">${r.reasons.slice(0, 4).map(re => `<li>${re}</li>`).join("")}</ul>`;
    }

    // Special yogas
    let yogasHtml = "";
    if (r.special_yogas && r.special_yogas.length > 0) {
      yogasHtml = `<div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">${r.special_yogas.map(y => `<span class="rule-chip" style="background:var(--color-warning-bg); color:var(--color-warning); font-size:11px;">${Icon("sparkle")} ${currentLang === 'te' ? y.name_te : y.name_en}</span>`).join("")}</div>`;
    }

    grid.innerHTML += `
      <div class="day-card ${verdictClass}" onclick="openDayModal(${idx})" style="cursor: pointer; margin-bottom: 16px;">
        ${auditBannerHTML(r.audit, true)}
        <div class="day-header">
          <div>
            <div class="day-date" style="font-size: 16px; font-weight: 700;">${r.date} · ${vaaraTe}</div>
            <div class="day-vaara" style="font-size: 13px; color: #777;">
              ${r.panchang?.chandramana ? `${Icon("lamp")} ${r.panchang.chandramana.month_name || ''} · ${tithiTe}` : tithiTe} · ${nakTe}
            </div>
          </div>
          <div class="day-right">
            <span class="verdict-badge ${verdictClass}" title="${escapeHtml(t("Basic muhurta rules"))}">${escapeHtml(t("Muhurta@@finder-results"))} ${pct}% · ${verdictText}${mahaTag}</span>
            <div class="score-chips">${doshaScoreChips(r)}</div>
          </div>
        </div>
        ${amshaHtml}
        ${apavadaHtml}
        ${ageHtml}
        ${kalaHtml}
        ${pushMini}
        ${personalHtml}
        ${dotsHtml}
        ${yogasHtml}
        ${reasonsHtml}
        <div style="margin-top: 12px; text-align: right;">
          <button type="button" onclick="event.stopPropagation(); openDayModal(${idx})" class="btn btn--primary btn--sm" style="font-size: 12px; padding: 6px 14px;">
            ${Icon("search")} ${t("Details and lagna chart →")}
          </button>
        </div>
      </div>
    `;
  });
}
// ---- Dosha audit banner (plan B1): "0 of 21 mahadoshas · 0 of 10 dashavidha doshas" ----
// Green: nothing failed. Amber: a dosha the author's rule excepts (Jupiter in the lagna) or a lesser
// dosha. Red: a mahadosha did not match (listed with a lower percentage; hidden in Strict mode).
function auditBannerHTML(a, compact) {
  if (!a) return "";
  const m = a.mahadosha || {}, d = a.dashavidha || {};
  const parts = [];
  if (m.checked) parts.push(t("{failed} of 21 mahadoshas", { failed: m.failed }));
  if (d.checked) parts.push(t("{failed} of 10 dashavidha doshas", { failed: d.failed }));
  // Red: which mahadosha(s) did not match. The window is still listed, with a lower percentage (11 Nov 2026).
  const failedNames = T((a.maha_failed_en || []).join(", "), (a.maha_failed_te || []).join(", "));
  const head = { green: t("Clean"), amber: t("Clean with exception"),
                 red: t("Mahadosha not matched") + (failedNames ? ": " + failedNames : "") }[a.colour] || "";
  const exc = (a.excepted || []).length && !compact
    ? `<div class="audit-banner__note">${escapeHtml(t("Neutralised by a good Jupiter, Mercury or Venus in the muhurta lagna: ") + a.excepted.join(", "))}</div>` : "";
  const tc = (a.to_confirm || []).length && !compact
    ? `<div class="audit-banner__note">${escapeHtml(t("Shown, not blocking, until Dr. Nemani confirms: ") + a.to_confirm.join(", "))}</div>` : "";
  const ne = (m.not_evaluated || 0) + (d.not_evaluated || 0);
  const neNote = ne && !compact ? `<div class="audit-banner__note">${escapeHtml(t("{ne} check(s) could not be made with the details given.", { ne: ne }))}</div>` : "";
  return `<div class="audit-banner audit-banner--${escapeHtml(a.colour)}${compact ? " audit-banner--compact" : ""}" role="note">
    <strong>${escapeHtml(head)}</strong>${parts.length ? ` · ${escapeHtml(parts.join(" · "))}` : ""}${exc}${tc}${neNote}</div>`;
}
