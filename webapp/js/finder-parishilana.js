// ============================================================
// Muhurtham App · Muhurta Finder component: Muhurta Parishilana: one muhurta in full (hero, why, tabs), previous / next, reopen.
// Split from finder.js (21 Nov 2026). Plain script: the page loads the finder-*.js files in order
// (see muhurta-finder.html); they share one global scope, and finder-init.js runs last.
// requires: js/config.js, js/i18n.js, js/regions.js, js/stars.js
// ============================================================

// ---- Modal ----
let openDayIdx = null;          // index of the muhurta open in the Parishilana
// ---- Muhurta Parishilana (rebuilt 21 Nov 2026, user's layout choice "verdict first, tabs") ----
// Top: this muhurta (event, date, time, lagna, %, how the % is made, pushkara inside the window) and why
// the % is what it is. Below: tabs for the detail. The event is the muhurta's own (r._event), never the
// event picked in the form now (that showed "Dvitiya Vivaha" for a Vivaha muhurta).
let paTab = "doshas";
const PA_TABS = [
  ["doshas", "Doshas", "దోషాలు"], ["rules", "Event rules", "కార్య నియమాలు"], ["panchang", "Panchang", "పంచాంగం"],
  ["chart", "Chart", "చక్రం"], ["day", "Day timings", "రోజు సమయాలు"]];

function paRuleFor(r) {
  const id = r?._event?.id || lastData?.activity_id;
  return allMuhurtaRules.find(x => x.id === id) || null;
}
function paEventTitle(r) {
  if (r?._event) return T(r._event.en, r._event.te || r._event.en);
  const rule = paRuleFor(r);
  return T(rule?.title_en || lastData?.title_en || "Muhurta", rule?.title_te || lastData?.title_te || "ముహూర్తం");
}
const hm = t => String(t || "").slice(0, 5);
const PA_FAIL_RANK = { fail: 0, excepted: 1, to_confirm: 2, not_evaluated: 3, pass: 4, not_applicable: 5 };
const paFailFirst = list => [...list].sort((a, b) => (PA_FAIL_RANK[doshaStatus(a)] ?? 9) - (PA_FAIL_RANK[doshaStatus(b)] ?? 9));
const paName = m => String(T(m.name_en, m.name_te || m.name_en) || "").replace(/^\d+\.\s*/, "");

function paHeroHTML(r) {
  const lg = r.detailed_eval?.lagna || {}, pct = r.percentage ?? 0, band = bandClass(pct);
  const vaara = VAARA_NAMES[currentLang]?.[r.panchang?.vaara] || r.panchang?.vaara || "";
  const place = lastData?.place_name || placeName() || "";
  const bandName = { excellent: T("Uttama muhurta", "ఉత్తమ ముహూర్తం"), medium: T("Madhyama muhurta", "మధ్యమ ముహూర్తం"),
                     avoid: T("Nishiddha: avoid", "నిషిద్ధం") }[band];
  const rule = paRuleFor(r);
  const people = (lastData?.participants || []).filter(p => p.name || p.gotra).map(p =>
    `${roleLabel(p.role, rule)}: ${p.name || "—"}${p.gotra ? ` (${T("gotra", "గోత్రం")} ${p.gotra})` : ""}`);
  const ap = lastData?.activity_params || {};
  const rec = RECORD_FIELDS.filter(([k]) => ap[k]).map(([k, en, tel]) => `${T(en, tel)}: ${ap[k]}`);
  const lagna = T(`${lg.name || "—"} lagna`, `${lg.name_te || lg.name || "—"} లగ్నం`);
  const nav = lg.navamsa ? T(`${lg.navamsa} navamsa`, `${te(lg.navamsa, RASI_NAMES_TE) || lg.navamsa} నవాంశ`) : "";
  const age = r.age?.text ? `<p class="pa-hero__meta">${escapeHtml(r.age.text)}</p>` : "";
  return `<section class="pa-hero pa-hero--${band}" aria-label="${escapeHtml(T("This muhurta", "ఈ ముహూర్తం"))}">
    <div class="pa-hero__main">
      <p class="pa-hero__event">${escapeHtml(paEventTitle(r))}</p>
      <p class="pa-hero__date">${escapeHtml(dmy(r.date))} · ${escapeHtml(vaara)}${place ? ` · ${escapeHtml(place)}` : ""}</p>
      <p class="pa-hero__time">${escapeHtml(hm(r.window_start))} – ${escapeHtml(hm(r.window_end))}
        ${r.duration_minutes ? `<small>${escapeHtml(T(`${r.duration_minutes} min`, `${r.duration_minutes} నిమి.`))}</small>` : ""}</p>
      <p class="pa-hero__lagna">${escapeHtml(lagna)}${nav ? ` · ${escapeHtml(nav)}` : ""}</p>
      ${people.length ? `<p class="pa-hero__meta">${escapeHtml(people.join(" · "))}</p>` : ""}
      ${rec.length ? `<p class="pa-hero__meta">${escapeHtml(rec.join(" · "))}</p>` : ""}${age}
    </div>
    <div class="pa-hero__score">
      <span class="pa-hero__pct">${pct}<small>%</small></span>
      <span class="pa-hero__band">${escapeHtml(bandName)}</span>
    </div>
    ${paSplitHTML(r)}
    ${paPushkaraHTML(r)}
  </section>`;
}

