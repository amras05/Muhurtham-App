// ============================================================
// Muhurtham App · Muhurta Finder component: Person cards (birth details known? / janma star / nama star), required details, family on the cards.
// Split from finder.js (21 Nov 2026). Plain script: the page loads the finder-*.js files in order
// (see muhurta-finder.html); they share one global scope, and finder-init.js runs last.
// requires: js/config.js, js/i18n.js, js/regions.js, js/stars.js
// ============================================================

// ---- People taking part (Input Data Master) ----
// One card per participant the event asks for. Janma and nama nakshatra are separate
// fields; a star can be picked, found from the name (user must confirm), or worked out
// from birth details on the server. Values survive switching events (kept per role).
const participantState = {};   // role -> { field: value }
const namaLookupTimers = {};

const T = (en, te) => (currentLang === "te" ? te : en);

function optionList(items, placeholder, selected) {
  return `<option value="">${placeholder}</option>` + items.map(i =>
    `<option value="${i.id}"${String(i.id) === String(selected ?? "") ? " selected" : ""}>${currentLang === "te" ? `${i.te} (${i.en})` : `${i.en} · ${i.te}`}</option>`
  ).join("");
}
const PADAS = [1, 2, 3, 4].map(n => ({ id: n, en: `Pada ${n}`, te: `${n}వ పాదం` }));

function saveParticipantState() {
  document.querySelectorAll("#mfParticipants .person-card").forEach(card => {
    const role = card.dataset.role;
    const st = participantState[role] = participantState[role] || {};
    card.querySelectorAll("[data-k]").forEach(inp => {
      st[inp.dataset.k] = inp.type === "checkbox" ? inp.checked : inp.value;
    });
    st.mode = card.dataset.mode;
  });
}

function birthPlaceOptions(selected) {
  const regions = (typeof allRegions !== "undefined" ? allRegions : []).filter(r => r.id !== "custom");
  return `<option value="">${t("Same as the event location")}</option>` +
    regions.map(r => `<option value="${escapeHtml(r.id)}"${r.id === selected ? " selected" : ""}>${escapeHtml(r.label)}</option>`).join("");
}

