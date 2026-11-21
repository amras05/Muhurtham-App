// My muhurtas (plan R3): saved searches and chosen windows. Run again, star, rename, delete.
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function say(kind, text) { var b = $("svMsg"); b.hidden = false; b.className = "auth-alert auth-alert--" + kind; b.textContent = text; }
  async function api(method, path, body) {
    var res = await fetch(API_BASE + path, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: data }));
    return data;
  }
  var items = [], catalog = {};
  // Special Yogas and Shraddha calendar searches (plan F2) have no event; name them by tool.
  var PITRU = { annual: ["Shraddha calendar: yearly shraddha"],
                after_death: ["Shraddha calendar: rites after a death"],
                shannavati: ["Shraddha calendar: 96 shraddha days"] };
  function whatOf(s) {
    if (s.kind === "yogas") return t("Special yogas");
    if (s.kind === "pitru") { var p = PITRU[(s.summary || {}).mode]; return p ? t(p) : t("Shraddha calendar"); }
    var r = catalog[s.activity_id];
    return r ? tr(r.title_en, r.title_te || r.title_en) : s.activity_id;
  }

  function render() {
    $("svList").innerHTML = items.length ? items.map(function (s) {
      var sum = s.summary || {}, w = s.chosen_window;
      var what = whatOf(s);
      var line = [sum.place_name, sum.start_date ? t("from {date}", { date: sum.start_date }) : "", sum.days_to_scan ? sum.days_to_scan + t(" days") : "",
                  s.kind === "pitru" && sum.mode === "shannavati" && sum.year ? String(sum.year) : ""].filter(Boolean).join(" · ");
      var win = w ? t("Chosen: ") + [w.date, (w.window_start || w.start_time || "") + ((w.window_end || w.end_time) ? "–" + (w.window_end || w.end_time) : ""),
                    w.percentage != null ? w.percentage + "%" : ""].filter(Boolean).join(" · ") : "";
      return '<li data-id="' + esc(s.id) + '"><div><span><button type="button" class="sv-star" data-star="' + esc(s.id) + '" aria-pressed="' + s.is_favourite + '" aria-label="' +
        esc(s.is_favourite ? t("Remove star") : t("Star")) + '">' + (s.is_favourite ? Icon("star", { filled: true }) : Icon("star")) + "</button><strong>" + esc(s.label) + "</strong></span>" +
        "<small>" + esc(what) + (line ? " · " + esc(line) : "") + "</small>" + (win ? "<span>" + esc(win) + "</span>" : "") +
        (s.engine_changed ? '<small class="sv-note">' + t("The app was updated after you saved this; results may differ now.") + "</small>" : "") +
        "<small>" + t("Saved ") + esc(new Date(s.created_at).toLocaleDateString()) + "</small></div>" +
        '<div class="acts"><a class="btn btn--sm" href="muhurta-finder.html?saved=' + encodeURIComponent(s.id) + '">' + t("Run again") + "</a>" +
        '<button type="button" class="btn btn--sm btn--ghost" data-rename="' + esc(s.id) + '">' + t("Rename") + "</button>" +
        '<button type="button" class="btn btn--sm btn--ghost" data-del="' + esc(s.id) + '">' + t("Delete") + "</button></div></li>";
    }).join("") : '<li class="empty-state"><p>' + t("Nothing saved yet. In the Muhurta Finder (also Special Yogas and the Shraddha calendar), use \"Save this search\" or \"Save this muhurta\".") + '</p><a class="btn btn--sm" href="muhurta-finder.html">' + t("Open the Muhurta Finder") + "</a></li>";
  }

  async function load() {
    try { items = (await api("GET", "/me/saved")).saved; render(); }
    catch (e) { $("svList").innerHTML = '<li class="portal-hint">' + esc(e.message) + "</li>"; }
  }

  $("svList").addEventListener("click", async function (e) {
    var tv = e.target, id;
    if ((id = tv.getAttribute("data-star"))) {
      var s = items.find(function (x) { return x.id === id; });
      try { await api("PUT", "/me/saved/" + id, { is_favourite: !s.is_favourite }); load(); } catch (err) { say("error", err.message); }
    } else if ((id = tv.getAttribute("data-rename"))) {
      var li = tv.closest("li"), cur = items.find(function (x) { return x.id === id; });
      if (li.querySelector(".row-form")) return;
      li.querySelector("div").insertAdjacentHTML("beforeend", '<form class="row-form"><input maxlength="120" required value="' + esc(cur.label) + '" aria-label="' + esc(t("New name")) + '">' +
        '<button class="btn btn--sm">' + t("Save") + "</button></form>");
      var f = li.querySelector(".row-form"); f.querySelector("input").focus();
      f.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        try { await api("PUT", "/me/saved/" + id, { label: f.querySelector("input").value.trim() }); load(); } catch (err) { say("error", err.message); }
      });
    } else if ((id = tv.getAttribute("data-del"))) {
      if (tv.getAttribute("data-confirm") !== "1") { tv.setAttribute("data-confirm", "1"); tv.textContent = t("Delete for good?"); tv.classList.add("btn--danger"); return; }
      try { await api("DELETE", "/me/saved/" + id); say("info", t("Deleted.")); load(); } catch (err) { say("error", err.message); }
    }
  });

  window.onLangChange = render;
  api("GET", "/muhurta/catalog").then(function (c) { (c.all_activities || []).forEach(function (r) { catalog[r.id] = r; }); render(); }).catch(function () {});
  load();
})();
