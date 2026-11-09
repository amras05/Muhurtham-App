// Super admin: which tabs, muhurtas and tools users can see (plan R12).
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function say(kind, text) { var b = $("visMsg"); b.hidden = false; b.className = "auth-alert auth-alert--" + kind; b.textContent = text; }
  async function api(method, path, body) {
    var res = await fetch(API_BASE + path, { method: method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: data }));
    return data;
  }

  var data = null, hidden = { tabs: {}, events: {}, tools: {} }, saved = "", open = {};

  function snapshot() { return JSON.stringify([Object.keys(hidden.tabs).sort(), Object.keys(hidden.events).sort(), Object.keys(hidden.tools).sort()]); }
  function setFrom(d) {
    data = d; hidden = { tabs: {}, events: {}, tools: {} };
    d.tabs.forEach(function (t) { if (t.hidden) hidden.tabs[t.id] = 1; t.events.forEach(function (e) { if (e.hidden) hidden.events[e.id] = 1; }); });
    d.tools.forEach(function (x) { if (x.hidden) hidden.tools[x.id] = 1; });
    saved = snapshot();
  }
  function toggle(kind, id, shown) {
    return '<label class="vis-toggle' + (shown ? "" : " vis-off") + '"><input type="checkbox" data-kind="' + kind + '" data-id="' + esc(id) + '"' + (shown ? " checked" : "") + "> " +
      (shown ? tr("Shown", "చూపబడుతుంది") : tr("Hidden", "దాచబడింది")) + "</label>";
  }

  function render() {
    if (!data) return;
    var nHiddenEvents = 0, seen = {};
    data.tabs.forEach(function (t) {
      t.events.forEach(function (e) {
        if (seen[e.id]) return; seen[e.id] = 1;
        var tabsOf = data.tabs.filter(function (x) { return x.events.some(function (y) { return y.id === e.id; }); });
        if (hidden.events[e.id] || tabsOf.every(function (x) { return hidden.tabs[x.id]; })) nHiddenEvents++;
      });
    });
    $("visCounts").textContent = tr(nHiddenEvents + " of " + data.counts.events + " muhurtas hidden · " + Object.keys(hidden.tabs).length + " tabs hidden",
                                    data.counts.events + " లో " + nHiddenEvents + " ముహూర్తాలు దాచబడ్డాయి · " + Object.keys(hidden.tabs).length + " ట్యాబ్‌లు దాచబడ్డాయి");
    $("visSave").disabled = snapshot() === saved;
    $("visTools").innerHTML = data.tools.map(function (x) {
      return "<li><span>" + esc(tr(x.en, x.te)) + "</span>" + toggle("tool", x.id, !hidden.tools[x.id]) + "</li>";
    }).join("");
    $("visTabs").innerHTML = data.tabs.map(function (t) {
      var tabHidden = !!hidden.tabs[t.id];
      var shownCount = t.events.filter(function (e) { return !hidden.events[e.id]; }).length;
      var events = t.events.length ? t.events.map(function (e) {
        return "<li><span>" + esc(tr(e.en, e.te || e.en)) + (e.also_in_other_tab ? "<small>" + tr("Also listed in another tab", "మరో ట్యాబ్‌లో కూడా ఉంది") + "</small>" : "") +
          "</span>" + toggle("event", e.id, !hidden.events[e.id]) + "</li>";
      }).join("") : '<li><span class="portal-hint">' + tr(t.id === "yogas" ? "A search by yoga; no events to list." : "No muhurtas in this tab yet.",
                                                         t.id === "yogas" ? "యోగం ఆధారంగా శోధన; ముహూర్తాల జాబితా లేదు." : "ఈ ట్యాబ్‌లో ఇంకా ముహూర్తాలు లేవు.") + "</span></li>";
      return '<div class="vis-tab" data-hidden="' + (tabHidden ? 1 : 0) + '"><div class="vis-tab__head">' +
        '<button type="button" class="vis-tab__open" data-open="' + esc(t.id) + '" aria-expanded="' + (open[t.id] ? "true" : "false") + '">' +
        "<span aria-hidden=\"true\">" + (open[t.id] ? "▾" : "▸") + "</span> <strong>" + esc(tr(t.en, t.te)) + "</strong> <small class=\"portal-hint\">" +
        (t.events.length ? tr(shownCount + " of " + t.events.length + " shown", t.events.length + " లో " + shownCount + " చూపబడుతున్నాయి") : "") + "</small></button>" +
        toggle("tab", t.id, !tabHidden) + "</div><ul class=\"vis-list\"" + (open[t.id] ? "" : " hidden") + ">" + events + "</ul></div>";
    }).join("");
  }

  document.addEventListener("change", function (e) {
    var kind = e.target.getAttribute("data-kind"), id = e.target.getAttribute("data-id");
    if (!kind) return;
    var bag = hidden[kind === "tab" ? "tabs" : kind === "event" ? "events" : "tools"];
    if (e.target.checked) delete bag[id]; else bag[id] = 1;
    render();
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]");
    if (!b) return;
    var id = b.getAttribute("data-open");
    open[id] = !open[id];
    render();
  });

  $("visShowAll").addEventListener("click", function () { hidden = { tabs: {}, events: {}, tools: {} }; render(); });
  $("visSave").addEventListener("click", async function () {
    try {
      var d = await api("PUT", "/admin/catalog-visibility", {
        hidden_tabs: Object.keys(hidden.tabs), hidden_events: Object.keys(hidden.events), hidden_tools: Object.keys(hidden.tools) });
      setFrom(d); render();
      say("info", tr("Saved. Users see the change within 15 seconds.", "భద్రపరిచాము. 15 సెకన్లలో వినియోగదారులకు అమలవుతుంది."));
    } catch (err) { say("error", err.message); }
  });
  window.addEventListener("beforeunload", function (e) { if (data && snapshot() !== saved) { e.preventDefault(); e.returnValue = ""; } });

  window.onLangChange = render;
  api("GET", "/admin/catalog-visibility").then(function (d) { setFrom(d); render(); })
    .catch(function (e) { $("visTabs").innerHTML = '<p class="portal-hint">' + esc(e.message) + "</p>"; });
})();
