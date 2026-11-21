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
    vSel.innerHTML = `<option value="">${t("Main list")}</option>` +
      alts.map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(currentLang === "te" ? (a.title_te || a.title_en) : a.title_en)}</option>`).join("");
  }

  const desc = el("mfEventDesc");
  if (desc) {
    let text = rule ? (currentLang === "te" ? (rule.description_te || "") : (rule.description_en || "")) : "";
    const base = rule?.extends && allMuhurtaRules.find(r => r.id === rule.extends);
    if (base) text += " · " + t("Uses the rules of \"{event}\" until the book's own rules are added.", { event: pickLang(base.title_en, base.title_te || base.title_en) });
    desc.textContent = text;
  }

  renderParticipants(rule);

  // Disclaimers: reference-only events, and the doctor's rule 10 for health and pregnancy.
  const banner = el("mfInfoBanner");
  if (banner) {
    const tab = rule?.tab || currentCategory;
    const notes = [];
    if (rule?.informational) notes.push(t("Shown for reference from the book only. Follow your doctor's or lawyer's advice for medical or legal decisions."));
    if (tab === "health") notes.push(t("A muhurta never replaces medical advice. Do not delay urgent treatment or surgery for a muhurta."));
    if (tab === "garbha") notes.push(t("This is a traditional muhurta only. It does not replace medical advice on pregnancy or conception."));
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
