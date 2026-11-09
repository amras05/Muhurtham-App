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

  function render() {
    $("svList").innerHTML = items.length ? items.map(function (s) {
      var r = catalog[s.activity_id], sum = s.summary || {}, w = s.chosen_window;
      var what = r ? tr(r.title_en, r.title_te || r.title_en) : s.activity_id;
      var line = [sum.place_name, sum.start_date ? tr("from ", "") + sum.start_date + tr("", " నుండి") : "", sum.days_to_scan ? sum.days_to_scan + tr(" days", " రోజులు") : ""].filter(Boolean).join(" · ");
      var win = w ? tr("Chosen: ", "ఎంచుకున్నది: ") + [w.date, (w.window_start || w.start_time || "") + ((w.window_end || w.end_time) ? "–" + (w.window_end || w.end_time) : ""),
                    w.percentage != null ? w.percentage + "%" : ""].filter(Boolean).join(" · ") : "";
      return '<li data-id="' + esc(s.id) + '"><div><span><button type="button" class="sv-star" data-star="' + esc(s.id) + '" aria-pressed="' + s.is_favourite + '" aria-label="' +
        esc(s.is_favourite ? tr("Remove star", "నక్షత్రం తీసివేయండి") : tr("Star", "నక్షత్రం పెట్టండి")) + '">' + (s.is_favourite ? "★" : "☆") + "</button><strong>" + esc(s.label) + "</strong></span>" +
        "<small>" + esc(what) + (line ? " · " + esc(line) : "") + "</small>" + (win ? "<span>" + esc(win) + "</span>" : "") +
        (s.engine_changed ? '<small class="sv-note">' + tr("The app was updated after you saved this; results may differ now.", "భద్రపరిచిన తర్వాత యాప్ నవీకరించబడింది; ఫలితాలు మారవచ్చు.") + "</small>" : "") +
        "<small>" + tr("Saved ", "భద్రపరిచినది ") + esc(new Date(s.created_at).toLocaleDateString()) + "</small></div>" +
        '<div class="acts"><a class="btn btn--sm" href="muhurta-finder.html?saved=' + encodeURIComponent(s.id) + '">' + tr("Run again", "మళ్లీ శోధించండి") + "</a>" +
        '<button type="button" class="btn btn--sm btn--ghost" data-rename="' + esc(s.id) + '">' + tr("Rename", "పేరు మార్చండి") + "</button>" +
        '<button type="button" class="btn btn--sm btn--ghost" data-del="' + esc(s.id) + '">' + tr("Delete", "తొలగించండి") + "</button></div></li>";
    }).join("") : '<li class="portal-hint">' + tr("Nothing saved yet. In the Muhurta Finder, use \"Save this search\" or \"Save this muhurta\".",
                                                    "ఇంకా ఏమీ భద్రపరచలేదు. ముహూర్త శోధనలో 'ఈ శోధన భద్రపరచండి' లేదా 'ఈ ముహూర్తం భద్రపరచండి' వాడండి.") + "</li>";
  }

  async function load() {
    try { items = (await api("GET", "/me/saved")).saved; render(); }
    catch (e) { $("svList").innerHTML = '<li class="portal-hint">' + esc(e.message) + "</li>"; }
  }

  $("svList").addEventListener("click", async function (e) {
    var t = e.target, id;
    if ((id = t.getAttribute("data-star"))) {
      var s = items.find(function (x) { return x.id === id; });
      try { await api("PUT", "/me/saved/" + id, { is_favourite: !s.is_favourite }); load(); } catch (err) { say("error", err.message); }
    } else if ((id = t.getAttribute("data-rename"))) {
      var li = t.closest("li"), cur = items.find(function (x) { return x.id === id; });
      if (li.querySelector(".row-form")) return;
      li.querySelector("div").insertAdjacentHTML("beforeend", '<form class="row-form"><input maxlength="120" required value="' + esc(cur.label) + '" aria-label="' + esc(tr("New name", "కొత్త పేరు")) + '">' +
        '<button class="btn btn--sm">' + tr("Save", "భద్రపరచండి") + "</button></form>");
      var f = li.querySelector(".row-form"); f.querySelector("input").focus();
      f.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        try { await api("PUT", "/me/saved/" + id, { label: f.querySelector("input").value.trim() }); load(); } catch (err) { say("error", err.message); }
      });
    } else if ((id = t.getAttribute("data-del"))) {
      if (t.getAttribute("data-confirm") !== "1") { t.setAttribute("data-confirm", "1"); t.textContent = tr("Delete for good?", "శాశ్వతంగా తొలగించాలా?"); t.classList.add("btn--danger"); return; }
      try { await api("DELETE", "/me/saved/" + id); say("info", tr("Deleted.", "తొలగించాము.")); load(); } catch (err) { say("error", err.message); }
    }
  });

  window.onLangChange = render;
  api("GET", "/muhurta/catalog").then(function (c) { (c.all_activities || []).forEach(function (r) { catalog[r.id] = r; }); render(); }).catch(function () {});
  load();
})();
