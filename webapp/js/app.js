// ============================================================
// Muhurtham App · component: app bootstrap & wiring
// (binds all panels via the shared helpers, initial load)
// ============================================================

// Render the full layout once on load (component architecture),
// then wire all panels via the shared helpers — ids unchanged.
UI.mount(Views.layoutRootId, Views.layout());
el("apiBaseLabel").textContent = API_BASE || "same-origin";

el("dateInput").valueAsDate = new Date();

// Buttons (refreshPanchang loads the Day or Month tab, whichever is open)
el("goButton").addEventListener("click", refreshPanchang);
el("searchPlaceButton").addEventListener("click", refreshPanchang);
initMonthTab();

// Region dropdown toggles (shared helper)
attachRegionToggle("regionSelect", "customPlaceField", "customPlaceInput");

// Place autocomplete (shared helper — no duplicated logic)
attachPlaceAutocomplete("customPlaceInput", "suggestionsList", refreshPanchang);

// Old links to the retired samskara mode (#namakarana, #vivaha, …) go to the Muhurta Finder (plan R4).
(function () {
  const hash = window.location.hash ? window.location.hash.replace("#", "").toLowerCase() : "";
  if (hash && hash !== "panchang" && hash !== "tabpanchangcontent") window.location.replace("muhurta-finder.html");
})();

// Startup: load regions, render panchang, open initial panel
loadRegions().then(() => {
  getPanchang();
});

