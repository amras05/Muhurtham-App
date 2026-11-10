// ============================================================
// Muhurtham App · component: Month tab on the Panchang page
// One request (/panchang/month) fills a calendar for the month of the chosen date and place;
// tapping a date shows that day's panchang below the calendar. The Day tab is unchanged.
// ============================================================

let activePanchangTab = "day";
let monthData = null;      // last /panchang/month response
let monthLoadedKey = "";   // month + place the calendar was drawn for
let monthSelected = null;  // "YYYY-MM-DD" of the open day

const WEEKDAY_SHORT = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  te: ["ఆది", "సోమ", "మంగళ", "బుధ", "గురు", "శుక్ర", "శని"],
};
const PAKSHA_SHORT = {
  en: { shukla: "S", krishna: "K" },
  te: { shukla: "శు", krishna: "కృ" },
};

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonthKey() {
  const date = el("dateInput").value || "";
  return `${date.slice(0, 7)}|${el("regionSelect").value}|${el("customPlaceInput").value.trim()}`;
}

// The Get Panchang button, place search and autocomplete all come here.
function refreshPanchang() {
  if (activePanchangTab === "month") loadMonth();
  else getPanchang();
}

function showPanchangTab(name) {
  activePanchangTab = name;
  const isMonth = name === "month";
  el("dayView").hidden = isMonth;
  el("monthView").hidden = !isMonth;
  [["tabDayBtn", !isMonth], ["tabMonthBtn", isMonth]].forEach(([id, on]) => {
    el(id).classList.toggle("active", on);
    el(id).setAttribute("aria-selected", on ? "true" : "false");
  });
  if (isMonth) {
    if (!monthData || monthLoadedKey !== currentMonthKey()) loadMonth();
  } else {
    const shown = lastPanchang && (lastPanchang.panchang || lastPanchang).date;
    if (shown !== el("dateInput").value) getPanchang();
  }
}

