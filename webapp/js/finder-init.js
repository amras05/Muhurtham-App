// ============================================================
// Muhurtham App · Muhurta Finder component: Page start-up: listeners, first load and links from other pages. Loads last.
// Split from finder.js (21 Nov 2026). Plain script: the page loads the finder-*.js files in order
// (see muhurta-finder.html); they share one global scope, and finder-init.js runs last.
// requires: js/config.js, js/i18n.js, js/regions.js, js/stars.js
// ============================================================

// ---- Init ----
el("startDate").valueAsDate = new Date();

el("findBtn").addEventListener("click", findMuhurtas);
window.addEventListener("hashchange", paRestore);
setTimeout(paRestore, 0);
el("mfSearchPlaceBtn").addEventListener("click", findMuhurtas);

// Region dropdown toggle + place autocomplete (shared components)
// The old region dropdown and custom-place field were replaced by the OpenStreetMap search below.

populateActivityDropdown();
el("mfPitruMode")?.addEventListener("change", updatePitruFields);
// Changing the minimum score redraws the cards already found; no new search is needed.
el("mfMinScore")?.addEventListener("change", () => { if (lastData && !lastToolSearch) renderResults(lastData); });

// Birth-place lists on the cards need the regions; redraw the cards once both have loaded.
Promise.all([loadRegions(), loadMuhurtaCatalog(), loadFamily()]).then(() => { updateContextualFields(); applyUrlPrefill(); });

// Links from the home page: ?activity=<id>&start=YYYY-MM-DD, or #yogas / #pitru for those tools.
function applyUrlPrefill() {
  const q = new URLSearchParams(window.location.search);
  const start = q.get("start");
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) el("startDate").value = start;
  const act = q.get("activity");
  const rule = act && allMuhurtaRules.find(r => r.id === act);
  if (rule) {
    onCategoryChange(rule.tab || rule.category);
    el("mfActivitySelect").value = rule.id;
    updateContextualFields();
  } else if (q.get("saved")) {
    openSavedSearch(q.get("saved"));
  } else if (window.location.hash === "#yogas") {
    onCategoryChange("yogas");
  } else if (window.location.hash === "#pitru") {
    onCategoryChange("pitru");
    if (!el("mfPitruTabCal")?.hidden) setPitruMode(true);
  }
}