// How the % is made (A8): panchanga shuddhi + mahadoshas (+ dashavidha for marriage), each with its share.
function paSplitHTML(r) {
  const a = r.audit_points || {};
  const ps = r.detailed_eval?.panchanga_shuddhi;     // the five angas (21 Nov 2026, option B)
  const rows = [
    [T("Panchanga shuddhi", "పంచాంగ శుద్ధి"), a.panchanga_weight, a.main_share, ps
      ? T(`${ps.passed} of ${ps.checked} angas`, `${ps.checked} లో ${ps.passed} అంగాలు`) : ""],
    [T("Mahadoshas", "మహాదోషాలు"), a.maha_weight, a.maha_share,
      r.maha_score ? T(`${r.maha_score.passed} of ${r.maha_score.checked} clear`, `${r.maha_score.checked} లో ${r.maha_score.passed} శుద్ధం`) : ""],
    [T("Dashavidha doshas", "దశవిధ దోషాలు"), a.dashavidha_weight, a.dasha_share,
      r.dasha_score ? T(`${r.dasha_score.passed} of ${r.dasha_score.checked} clear`, `${r.dasha_score.checked} లో ${r.dasha_score.passed} శుద్ధం`) : ""],
  ].filter(([, w, s]) => w > 0 && s !== null && s !== undefined);
  if (!rows.length) return "";
  return `<div class="pa-split" aria-label="${escapeHtml(T("How the percentage is made", "శాతం ఎలా వచ్చింది"))}">${rows.map(([name, w, s, note]) => `
    <div class="pa-split__row">
      <span class="pa-split__name">${escapeHtml(name)} <small>${T(`weight ${w}%`, `వాటా ${w}%`)}</small></span>
      <span class="pa-bar" role="img" aria-label="${s}%"><span class="pa-bar__fill pa-bar__fill--${bandClass(s)}" style="width:${Math.max(0, Math.min(100, s))}%"></span></span>
      <span class="pa-split__val">${s}%${note ? `<small>${escapeHtml(note)}</small>` : ""}</span>
    </div>`).join("")}</div>`;
}

// Pushkara navamsha and pushkara bhaga inside THIS window (server: pushkara_window).
function paPushkaraHTML(r) {
  const pw = r.pushkara_window;
  const badges = [];
  if (pw) {
    const nav = pw.navamsha || {}, bh = pw.bhaga || {};
    if (nav.in_window) {
      const spans = nav.spans.map(s => `${s.start}–${s.end}${s.navamsa ? ` (${T(s.navamsa, te(s.navamsa, RASI_NAMES_TE) || s.navamsa)})` : ""}`).join(", ");
      badges.push(["good", T(`Pushkara navamsha in this muhurta: ${spans}`, `ఈ ముహూర్తంలో పుష్కర నవాంశ: ${spans}`)]);
    } else {
      badges.push(["none", T("No pushkara navamsha in this muhurta", "ఈ ముహూర్తంలో పుష్కర నవాంశ లేదు")]);
    }
    if (bh.in_window) {
      badges.push(["good", T(`Pushkara bhaga in this muhurta: ${bh.at} (${bh.degree}°)`, `ఈ ముహూర్తంలో పుష్కర భాగం: ${bh.at} (${bh.degree}°)`)]);
    } else if (bh.touches_window) {
      badges.push(["near", T(`Close to pushkara bhaga: exact at ${bh.at}, near ${bh.span}`, `పుష్కర భాగానికి సమీపం: ఖచ్చితంగా ${bh.at}, సమీపం ${bh.span}`)]);
    } else if (bh.at) {
      badges.push(["none", T(`Pushkara bhaga of this lagna is at ${bh.at}, outside this muhurta`, `ఈ లగ్న పుష్కర భాగం ${bh.at}కు, ఈ ముహూర్తం బయట`)]);
    } else {
      badges.push(["none", T("No pushkara bhaga in this lagna", "ఈ లగ్నంలో పుష్కర భాగం లేదు")]);
    }
  } else {
    // Results saved before 21 Nov 2026 have only the navamsha.
    const lg = r.detailed_eval?.lagna || {};
    badges.push(lg.is_pushkara_navamsa
      ? ["good", T(`Pushkara navamsha in this muhurta: ${lg.pushkara_minutes || ""}`, `ఈ ముహూర్తంలో పుష్కర నవాంశ: ${lg.pushkara_minutes || ""}`)]
      : ["none", T("No pushkara navamsha in this muhurta", "ఈ ముహూర్తంలో పుష్కర నవాంశ లేదు")]);
  }
  if (r.amsha?.type === "vargottama") badges.push(["near", T(`Vargottamamsha from ${r.amsha.at}`, `${r.amsha.at} నుండి వర్గోత్తమాంశ`)]);
  return `<div class="pa-pushkara">${badges.map(([k, txt]) =>
    `<span class="pa-pill pa-pill--${k}">${Icon(k === "none" ? "moon" : "sparkle")} ${escapeHtml(txt)}</span>`).join("")}</div>`;
}

