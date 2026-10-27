// ============================================================
// Muhurtham App · component: regions + shared place
// autocomplete (used by panchang & samskara panels)
// ============================================================

let allRegions = [];

async function loadRegions() {
  try {
    const res = await fetch(`${API_BASE}/regions`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const regions = await res.json();
    allRegions = regions;

    // Populate every region <select> that exists on this page
    // (panchang: regionSelect + birthRegionSelect · finder: mfRegionSelect)
    const selectIds = ["regionSelect", "birthRegionSelect", "mfRegionSelect"];
    selectIds.forEach((selId) => {
      const sel = el(selId);
      if (!sel) return;
      sel.innerHTML = "";
      regions.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.label;
        sel.appendChild(opt);
      });

      const optCustom = document.createElement("option");
      optCustom.value = "custom";
      optCustom.setAttribute("data-en", "Search Custom Location...");
      optCustom.setAttribute("data-te", "ఇతర ప్రాంతం వెతకండి...");
      optCustom.textContent = currentLang === "te" ? "ఇతర ప్రాంతం వెతకండి..." : "Search Custom Location...";
      sel.appendChild(optCustom);
    });
  } catch (e) {
    setStatus(`Couldn't reach the backend at ${API_BASE} — is it running? (${e.message})`, true);
  }
}

// Shared autocomplete: one implementation for every place-input.
// onPick(result) — usually just runs the search on that panel.
function attachPlaceAutocomplete(inputId, listId, onPick) {
  const input = el(inputId);
  const list = el(listId);
  let timer;
  input.addEventListener("input", (e) => {
    clearTimeout(timer);
    const query = e.target.value.trim();
    if (query.length < 3) { list.style.display = "none"; list.innerHTML = ""; return; }
    timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/geocode/suggestions?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const suggestions = await res.json();
        list.innerHTML = "";
        if (suggestions && suggestions.length > 0) {
          suggestions.forEach((item) => {
            const div = document.createElement("div");
            div.className = "suggestion-item";
            div.textContent = item.label;
            div.addEventListener("click", () => {
              input.value = item.label;
              list.style.display = "none";
              onPick();
            });
            list.appendChild(div);
          });
          list.style.display = "block";
        } else {
          list.style.display = "none";
        }
      } catch (err) {
        console.error("Suggestions error:", err);
      }
    }, 350);
  });
  // Close on click outside / Enter
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") { list.style.display = "none"; onPick(); }
  });
  document.addEventListener("click", (e) => {
    if (e.target !== list && e.target !== input) list.style.display = "none";
  });
}

// Shared dropdown toggle: show the custom-place search field on "custom".
function attachRegionToggle(selectId, fieldId, inputId) {
  el(selectId).addEventListener("change", (e) => {
    if (e.target.value === "custom") {
      el(fieldId).style.display = "block";
      el(inputId).focus();
    } else {
      el(fieldId).style.display = "none";
    }
  });
}