async function loadMonth() {
  const date = el("dateInput").value;
  if (!date) {
    setStatus("Pick a date first.", true);
    return;
  }
  const [year, month] = date.split("-").map(Number);
  el("goButton").disabled = true;
  const place = await resolvePanchangPlace();
  if (!place) {
    el("goButton").disabled = false;
    return;
  }
  setStatus(currentLang === "te" ? "నెల పంచాంగం లోడ్ అవుతోంది…" : "Fetching the month's panchang…");
  try {
    const q = new URLSearchParams({
      year, month, lat: place.lat, lon: place.lon, tz_offset: place.tz_offset, place_name: place.place_name,
    });
    const res = await fetch(`${API_BASE}/panchang/month?${q}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    monthData = await res.json();
    monthLoadedKey = currentMonthKey();
    monthSelected = monthData.days.some(d => d.date === date) ? date : null;
    renderMonth();
    setStatus("");
  } catch (e) {
    setStatus(`Error: ${e.message}`, true);
  } finally {
    el("goButton").disabled = false;
  }
}

// Move the date by whole months (day kept where possible) and redraw.
function shiftMonth(delta) {
  const date = el("dateInput").value || isoLocal(new Date());
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1 + delta, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  el("dateInput").value = isoLocal(target);
  loadMonth();
}

function renderMonth() {
  if (!monthData) return;
  const lang = currentLang === "te" ? "te" : "en";
  const first = new Date(monthData.year, monthData.month - 1, 1);
  el("monthTitle").textContent = first.toLocaleDateString(lang === "te" ? "te-IN" : "en-IN", { month: "long", year: "numeric" });

  const lunar = [];
  monthData.days.forEach(d => {
    const name = d.chandramana && d.chandramana.month_name;
    if (name && !lunar.includes(name)) lunar.push(name);
  });
  const lunarText = lunar.map(n => te(n, MONTH_NAMES_TE)).join(" – ");
  el("monthSub").textContent = [lunarText, monthData.place].filter(Boolean).join(" · ");

  const today = isoLocal(new Date());
  let html = WEEKDAY_SHORT[lang].map(w => `<div class="month-wd" aria-hidden="true">${w}</div>`).join("");
  for (let i = 0; i < first.getDay(); i++) html += '<div class="month-blank" aria-hidden="true"></div>';

  monthData.days.forEach(d => {
    const dayNum = Number(d.date.slice(8));
    const t = d.tithi;
    const tithiName = te(t.name, TITHI_NAMES_TE);
    const nakName = te(d.nakshatra.name, NAKSHATRA_NAMES_TE);
    const paksha = PAKSHA_SHORT[lang][String(t.paksha).toLowerCase()] || "";
    const cls = ["month-cell"];
    if (d.date === today) cls.push("is-today");
    if (d.date === monthSelected) cls.push("is-selected");
    let mark = "";
    if (t.name === "Purnima") { cls.push("is-purnima"); mark = Icon("moon-disc"); }
    else if (t.name === "Amavasya") { cls.push("is-amavasya"); mark = Icon("moon-disc", { filled: true }); }
    else if (t.name === "Ekadashi") cls.push("is-ekadashi");
    const label = `${dayNum}, ${tithiName}, ${nakName}`;
    html +=
      `<button type="button" class="${cls.join(" ")}" data-date="${UI.esc(d.date)}" aria-pressed="${d.date === monthSelected}" aria-label="${UI.esc(label)}">` +
        `<span class="month-cell__num">${dayNum}${mark ? ` <span class="month-cell__mark">${mark}</span>` : ""}</span>` +
        `<span class="month-cell__tithi">${UI.esc(paksha)} ${UI.esc(tithiName)}</span>` +
        `<span class="month-cell__nak">${UI.esc(nakName)}</span>` +
      "</button>";
  });
  el("monthCal").innerHTML = html;
  renderMonthDetail();
}

function renderMonthDetail() {
  const box = el("monthDayDetail");
  const d = monthData && monthData.days.find(x => x.date === monthSelected);
  if (!d) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  const L = currentLang === "te";
  const s = panchangDaySections(d, monthData.place);   // same content as the shared PDF, PNG and text

  box.innerHTML =
    panchangSectionsHead(s,
      `<button type="button" class="btn btn--gold btn--sm no-print" id="monthOpenDay">${L ? "పూర్తి వివరాలు" : "Full day details"}</button>`) +
    panchangShareBar() +
    panchangSectionsBody(s);
  box.hidden = false;

  el("monthOpenDay").addEventListener("click", () => {
    el("dateInput").value = d.date;
    showPanchangTab("day");
  });
  bindPanchangShare(box, {
    getSections: () => panchangDaySections(d, monthData.place),
    date: d.date, place: monthData.place,
  });
}

function initMonthTab() {
  el("tabDayBtn").addEventListener("click", () => showPanchangTab("day"));
  el("tabMonthBtn").addEventListener("click", () => showPanchangTab("month"));
  el("monthPrev").addEventListener("click", () => shiftMonth(-1));
  el("monthNext").addEventListener("click", () => shiftMonth(1));

  el("monthCal").addEventListener("click", (e) => {
    const cell = e.target.closest("[data-date]");
    if (!cell) return;
    monthSelected = cell.getAttribute("data-date");
    el("dateInput").value = monthSelected;   // the Day tab then opens on this date
    renderMonth();
    const again = el("monthCal").querySelector(`[data-date="${monthSelected}"]`);
    if (again) again.focus({ preventScroll: true });   // keep keyboard focus on the redrawn cell
    el("monthDayDetail").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  // A date picked in another month redraws the calendar while the Month tab is open.
  el("dateInput").addEventListener("change", () => {
    if (activePanchangTab === "month" && monthLoadedKey !== currentMonthKey()) loadMonth();
  });

  window.onLangChange = () => { if (monthData) renderMonth(); };
}
