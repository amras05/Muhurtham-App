// ============================================================
// Muhurtham App · Muhurta Finder component: Event-specific extra fields shown under the form.
// Split from finder.js (21 Nov 2026). Plain script: the page loads the finder-*.js files in order
// (see muhurta-finder.html); they share one global scope, and finder-init.js runs last.
// requires: js/config.js, js/i18n.js, js/regions.js, js/stars.js
// ============================================================

// ---- Context-Sensitive Level 3 Fields ----
function updateContextualFields() {
  Object.values(TAB_INPUT_GROUPS).forEach(gId => {
    const g = el(gId);
    if (g) g.style.display = "none";
  });
  const rule = currentRule();
  (rule?.tab_inputs || []).forEach(key => {
    const g = el(TAB_INPUT_GROUPS[key]);
    if (g) g.style.display = "block";
  });

  const vField = el("mfVariantField");
  const vSel = el("mfVariantSelect");
  if (vField && vSel) {
    const alts = rule?.alternatives || [];
    vField.hidden = alts.length === 0;
    vSel.innerHTML = `<option value="">${currentLang === "te" ? "ప్రధాన జాబితా" : "Main list"}</option>` +
      alts.map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(currentLang === "te" ? (a.title_te || a.title_en) : a.title_en)}</option>`).join("");
  }

  const desc = el("mfEventDesc");
  if (desc) {
    let text = rule ? (currentLang === "te" ? (rule.description_te || "") : (rule.description_en || "")) : "";
    const base = rule?.extends && allMuhurtaRules.find(r => r.id === rule.extends);
    if (base) text += T(` · Uses the rules of "${base.title_en}" until the book's own rules are added.`,
                        ` · గ్రంథంలోని ప్రత్యేక నియమాలు చేర్చేవరకు "${base.title_te || base.title_en}" నియమాలు వర్తిస్తాయి.`);
    desc.textContent = text;
  }

  renderParticipants(rule);

  // Disclaimers: reference-only events, and the doctor's rule 10 for health and pregnancy.
  const banner = el("mfInfoBanner");
  if (banner) {
    const tab = rule?.tab || currentCategory;
    const notes = [];
    if (rule?.informational) notes.push(T(
      "Shown for reference from the book only. Follow your doctor's or lawyer's advice for medical or legal decisions.",
      "ఇది గ్రంథంలోని సమాచారం మాత్రమే. వైద్య/చట్ట నిర్ణయాలకు నిపుణుల సలహా పాటించండి."));
    if (tab === "health") notes.push(T(
      "A muhurta never replaces medical advice. Do not delay urgent treatment or surgery for a muhurta.",
      "ముహూర్తం వైద్యుని సలహాకు ప్రత్యామ్నాయం కాదు. అత్యవసర చికిత్స లేదా శస్త్రచికిత్సను ముహూర్తం కోసం వాయిదా వేయకూడదు."));
    if (tab === "garbha") notes.push(T(
      "This is a traditional muhurta only. It does not replace medical advice on pregnancy or conception.",
      "ఇది సంప్రదాయ ముహూర్త సూచన మాత్రమే; గర్భధారణకు సంబంధించిన వైద్య సలహాకు ప్రత్యామ్నాయం కాదు."));
    banner.hidden = notes.length === 0;
    banner.textContent = notes.join(" ");
  }
}

function onCategoryChange(catId) {
  currentCategory = catId;
  populateActivityDropdown();
  setYogaMode(catId === "yogas");
  const pp = el("mfPitruPanel");
  if (pp) pp.hidden = catId !== "pitru";
  setPitruMode(catId === "pitru" && pitruCalendarOn);
  const rp = el("mfRajaPanel");
  if (rp) rp.hidden = catId !== "garbha";
  setRajaMode(catId === "garbha" && rajaOn);
}