// What lowered the % (A3: every failed dosha lowers it), and what was neutralised.
function paWhyHTML(r) {
  const d = r.detailed_eval || {};
  const fails = list => (list || []).filter(m => doshaStatus(m) === "fail");
  const maha = d.mahadoshas_scored === false ? [] : fails(d.maha_doshas);
  const dasha = d.dashavidha_enforced === false ? [] : fails(d.dashavidha_doshas);
  const extra = d.extra_checks || [];
  const misses = fails(extra.filter(x => String(x.id || "").startsWith("rule_miss_")));
  const others = fails(extra.filter(x => !String(x.id || "").startsWith("rule_miss_"))).concat(fails(d.yoga_doshas));
  const neutral = [...(d.maha_doshas || []), ...(d.dashavidha_doshas || []), ...extra, ...(d.yoga_doshas || [])].filter(m => doshaStatus(m) === "excepted");
  const notEval = [...(d.maha_doshas || []), ...(d.dashavidha_doshas || [])].filter(m => doshaStatus(m) === "not_evaluated").length;
  const group = (title, items, kind) => items.length ? `<div class="pa-why__group"><h4>${escapeHtml(title)} <span>${items.length}</span></h4>
    <div class="pa-why__chips">${items.map(m => `<span class="pa-pill pa-pill--${kind}" title="${escapeHtml(T(m.desc_en, m.desc_te || m.desc_en) || "")}">${escapeHtml(paName(m))}</span>`).join("")}</div></div>` : "";
  const missList = misses.length ? `<div class="pa-why__group"><h4>${escapeHtml(T("Event rules not met", "సరిపోని కార్య నియమాలు"))} <span>${misses.length}</span></h4>
    <ul class="pa-why__list">${misses.map(m => `<li>${escapeHtml(m.desc_en || "")}</li>`).join("")}</ul></div>` : "";
  const body = group(T("Mahadoshas present", "ఉన్న మహాదోషాలు"), maha, "bad") +
               group(T("Dashavidha doshas present", "ఉన్న దశవిధ దోషాలు"), dasha, "bad") + missList +
               group(T("Other checks failed (not in the %)", "ఇతర పరిశీలనలు (శాతంలో లేవు)"), others, "near") +
               group(T("Neutralised", "నివారణ అయినవి"), neutral, "good");
  const clean = !maha.length && !dasha.length && !misses.length;
  const head = clean ? T("Every counted check passed", "లెక్కించిన పరిశీలనలన్నీ శుద్ధం") : T("Why the percentage is lower", "శాతం ఎందుకు తగ్గింది");
  const ben = r.audit?.benefics_in_lagna || [];
  const benNote = ben.length ? `<p class="pa-note">${escapeHtml(T(
    `${ben.map(b => b[0].toUpperCase() + b.slice(1)).join(", ")} in the lagna neutralises the doshas (Dr. Nemani's ruling).`,
    `లగ్నంలో ${ben.map(b => ({ jupiter: "గురుడు", mercury: "బుధుడు", venus: "శుక్రుడు" }[b] || b)).join(", ")} ఉన్నందున దోషాలు నివారణ (డా. నేమాని గారి నిర్ణయం).`))}</p>` : "";
  const neNote = notEval ? `<p class="pa-note">${escapeHtml(T(`${notEval} check(s) could not be made with the details given.`, `ఇచ్చిన వివరాలతో ${notEval} పరిశీలనలు చేయలేకపోయాము.`))}</p>` : "";
  return `<section class="pa-why pa-why--${clean ? "clean" : "issues"}"><h3 class="pa-why__title">${Icon(clean ? "sparkle" : "alert")} ${escapeHtml(head)}</h3>${body}${benNote}${neNote}</section>`;
}

function paTabsHTML(r) {
  const d = r.detailed_eval || {};
  const nFail = [...(d.maha_doshas || []), ...(d.dashavidha_doshas || [])].filter(m => doshaStatus(m) === "fail").length;
  const nMiss = (d.extra_checks || []).filter(x => String(x.id || "").startsWith("rule_miss_") && doshaStatus(x) === "fail").length;
  const count = { doshas: nFail, rules: nMiss };
  return `<div class="pa-tabs no-print" role="tablist" aria-label="${escapeHtml(T("Muhurta details", "ముహూర్త వివరాలు"))}" onkeydown="paTabKey(event)">${PA_TABS.map(([id, en, tel]) => `
    <button type="button" role="tab" id="paTab_${id}" aria-controls="paPanel_${id}" aria-selected="${id === paTab}" tabindex="${id === paTab ? 0 : -1}"
      class="pa-tab${id === paTab ? " is-active" : ""}" onclick="paShowTab('${id}')">${escapeHtml(T(en, tel))}${count[id] ? `<span class="pa-tab__count">${count[id]}</span>` : ""}</button>`).join("")}</div>`;
}
function paShowTab(id) {
  paTab = id;
  PA_TABS.forEach(([t]) => {
    const tab = el(`paTab_${t}`), panel = el(`paPanel_${t}`);
    if (tab) { tab.classList.toggle("is-active", t === id); tab.setAttribute("aria-selected", t === id); tab.tabIndex = t === id ? 0 : -1; }
    if (panel) panel.hidden = t !== id;
  });
}
function paTabKey(e) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const ids = PA_TABS.map(t => t[0]);
  const next = ids[(ids.indexOf(paTab) + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length];
  paShowTab(next);
  el(`paTab_${next}`)?.focus();
  e.preventDefault();
}
const paPanel = (id, html) => `<div class="pa-panel" role="tabpanel" id="paPanel_${id}" aria-labelledby="paTab_${id}" ${id === paTab ? "" : "hidden"}>${html}</div>`;

function paDoshaList(cls, icon, title, score, list, kind, note) {
  return `<div class="dosha-panel dosha-panel--${cls} pa-wide">
    <div class="dosha-panel__header dosha-panel__header--${cls}"><span>${Icon(icon)} ${escapeHtml(title)}</span>
      <span class="dosha-panel__score dosha-panel__score--${cls}">${score}</span></div>
    <div class="dosha-panel__body dosha-panel__body--${cls}">${note || ""}${paFailFirst(list).map(m =>
      doshaItemHTML(m, T(m.name_en, m.name_te || m.name_en), T(m.desc_en, m.desc_te || m.desc_en), kind)).join("")}</div></div>`;
}

function paDoshasPanel(r) {
  const d = r.detailed_eval || {};
  let h = "";
  if (d.maha_doshas?.length) {
    h += paDoshaList("maha", "flame", T("21 mahadoshas", "ఏకవింశతి మహాదోషాలు"),
      (r.maha_score ? `${r.maha_score.percentage}% · ` : "") + doshaTally(d.maha_doshas), d.maha_doshas, "maha",
      d.mahadoshas_scored === false ? notScoredNote() : "");
  }
  if (d.dashavidha_doshas?.length) {
    const note = d.dashavidha_enforced === false
      ? `<p class="portal-hint">${T("Marriage only: shown for information, not in this event's percentage.", "వివాహానికి మాత్రమే: సమాచారం కోసం చూపిస్తాం, ఈ కార్య శాతంలో లేదు.")}</p>` : "";
    h += paDoshaList("dasha", "zap", T("10 dashavidha doshas", "దశవిధ దోషాలు"),
      (r.dasha_score ? `${r.dasha_score.percentage}% · ` : "") + doshaTally(d.dashavidha_doshas), d.dashavidha_doshas, "dasha", note);
  }
  const others = (d.extra_checks || []).filter(x => !String(x.id || "").startsWith("rule_miss_")).concat(d.yoga_doshas || []);
  if (others.length) {
    h += paDoshaList("dasha", "shield", T("Other checks (listed, not in the %)", "ఇతర పరిశీలనలు (శాతంలో లేవు)"), doshaTally(others), others, "dasha", "");
  }
  const pariharas = d.pariharas || [];
  if (pariharas.length) {
    h += `<div class="dosha-panel dosha-panel--pariharam pa-wide">
      <div class="dosha-panel__header dosha-panel__header--pariharam"><span>${Icon("shield")} ${T("Pariharas present in this muhurta", "ఈ ముహూర్తంలో పరిహారాలు")}</span>
        <span class="dosha-panel__score dosha-panel__score--pariharam">${pariharas.length}</span></div>
      <div class="dosha-panel__body dosha-panel__body--pariharam">${pariharas.map(pr => `
        <div class="pariharam-item"><div class="pariharam-item__header">
          <strong class="pariharam-item__name">${Icon("sparkle")} ${escapeHtml(T(pr.name_en, pr.name_te || pr.name_en))}</strong>
          <span class="pariharam-item__badge">${escapeHtml(pr.status || "")}</span></div>
          ${pr.shloka ? `<div class="pariharam-item__shloka">"${escapeHtml(pr.shloka)}"</div>` : ""}
          <div class="pariharam-item__desc">${escapeHtml(T(pr.desc_en, pr.desc_te || pr.desc_en))}</div></div>`).join("")}</div></div>`;
  }
  return h || `<p class="portal-hint">${T("No dosha checks were run for this muhurta.", "ఈ ముహూర్తానికి దోష పరిశీలనలు జరగలేదు.")}</p>`;
}

function paRulesPanel(r) {
  const d = r.detailed_eval || {};
  const vaaraTe = VAARA_NAMES[currentLang]?.[r.panchang?.vaara] || r.panchang?.vaara || "";
  const rawNak = typeof r.panchang?.nakshatra === "object" ? r.panchang.nakshatra.name : (r.panchang?.nakshatra || "");
  const nakTe = te(rawNak, NAKSHATRA_NAMES_TE) || rawNak;
  let h = "";
  const misses = (d.extra_checks || []).filter(x => String(x.id || "").startsWith("rule_miss_"));
  if (misses.length) {
    h += `<div class="dosha-panel dosha-panel--dasha pa-wide"><div class="dosha-panel__header dosha-panel__header--dasha">
      <span>${Icon("alert")} ${T("This event's rules not met", "ఈ కార్య నియమాలు సరిపోలనివి")}</span>
      <span class="dosha-panel__score dosha-panel__score--dasha">${misses.length}</span></div>
      <div class="dosha-panel__body dosha-panel__body--dasha">${misses.map(m => doshaItemHTML(m, T("Not met", "సరిపోలలేదు"), m.desc_en || "", "dasha")).join("")}</div></div>`;
  }
  const passed = (r.reasons || []).filter(Boolean);
  if (passed.length) {
    h += `<div class="detail-card pa-wide"><h4 class="detail-card__title">${Icon("sparkle")} ${T("Rules this muhurta meets", "ఈ ముహూర్తం పాటించే నియమాలు")} <span class="pa-tab__count pa-tab__count--good">${passed.length}</span></h4>
      <ul class="pa-checklist">${passed.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>`;
  }
  if (d.vaara) {
    const card = (t, ok, txt) => buildRuleCard(t, ok, escapeHtml(txt));
    let g = card(T("Weekday", "వార శుద్ధి"), d.vaara?.is_pass, vaaraTe);
    g += card(T("Tithi", "తిథి శుద్ధి"), d.tithi?.is_pass, limbName(r.panchang?.tithi));
    g += card(T("Nakshatra", "నక్షత్ర శుద్ధి"), d.nakshatra?.is_pass, nakTe);
    g += card(T("Yoga", "యోగం"), d.yoga?.is_pass, limbName(r.panchang?.yoga));
    g += card(T("Karana", "కరణం"), d.karana?.is_pass, limbName(r.panchang?.karana));
    const as = d.ashtama_shuddhi;
    if (as) g += card(T("8th house (ashtama shuddhi)", "అష్టమ శుద్ధి"), as.has_shuddhi,
      as.has_shuddhi ? T("Empty", "ఖాళీ") : (as.planets_in_8th || []).join(", "));
    const ls = d.lagna_shuddhi;
    if (ls) g += card(T("Planets in the lagna", "లగ్నంలో గ్రహాలు"), true,
      (ls.planets_in_lagna || []).length ? ls.planets_in_lagna.join(", ") : T("None", "లేవు"));
    if (d.tara) g += card(T("Tarabala", "తారాబలం"), d.tara.is_pass, T(d.tara.name, d.tara.name_te || te(d.tara.name || "", TARA_NAMES_TE) || d.tara.name));
    if (d.chandrabalam) g += card(T("Chandrabala", "చంద్రబలం"), d.chandrabalam.is_pass, T(d.chandrabalam.desc_en, d.chandrabalam.desc_te || d.chandrabalam.desc_en) || "");
    if (d.panchaka) g += card(T("Panchaka", "పంచక శుద్ధి"), d.panchaka.is_pass, T(d.panchaka.name_en, d.panchaka.name_te || d.panchaka.name_en));
    h += `<div class="rule-grid pa-wide">${g}</div>`;
  }
  const cautions = (r.cautions || []).filter(Boolean);
  if (cautions.length) {
    h += `<div class="detail-card pa-wide"><h4 class="detail-card__title">${Icon("alert")} ${T("Cautions", "జాగ్రత్తలు")}</h4>
      <ul class="pa-checklist pa-checklist--warn">${cautions.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>`;
  }
  const det = r.detail;
  if (det?.people?.length) h += `<div class="pa-wide">${peopleStrengthHTML(det.people, paRuleFor(r))}</div>`;
  return h;
}

function paPanchangPanel(r) {
  const d = r.detailed_eval || {};
  const vaaraTe = VAARA_NAMES[currentLang]?.[r.panchang?.vaara] || r.panchang?.vaara || "";
  const rawNak = typeof r.panchang?.nakshatra === "object" ? r.panchang.nakshatra.name : (r.panchang?.nakshatra || "");
  const nakTe = te(rawNak, NAKSHATRA_NAMES_TE) || rawNak;
  const cm = r.panchang?.chandramana;
  const cmBanner = cm ? `<div class="cm-banner">
      <span class="cm-banner__sam">${Icon("lamp")} ${escapeHtml(T(`${cm.samvatsara_name} Samvatsara`, `${cm.samvatsara_telugu || cm.samvatsara_name} నామ సంవత్సరం`))}</span><span>·</span>
      <span class="cm-banner__ayanam">${escapeHtml(T(cm.ayanam_en, cm.ayanam_te || cm.ayanam_en))}</span><span>·</span>
      <span class="cm-banner__ruthu">${escapeHtml(T(cm.ruthu_en, cm.ruthu_te || cm.ruthu_en))}</span><span>·</span>
      <span class="cm-banner__maasa">${escapeHtml(displayMasa(cm))}</span><span>·</span>
      <span class="cm-banner__paksha">${escapeHtml(T(`${cm.paksha_en} Paksham`, cm.paksha_te || cm.paksha_en))}</span></div>` : "";
  const lt = r.detail?.limb_times || {};
  const ak = r.panchang?.abhijit_kala_muhurtham;
  let h = `<div class="detail-card pa-wide">
    <h4 class="detail-card__title">${Icon("pin")} ${T("Panchang at this muhurta", "ఈ ముహూర్త పంచాంగం")}</h4>${cmBanner}
    <div class="detail-card__grid">
      <div><strong>${T("Weekday:", "వారం:")}</strong> ${escapeHtml(vaaraTe)}</div>
      <div><strong>${T("Tithi:", "తిథి:")}</strong> ${limbWithTimes(lt.tithi, limbName(r.panchang?.tithi))}</div>
      <div><strong>${T("Nakshatra:", "నక్షత్రం:")}</strong> ${limbWithTimes(lt.nakshatra && { ...lt.nakshatra, name: nakTe }, nakTe)}</div>
      <div><strong>${T("Yoga:", "యోగం:")}</strong> ${limbWithTimes(lt.yoga, limbName(r.panchang?.yoga))}</div>
      <div><strong>${T("Karana:", "కరణం:")}</strong> ${limbWithTimes(lt.karana, limbName(r.panchang?.karana))}</div>
      <div><strong>${T("Sunrise:", "సూర్యోదయం:")}</strong> ${escapeHtml(r.panchang?.sunrise || "—")}</div>
      <div><strong>${T("Sunset:", "సూర్యాస్తమయం:")}</strong> ${escapeHtml(r.panchang?.sunset || "—")}</div>
      <div><strong>${T("Abhijit:", "అభిజిత్:")}</strong> ${r.panchang?.abhijit_muhurta ? escapeHtml(`${r.panchang.abhijit_muhurta.start} – ${r.panchang.abhijit_muhurta.end}`) : "—"}</div>
    </div>
    ${ak ? `<div class="abhijit-strip ${ak.status === "auspicious" ? "abhijit-strip--auspicious" : "abhijit-strip--inauspicious"}">
      <span>${Icon(ak.status === "auspicious" ? "sparkle" : "alert")}</span><span>${escapeHtml(T(ak.msg_en, ak.msg_te || ak.msg_en))}</span></div>` : ""}
  </div>`;
  if (r.detail) h += lagnaStrengthHTML(r.detail);
  const pan = r.panchang?.panchaka_rahitam || d.panchaka;
  if (pan) {
    const ok = pan.is_pass;
    h += `<div class="panchaka-box ${ok ? "panchaka-box--pass" : "panchaka-box--fail"}">
      <div class="panchaka-box__header"><h4 class="panchaka-box__title ${ok ? "panchaka-box__title--pass" : "panchaka-box__title--fail"}">${Icon("wheel")} ${T("Panchaka rahitam", "పంచక రహితం")}</h4>
        <span class="panchaka-box__badge ${ok ? "panchaka-box__badge--pass" : "panchaka-box__badge--fail"}">${ok ? T("Clean", "శుద్ధం") : T("Dosha", "దోషం")}</span></div>
      <div class="panchaka-box__body">
        <div><strong>${T("Formula:", "సూత్రం:")}</strong> <code>${escapeHtml(pan.formula || `(tithi + vara + nakshatra + lagna) % 9 = ${pan.remainder}`)}</code></div>
        <div class="panchaka-box__classification"><strong>${T("Result:", "ఫలితం:")}</strong> ${escapeHtml(T(pan.name_en, pan.name_te || pan.name_en))} — <em>${escapeHtml(T(pan.effect_en, pan.effect_te || pan.effect_en) || "")}</em></div>
        ${!ok && (pan.pariharam_en || pan.pariharam_te) ? `<div class="panchaka-box__remedy"><strong>${Icon("leaf")} ${T("Remedy:", "పరిహారం:")}</strong> ${escapeHtml(T(pan.pariharam_en, pan.pariharam_te || pan.pariharam_en))}</div>` : ""}
      </div></div>`;
  }
  return h;
}

function paChartPanel(r) {
  const t = hm(r.window_start);
  return `<div class="chart-card pa-wide"><h4 class="chart-card__title">${Icon("chart")} ${T(`Muhurta D1 chart (${dmy(r.date)}, ${t})`, `ముహూర్త D1 చక్రం (${dmy(r.date)}, ${t})`)}</h4>
    ${buildD1ChartHTML(r.d1_chart, T(`MUHURTA D1<br>(${t})`, `ముహూర్త D1<br>(${t})`))}</div>`;
}

function paDayPanel(r) {
  let h = "";
  const pi = r.pushkara_info;
  if (pi) {
    const sub = [];
    if (pi.pushkara_bhaga?.is_available) sub.push(T(`Pushkara bhaga ${pi.pushkara_bhaga.precise_time} (${pi.pushkara_bhaga.time_window})`, `పుష్కర భాగం ${pi.pushkara_bhaga.precise_time} (${pi.pushkara_bhaga.time_window})`));
    if (pi.pushkara_navamsha?.is_available) sub.push(T(`Pushkara navamsha ${pi.pushkara_navamsha.precise_time} (${pi.pushkara_navamsha.time_window})`, `పుష్కర నవాంశ ${pi.pushkara_navamsha.precise_time} (${pi.pushkara_navamsha.time_window})`));
    const avoid = T(pi.avoid_note_en, pi.avoid_note_te || pi.avoid_note_en);
    h += `<div class="rec-time-box"><h4 class="rec-time-box__title">${Icon("sun")} ${T("Best pushkara time of this day (any lagna)", "ఈ రోజు ఉత్తమ పుష్కర సమయం (ఏ లగ్నమైనా)")}</h4>
      <div class="rec-time-box__time">${Icon("clock")} ${escapeHtml(T(pi.statement_en, pi.statement_te || pi.statement_en) || "")}</div>
      ${sub.length ? `<div class="rec-time-box__details">${sub.map(s => `${Icon("pin")} ${escapeHtml(s)}`).join("<br>")}</div>` : ""}
      ${avoid ? `<div class="rec-time-box__note">${Icon("alert")} ${escapeHtml(avoid)}</div>` : ""}
      <p class="pa-note">${T("This is for the whole day; it is not a check of the muhurta above.", "ఇది రోజంతటికి; పై ముహూర్త పరిశీలన కాదు.")}</p></div>`;
  }
  const ip = r.panchang?.inauspicious_periods || r.panchang || {};
  const fmtP = p => !p ? "—" : typeof p === "string" ? (p.trim() || "—")
    : Array.isArray(p) ? (p.map(i => typeof i === "object" && i.start ? `${i.start} – ${i.end}` : String(i)).filter(Boolean).join(" & ") || "—")
    : (typeof p === "object" && p.start) ? `${p.start} – ${p.end}` : String(p);
  const det = r.detail;
  h += `<div class="inauspicious-card"><h4 class="inauspicious-card__title">${Icon("hourglass")} ${T("Inauspicious times of the day", "ఈ రోజు అశుభ సమయాలు")}</h4>
    <div class="inauspicious-card__grid">
      <div><strong>${T("Durmuhurta:", "దుర్ముహూర్తం:")}</strong> ${escapeHtml(fmtP(ip.durmuhurtam))}</div>
      <div><strong>${T("Varjyam:", "వర్జ్యం:")}</strong> ${escapeHtml(fmtP(ip.varjyam))}</div>
      <div><strong>${T("Rahu kalam:", "రాహు కాలం:")}</strong> ${escapeHtml(fmtP(ip.rahu_kalam))}</div>
      <div><strong>${T("Yamagandam:", "యమగండం:")}</strong> ${escapeHtml(fmtP(ip.yamagandam))}</div>
      <div><strong>${T("Gulika:", "గుళిక:")}</strong> ${escapeHtml(fmtP(ip.gulika_kalam))}</div>
    </div>
    ${det?.cut_by?.length ? `<div class="inauspicious-card__cut"><strong>${T("Cut from this lagna:", "ఈ లగ్నం నుండి తొలగించినవి:")}</strong> ${det.cut_by.map(c => `${escapeHtml(c.label)} ${escapeHtml(c.start)}–${escapeHtml(c.end)}`).join(" · ")}</div>` : ""}
    <p class="pa-note">${T("Only durmuhurta and varjyam cut muhurtas (book para 1681); Rahu kalam, Yamagandam and Gulika are shown for information.",
                           "దుర్ముహూర్తం, వర్జ్యం మాత్రమే ముహూర్తాన్ని తొలగిస్తాయి (గ్రంథం 1681); రాహు కాలం, యమగండం, గుళిక సమాచారం కోసం.")}</p></div>`;
  const lsched = r.panchang?.lagna_schedule || [];
  if (lsched.length) {
    const cur = r.detailed_eval?.lagna_shuddhi?.muhurta_lagna || "";
    h += `<div class="lagna-section pa-wide"><h4 class="lagna-section__title"><span>${Icon("landmark")} ${T("Lagnas of the day", "ఈ రోజు లగ్నాలు")}</span>
      <span class="lagna-section__subtitle">${T("This muhurta's lagna is marked", "ఈ ముహూర్త లగ్నం గుర్తించబడింది")}</span></h4><div class="lagna-grid">${lsched.map(l => {
        const on = cur && (l.lagna_name === cur || l.lagna_name_te === cur);
        return `<div class="lagna-item${on ? " lagna-item--current" : ""}"><div class="lagna-item__header"><strong class="lagna-item__name">${escapeHtml(T(l.lagna_name, l.lagna_name_te || l.lagna_name))}</strong>
          ${on ? `<span class="lagna-item__muhurta-tag">${T("Muhurta", "ముహూర్తం")}</span>` : ""}</div><div class="lagna-item__time">${escapeHtml(l.start_time)} – ${escapeHtml(l.end_time)}</div></div>`;
      }).join("")}</div></div>`;
  }
  const kv = r.panchang?.kala_vibhajana;
  if (kv) {
    const part = (k, icon, extra) => kv[k] ? `<div class="kv-card${extra || ""}"><div class="kv-card__name">${Icon(icon)} ${escapeHtml(T(kv[k].name_en, kv[k].name_te || kv[k].name_en))}</div>
      <div class="kv-card__time">${escapeHtml(kv[k].start)} – ${escapeHtml(kv[k].end)}</div><div class="kv-card__desc">${escapeHtml(T(kv[k].desc_en, kv[k].desc_te || kv[k].desc_en) || "")}</div></div>` : "";
    h += `<div class="kv-section pa-wide"><h4 class="kv-header"><span>${Icon("hourglass")} ${T("Five parts of the day", "పంచధా కాల విభజన")}</span></h4><div class="kv-grid">
      ${part("pratah_kalam", "sunrise")}${part("sangava_kalam", "sun")}${part("madhyahnika_kalam", "sun", " kv-card--highlight")}${part("aparahna_kalam", "cloud-sun")}${part("sayahna_kalam", "sunset")}
      <div class="kv-card kv-card--sacred"><div class="kv-card__name kv-card__name--sacred">${Icon("moon")} ${T("Night", "రాత్రి")}</div><div class="kv-card__sacred-times">
        <strong>${T("Pradosha:", "ప్రదోషం:")}</strong> ${escapeHtml(kv.pradosha_kalam?.start || "")} – ${escapeHtml(kv.pradosha_kalam?.end || "")}<br>
        <strong>${T("Nishitha:", "నిశీథం:")}</strong> ${escapeHtml(kv.nisitha_kalam?.start || "")} – ${escapeHtml(kv.nisitha_kalam?.end || "")}<br>
        <strong>${T("Brahma muhurta:", "బ్రాహ్మీ ముహూర్తం:")}</strong> ${escapeHtml(kv.brahma_muhurtham?.start || "")} – ${escapeHtml(kv.brahma_muhurtham?.end || "")}</div></div>
    </div></div>`;
  }
  if (r.special_yogas?.length) {
    h += `<div class="special-yogas-container pa-wide">${r.special_yogas.map(y =>
      `<div class="yoga-item yoga-item--compact ${y.type === "bad" ? "yoga-item--bad" : "yoga-item--good"}">${Icon("sparkle")} ${escapeHtml(T(y.name_en, y.name_te || y.name_en))} — <span class="yoga-item__desc">${escapeHtml(T(y.desc_en, y.desc_te || y.desc_en) || "")}</span></div>`).join("")}</div>`;
  }
  return h;
}

function openDayModal(idx) {
  if (!lastData || !lastData.results[idx]) return;
  openDayIdx = idx;
  const r = lastData.results[idx];
  paRemember(r);
  paNavState();
  el("mfModalTitle").textContent = `${paEventTitle(r)} · ${dmy(r.date)}`;
  el("mfModalBody").innerHTML =
    paHeroHTML(r) + paWhyHTML(r) + paTabsHTML(r) +
    paPanel("doshas", paDoshasPanel(r)) + paPanel("rules", paRulesPanel(r)) + paPanel("panchang", paPanchangPanel(r)) +
    paPanel("chart", paChartPanel(r)) + paPanel("day", paDayPanel(r));
  el("mfModal").style.display = "flex";
}

function buildRuleCard(title, pass, desc) {
  return `
    <div class="rule-card ${pass ? 'pass' : 'fail'}">
      <div class="rule-title"><span>${title}</span><span>${pass ? '✓' : '✕'}</span></div>
      <div class="rule-desc">${desc}</div>
    </div>`;
}

function closeModal() {
  el("mfModal").style.display = "none";
  document.body.classList.remove("pa-open");
  if (location.hash === "#parishilana") history.replaceState(null, "", location.pathname + location.search);
}

// ---- Muhurta Parishilana (19 Nov 2026): previous / next among the results, and reopening the last one ----
const PA_KEY = "gj_parishilana_v1";
function paRemember(r) {
  document.body.classList.add("pa-open");
  try { sessionStorage.setItem(PA_KEY, JSON.stringify({ r, birth_details: lastData && lastData.birth_details })); }
  catch (e) { console.warn("Could not keep this muhurta for the Parishilana menu item:", e && e.name); }
}
function paNavState() {
  const n = (lastData && lastData.results) ? lastData.results.length : 0;
  if (el("paPrev")) el("paPrev").disabled = openDayIdx <= 0;
  if (el("paNext")) el("paNext").disabled = openDayIdx >= n - 1;
  if (el("paCount")) el("paCount").textContent = n > 1 ? T(`${openDayIdx + 1} of ${n}`, `${n} లో ${openDayIdx + 1}`) : "";
}
function stepParishilana(delta) {
  const i = openDayIdx + delta;
  if (lastData && lastData.results && i >= 0 && i < lastData.results.length) {
    openDayModal(i);
    const box = document.querySelector("#mfModal .modal-content");
    if (box) box.scrollTop = 0;
  }
}
// muhurta-finder.html#parishilana: show the last muhurta looked at in this browser tab, or say how to pick one.
function paRestore() {
  if (location.hash !== "#parishilana") return;
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(PA_KEY) || "null"); } catch (e) { saved = null; }
  if (saved && saved.r) {
    lastData = Object.assign({}, lastData || {}, { results: [saved.r], birth_details: saved.birth_details || null });
    openDayModal(0);
  } else {
    AppShell.toast(T("Search for muhurtas first, then open one to see it in full here.", "ముందుగా ముహూర్తాలు వెతకండి, ఆపై ఒకదాన్ని తెరిస్తే ఇక్కడ పూర్తిగా చూపిస్తాం."), "info");
  }
}
