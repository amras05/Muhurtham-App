// ============================================================
// Muhurtham App · Muhurta Finder component: Location: OpenStreetMap town search and the user's current town.
// Split from finder.js (21 Nov 2026). Plain script: the page loads the finder-*.js files in order
// (see muhurta-finder.html); they share one global scope, and finder-init.js runs last.
// requires: js/config.js, js/i18n.js, js/regions.js, js/stars.js
// ============================================================

// ---- Location: OpenStreetMap search, filled with the user's current town (9 Nov 2026) ----
// The browser asks once for location; the server turns it into the town (rounded to ~1 km) and its
// time zone. A place the user picks by hand is remembered on this device. If location is refused,
// the home place from My account is used, else Hyderabad.
var chosenPlace = null;
const PLACE_KEY = "mh_finder_place";
function setPlace(p, remember) {
  chosenPlace = { label: p.label, lat: Number(p.lat), lon: Number(p.lon), tz_offset: Number(p.tz_offset) };
  el("mfPlaceInput").value = p.label;
  el("mfPlaceNote").textContent = T(`Times for ${p.label} (UTC${p.tz_offset >= 0 ? "+" : ""}${p.tz_offset})`, `${p.label} సమయాలు (UTC${p.tz_offset >= 0 ? "+" : ""}${p.tz_offset})`);
  if (remember) { try { localStorage.setItem(PLACE_KEY, JSON.stringify(chosenPlace)); } catch (e) { /* private mode */ } }
}
async function fallbackPlace(why) {
  try {
    const me = await (await fetch(`${API_BASE}/me`)).json();
    if (me && me.home && me.home.lat != null) { setPlace({ label: me.home.name, lat: me.home.lat, lon: me.home.lon, tz_offset: me.home.tz }, false); }
  } catch (e) { /* use Hyderabad below */ }
  if (!chosenPlace) setPlace({ label: "Hyderabad, Telangana", lat: 17.385, lon: 78.4867, tz_offset: 5.5 }, false);
  if (why) el("mfPlaceNote").textContent += " · " + why;
}
function useMyLocation() {
  if (!navigator.geolocation) return fallbackPlace(T("Location isn't available in this browser; search for the place.", "ఈ బ్రౌజర్‌లో స్థానం అందుబాటులో లేదు; ప్రాంతం వెతకండి."));
  el("mfPlaceNote").textContent = T("Finding your town…", "మీ ఊరు కనుగొంటున్నాం…");
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const res = await fetch(`${API_BASE}/geocode/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error((d && d.detail) || `HTTP ${res.status}`);
      setPlace(d, false);
    } catch (e) { fallbackPlace(e.message); }
  }, () => fallbackPlace(T("Location not shared; search for the place.", "స్థానం పంచుకోలేదు; ప్రాంతం వెతకండి.")),
  { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}
(function initPlaceSearch() {
  const input = el("mfPlaceInput"), list = el("mfPlaceList");
  if (!input) return;
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) { list.hidden = true; list.innerHTML = ""; return; }
    timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/geocode/suggestions?q=${encodeURIComponent(q)}`);
        const items = res.ok ? await res.json() : [];
        list.innerHTML = items.length ? "" : `<div class="suggestion-item suggestion-item--empty">${escapeHtml(T("No town found. Try just the town name.", "ఊరు దొరకలేదు. ఊరి పేరు మాత్రమే ఇచ్చి చూడండి."))}</div>`;
        items.forEach(it => {
          const div = document.createElement("div");
          div.className = "suggestion-item"; div.setAttribute("role", "option"); div.textContent = it.label;
          div.addEventListener("click", () => { setPlace(it, true); list.hidden = true; });
          list.appendChild(div);
        });
        list.hidden = false;
      } catch (e) { console.warn("Place search failed:", e.message); }
    }, 400);                       // OpenStreetMap asks for no more than about one search a second
  });
  document.addEventListener("click", e => { if (e.target !== input && !list.contains(e.target)) list.hidden = true; });
  el("mfUseMyLocation").addEventListener("click", () => { try { localStorage.removeItem(PLACE_KEY); } catch (e) {} useMyLocation(); });
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(PLACE_KEY) || "null"); } catch (e) { saved = null; }
  if (saved && saved.lat != null) setPlace(saved, false); else useMyLocation();
})();