function personCardHTML(spec, idx) {
  const role = spec.role;
  const st = participantState[role] || {};
  // 21 Nov 2026: first "are the birth details known?". Yes = date, time and place (worked out on the server);
  // no = janma nakshatra, pada and (optional) rashi. The old "find it from the name" mode now lives only in
  // the nama nakshatra block (Griha Pravesha).
  const mode = st.mode === "star" || st.mode === "name" ? "star" : "birth";
  const isNama = spec.star_basis === "nama";
  const label = T(spec.label_en, spec.label_te);
  const id = k => `mfP_${role}_${k}`;
  const needsDob = (spec.fields || []).includes("birth_date");
  // L1 required · L1o recommended (shown open, may be left empty; e.g. the father at upanayana) · L2 optional, folded
  const levelNote = spec.level === "L1"
    ? t("Required")
    : spec.level === "L1o"
      ? t("Recommended (optional): adds this person's tarabala")
      : t("Optional: adds this person's tarabala");
  const basisNote = spec.star_basis === "nama"
    ? t("Rules use the nama nakshatra")
    : t("Rules use the janma nakshatra");
  const extra = [];
  if ((spec.fields || []).includes("gender")) {
    extra.push(`<div class="field"><label for="${id("gender")}">${t("Boy / girl")}</label>
      <select id="${id("gender")}" data-k="gender">
        <option value="">${t("— Not specified —")}</option>
        <option value="boy"${st.gender === "boy" ? " selected" : ""}>${t("Boy")}</option>
        <option value="girl"${st.gender === "girl" ? " selected" : ""}>${t("Girl")}</option>
      </select></div>`);
  }
  if ((spec.fields || []).includes("eldest")) {
    extra.push(`<div class="field field--check"><label><input type="checkbox" id="${id("eldest")}" data-k="eldest"${st.eldest ? " checked" : ""}>
      ${t("Eldest child (Trijyeshtha check)")}</label></div>`);
  }
  const tab = (m, en) => `<button type="button" role="tab" class="nama-tab${mode === m ? " active" : ""}" aria-selected="${mode === m}" onclick="switchPersonMode('${role}','${m}')">${t(en)}</button>`;
  return `
  <details class="person-card" data-role="${role}" data-mode="${mode}" data-needs-dob="${needsDob}" ${spec.level === "L1" || spec.level === "L1o" || idx === 0 || st.open ? "open" : ""}>
    <summary class="person-card__head">
      <strong>${escapeHtml(label)}</strong>
      <span class="person-card__note">${levelNote} · ${basisNote}</span>
    </summary>
    <div class="person-card__body">
      ${familyPickerHTML(role, st)}
      <div class="context-grid">
        <div class="field"><label for="${id("name")}">${t("Name")}</label>
          <input type="text" id="${id("name")}" data-k="name" value="${escapeHtml(st.name || "")}" autocomplete="off"></div>
        <div class="field"><label for="${id("gotra")}">${t("Gotra (printed only)")}</label>
          <input type="text" id="${id("gotra")}" data-k="gotra" value="${escapeHtml(st.gotra || "")}" autocomplete="off"></div>
        ${extra.join("")}
      </div>
      ${isNama ? `
      <div class="nama-block">
        <div class="context-grid">
          <div class="field"><label for="${id("nama")}">${t("Nama nakshatra (used for Griha Pravesha)")}</label>
            <select id="${id("nama")}" data-k="nama_nak_idx">${optionList(NAKSHATRAS_27, t("— Not known —"), st.nama_nak_idx)}</select></div>
          <div class="field"><label for="${id("npada")}">${t("Nama pada")}</label>
            <select id="${id("npada")}" data-k="nama_pada">${optionList(PADAS, "—", st.nama_pada)}</select></div>
          <div class="field"><label for="${id("lookup")}">${t("Or find it from the name")}</label>
            <input type="text" id="${id("lookup")}" data-k="lookup" value="${escapeHtml(st.lookup || "")}" autocomplete="off"
              oninput="onPersonNameLookup('${role}', this.value)"></div>
        </div>
        <div class="nama-detected-badge" id="${id("badge")}" aria-live="polite" hidden></div>
      </div>` : ""}
      <p class="participants__hint">${t("Are this person's birth details (date, time, place) known?")}</p>
      <div class="nama-mode-tabs" role="tablist" aria-label="${t("Birth details known?")}">
        ${tab("birth", "Yes, birth details known")}
        ${tab("star", "No, I know the janma nakshatra")}
      </div>
      <div class="person-mode" data-for="star" ${mode === "star" ? "" : "hidden"}>
        <div class="context-grid">
          <div class="field"><label for="${id("janma")}">${t("Janma nakshatra")}</label>
            <select id="${id("janma")}" data-k="janma_nak_idx">${optionList(NAKSHATRAS_27, t("— Not known —"), st.janma_nak_idx)}</select></div>
          <div class="field"><label for="${id("jpada")}">${t("Janma pada")}</label>
            <select id="${id("jpada")}" data-k="janma_pada">${optionList(PADAS, "—", st.janma_pada)}</select></div>
          <div class="field"><label for="${id("rasi")}">${t("Janma rashi (optional)")}</label>
            <select id="${id("rasi")}" data-k="rasi_idx">${optionList(RASIS_12, t("— Not known —"), st.rasi_idx)}</select></div>
        </div>
      </div>
      <div class="person-mode" data-for="birth" ${mode === "birth" || needsDob ? "" : "hidden"}>
        <div class="context-grid">
          <div class="field"><label for="${id("dob")}">${t("Birth date")}${needsDob ? t(" (needed for the age rule)") : ""}</label>
            <input type="date" id="${id("dob")}" data-k="birth_date" value="${escapeHtml(st.birth_date || "")}"></div>
          <div class="field birth-only" ${mode === "birth" ? "" : "hidden"}><label for="${id("tob")}">${t("Birth time")}</label>
            <input type="time" id="${id("tob")}" data-k="birth_time" value="${escapeHtml(st.birth_time || "")}"></div>
          <div class="field field--check birth-only" ${mode === "birth" ? "" : "hidden"}><label><input type="checkbox" id="${id("tunk")}" data-k="birth_time_unknown"${st.birth_time_unknown ? " checked" : ""}>
            ${t("Birth time not known")}</label></div>
          <div class="field birth-only" ${mode === "birth" ? "" : "hidden"}><label for="${id("bplace")}">${t("Birth place")}</label>
            <select id="${id("bplace")}" data-k="birth_region">${birthPlaceOptions(st.birth_region)}</select></div>
        </div>
      </div>
    </div>
  </details>`;
}

function renderParticipants(rule) {
  const box = el("mfParticipants");
  if (!box) return;
  saveParticipantState();
  const specs = rule?.participants || [];
  if (!specs.length) { box.innerHTML = ""; box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<h4 class="participants__title">${t("People taking part")}</h4>
    <p class="participants__hint">${t("For each person, give the birth date, time and place if known; if not, give the janma nakshatra and pada. Leave an optional card empty to skip that person.")}</p>` +
    specs.map(personCardHTML).join("");
}

function switchPersonMode(role, mode) {
  const card = document.querySelector(`#mfParticipants .person-card[data-role="${role}"]`);
  if (!card) return;
  card.dataset.mode = mode;
  const needsDob = card.dataset.needsDob === "true";
  card.querySelectorAll(".nama-tab").forEach((b, i) => {
    const on = ["birth", "star"][i] === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on);
  });
  card.querySelectorAll(".person-mode").forEach(div => {
    div.hidden = !(div.dataset.for === mode || (div.dataset.for === "birth" && needsDob));
  });
  card.querySelectorAll(".birth-only").forEach(f => { f.hidden = mode !== "birth"; });
}

