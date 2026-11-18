// ============================================================
// Gayatri Jyotirnidhi · component: app bootstrap & wiring
// Two pages share this (13 Nov 2026), chosen by <body data-page>:
//   today (panchang-lookup.html): Today's Panchang, no fields, the account's home place;
//   month (panchang-month.html): Monthly Panchang, with the place and date fields and the calendar.
// ============================================================
const PAGE_MODE = document.body.getAttribute("data-page") === "month" ? "month" : "today";
UI.mount(Views.layoutRootId, Views.layout(PAGE_MODE));

// Old links to the retired samskara mode (#namakarana, #vivaha, …) go to the Muhurta Finder (plan R4).
(function () {
  const hash = window.location.hash ? window.location.hash.replace("#", "").toLowerCase() : "";
  if (hash && hash !== "panchang" && hash !== "tabpanchangcontent") window.location.replace("muhurta-finder.html");
})();

if (PAGE_MODE === "today") {
  getPanchang();
} else {
  el("apiBaseLabel").textContent = API_BASE || "same-origin";
  el("dateInput").valueAsDate = new Date();
  // Buttons (refreshPanchang loads the month, or the open day)
  el("goButton").addEventListener("click", refreshPanchang);
  el("searchPlaceButton").addEventListener("click", refreshPanchang);
  initMonthTab();
  attachRegionToggle("regionSelect", "customPlaceField", "customPlaceInput");
  attachPlaceAutocomplete("customPlaceInput", "suggestionsList", refreshPanchang);
  loadRegions().then(() => showPanchangTab("month"));
}
