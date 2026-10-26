// ============================================================
// Muhurtham App · component: app bootstrap & wiring
// (binds all panels via the shared helpers, initial load)
// ============================================================

el("dateInput").valueAsDate = new Date();
el("birthDateInput").valueAsDate = new Date();

// Buttons
el("goButton").addEventListener("click", getPanchang);
el("searchPlaceButton").addEventListener("click", getPanchang);
el("findMuhurtaButton").addEventListener("click", findNamakaranaMuhurtas);
el("birthSearchPlaceButton").addEventListener("click", findNamakaranaMuhurtas);

// Region dropdown toggles (shared helper)
attachRegionToggle("regionSelect", "customPlaceField", "customPlaceInput");
attachRegionToggle("birthRegionSelect", "birthCustomPlaceField", "birthCustomPlaceInput");

// Place autocomplete (shared helper — no duplicated logic)
attachPlaceAutocomplete("customPlaceInput", "suggestionsList", getPanchang);
attachPlaceAutocomplete("birthCustomPlaceInput", "birthSuggestionsList", findNamakaranaMuhurtas);

// Hash routing (#vivaha, #namakarana, … opens that panel)
window.addEventListener("hashchange", () => {
  const hash = window.location.hash ? window.location.hash.replace("#", "").toLowerCase() : "";
  if (hash === "panchang") switchTab("panchang");
  else if (hash && SAMSKARAS_CONFIG[hash]) switchTab(hash);
});

// Startup: load regions, render panchang, open initial panel
loadRegions().then(() => {
  getPanchang();
  const hash = window.location.hash ? window.location.hash.replace("#", "").toLowerCase() : "";
  if (hash && SAMSKARAS_CONFIG[hash]) {
    switchTab(hash);
  } else {
    setupSamskaraView('namakarana');
  }
  findSamskaraMuhurtas();
});