function onPersonNameLookup(role, val) {
  clearTimeout(namaLookupTimers[role]);
  const badge = el(`mfP_${role}_badge`);
  if (!badge) return;
  if (!val || !val.trim()) { badge.hidden = true; badge.innerHTML = ""; return; }
  namaLookupTimers[role] = setTimeout(async () => {
    try {
      const res = await fetch(`${API_BASE}/muhurta/nama-nakshatra/lookup?name=${encodeURIComponent(val.trim())}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      badge.hidden = false;
      if (data.matched && data.result) {
        const r = data.result;
        badge.innerHTML = `${t("Suggested nama nakshatra")}: <strong>${escapeHtml(T(r.nakshatra_en, r.nakshatra_te))}</strong>,
          ${t("pada {pada}", { pada: r.pada })} (${t("syllable")} <code>${escapeHtml(r.matched_syllable)}</code>)
          <button type="button" class="btn btn--sm" onclick="confirmNamaNakshatra('${role}', ${Number(r.nakshatra_index)}, ${Number(r.pada)})">${t("Use this")}</button>`;
      } else {
        badge.textContent = t("No nakshatra matches this name's first syllable. Pick the nama nakshatra from the list.");
      }
    } catch (e) {
      console.error("Nama lookup failed:", e);
      badge.hidden = false;
      badge.textContent = t("Name lookup failed. Pick the nakshatra directly.");
    }
  }, 250);
}

function confirmNamaNakshatra(role, nakIdx, pada) {
  const nama = el(`mfP_${role}_nama`), npada = el(`mfP_${role}_npada`), badge = el(`mfP_${role}_badge`);
  if (nama) nama.value = String(nakIdx);
  if (npada) npada.value = String(pada);
  if (badge) badge.textContent = t("Nama nakshatra set: {nak}, pada {pada}", { nak: NAKSHATRAS_27[nakIdx - 1][currentLang === "te" ? "te" : "en"], pada });
}

function collectParticipants() {
  const out = [];
  document.querySelectorAll("#mfParticipants .person-card").forEach(card => {
    const v = k => card.querySelector(`[data-k="${k}"]`);
    const val = k => { const i = v(k); return i ? (i.type === "checkbox" ? i.checked : i.value.trim()) : ""; };
    const num = k => parseInt(val(k)) || null;
    const p = { role: card.dataset.role, name: val("name") || null, gotra: val("gotra") || null,
                gender: val("gender") || null, eldest: !!val("eldest") };
    if (val("profile_id")) p.profile_id = val("profile_id");      // saved family member (plan R1)
    if (val("birth_date")) p.birth_date = val("birth_date");
    // The nama star (Griha Pravesha cards only) always counts. The janma star is sent only when the birth
    // details are not known; when they are, the server works it out from them (21 Nov 2026).
    ["nama_nak_idx", "nama_pada"].forEach(k => { if (num(k)) p[k] = num(k); });
    if (card.dataset.mode === "star") ["janma_nak_idx", "janma_pada", "rasi_idx"].forEach(k => { if (num(k)) p[k] = num(k); });
    if (card.dataset.mode === "birth" && p.birth_date) {
      p.from_birth = true;
      p.birth_time_unknown = !!val("birth_time_unknown");
      if (!p.birth_time_unknown && val("birth_time")) p.birth_time = val("birth_time");
      const reg = (typeof allRegions !== "undefined" ? allRegions : []).find(r => r.id === val("birth_region"));
      if (reg) Object.assign(p, { birth_place: reg.label, birth_lat: reg.lat, birth_lon: reg.lon, birth_tz_offset: reg.tz_offset });
    }
    const given = p.profile_id || p.name || p.birth_date || p.janma_nak_idx || p.nama_nak_idx || p.rasi_idx || p.gender || p.eldest;
    if (given) out.push(p);
  });
  return out;
}
// ---- Required details not given (11 Nov 2026) ----
// Only people marked Required (level L1) are checked; Recommended and Optional people never ask.
// A saved family member counts as complete: the server fills in their star.
function missingRequired() {
  const specs = (currentRule()?.participants || []).filter(s => s.level === "L1");
  const given = collectParticipants();
  const out = [];
  specs.forEach(s => {
    const p = given.find(x => x.role === s.role) || {};
    if (p.profile_id) return;
    const fromBirth = !!(p.from_birth && p.birth_date);
    const parts = [];
    if (s.star_basis === "nama") {
      if (!p.nama_nak_idx) parts.push(t("nama nakshatra"));
    } else if (p.from_birth) {
      // Birth details known: date and time (unless marked not known); the place defaults to the event's.
      if (!p.birth_time && !p.birth_time_unknown) parts.push(t("birth time"));
    } else if (!fromBirth && !p.janma_nak_idx) {
      const card = document.querySelector(`#mfParticipants .person-card[data-role="${s.role}"]`);
      parts.push(card && card.dataset.mode === "birth" ? t("birth date") : t("janma nakshatra"));
    }
    if ((s.fields || []).includes("birth_date") && !p.birth_date) parts.push(t("date of birth"));
    if (parts.length) out.push({ role: s.role, text: `${T(s.label_en, s.label_te)}: ${parts.join(", ")}` });
  });
  return out;
}
// ---- My family on the person cards (plan R1) ----
var FAMILY = [];          // var: the cards render before this line runs
var RELATION_LABELS = {
  self: ["Me"], spouse: ["Spouse"], son: ["Son"], daughter: ["Daughter"],
  father: ["Father"], mother: ["Mother"], brother: ["Brother"], sister: ["Sister"],
  grandchild: ["Grandchild"], other: ["Other"],
};

async function loadFamily() {
  try {
    const res = await fetch(`${API_BASE}/me/family`);
    if (res.ok) FAMILY = (await res.json()).family || [];
  } catch (e) { console.warn("Family not loaded:", e.message); }   // cards work without it
}

function familyPickerHTML(role, st) {
  const id = `mfP_${role}_fam`;
  const fam = FAMILY || [];                // undefined during the first render, before this file finishes
  if (!fam.length) {
    return `<p class="participants__hint"><a href="family.html">${t("Save your family once")}</a>${t(" to fill these cards with one click.")}</p>`;
  }
  return `<div class="field field--family"><label for="${id}">${t("From my family")}</label>
    <select id="${id}" data-k="profile_id" onchange="pickFamily('${role}', this.value)">
      <option value="">${t("— Enter the details below —")}</option>
      ${fam.map(f => `<option value="${escapeHtml(f.id)}"${st.profile_id === f.id ? " selected" : ""}>${escapeHtml(f.display_name)} · ${escapeHtml(T(...(RELATION_LABELS[f.relation] || [f.relation, f.relation])))}</option>`).join("")}
    </select></div>`;
}

function pickFamily(role, profileId) {
  const f = (FAMILY || []).find(x => x.id === profileId);
  if (!f) return;
  const set = (k, v) => { const i = el(`mfP_${role}_${k}`); if (!i) return; if (i.type === "checkbox") i.checked = !!v; else i.value = v == null ? "" : String(v); };
  set("name", f.display_name); set("gotra", f.gotra);
  set("janma", f.janma_nak); set("jpada", f.janma_pada); set("nama", f.nama_nak); set("npada", f.nama_pada);
  set("rasi", f.janma_rasi); set("lagna", f.birth_lagna);
  set("gender", { male: "boy", female: "girl" }[f.gender] || ""); set("eldest", f.is_eldest);
  if (f.birth && f.birth.date) set("dob", f.birth.date);
  switchPersonMode(role, "star");          // the saved star is shown; the server checks it belongs to you
}

// ---- Add the open window to the family events of the people picked on the cards (plan R2) ----
async function addWindowToFamily(btn) {
  const r = lastData?.results?.[openDayIdx];
  const picked = collectParticipants().filter(p => p.profile_id);
  if (!r || !picked.length) {
    AppShell.toast(t("Pick people from \"From my family\" on the cards first; the event is saved for them."), "error");
    return;
  }
  const start = r.window_start || r.start_time || "";
  const time = /^\d{2}:\d{2}/.test(start) ? start.slice(0, 5) : null;
  btn.disabled = true;
  try {
    for (const p of picked) {
      const res = await fetch(`${API_BASE}/me/family/events`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: p.profile_id, activity_id: lastData.activity_id, event_date: r.date, event_time: time,
                               status: "planned", notes: t("Chosen in the Muhurta Finder") }) });
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error((d && typeof d.detail === "string" && d.detail) || `HTTP ${res.status}`); }
    }
    AppShell.toast(t("Saved as a planned event for {names}. See My family.", { names: picked.map(p => p.name).join(currentLang === "te" ? ", " : " and ") }), "success");
  } catch (e) {
    AppShell.toast(t("Couldn't save the event: ") + e.message, "error");
  } finally { btn.disabled = false; }
}
