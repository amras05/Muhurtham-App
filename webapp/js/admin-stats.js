// Super admin statistics (plan R10): day-by-day charts from /admin/statistics, each with a CSV download.
(function () {
  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var data = null;

  // [series keys], title, colours (CSS custom properties so both themes work)
  var CHARTS = [
    { id: "new_accounts", keys: ["new_accounts"], en: "New accounts" },
    { id: "searches", keys: ["searches"], en: "Muhurta searches" },
    { id: "logins", keys: ["logins"], en: "Logins" },
    { id: "pdfs", keys: ["pdfs"], en: "PDF downloads" },
    { id: "codes", keys: ["codes_sent", "codes_confirmed"], en: "Login codes: sent and confirmed" },
    { id: "failed", keys: ["failed_logins"], en: "Failed logins" },
  ];
  var LABEL = { new_accounts: ["New accounts"], searches: ["Searches"], logins: ["Logins"], pdfs: ["PDFs"],
                codes_sent: ["Sent"], codes_confirmed: ["Confirmed"], failed_logins: ["Failed logins"] };
  var COLOURS = ["var(--color-primary-strong)", "var(--color-accent)"];

  function niceMax(v) { if (v <= 4) return 4; var p = Math.pow(10, Math.floor(Math.log10(v))); var m = Math.ceil(v / p); return (m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  function shortDate(iso) { return new Date(iso + "T12:00:00").toLocaleDateString(currentLang === "te" ? "te-IN" : "en-IN", { day: "numeric", month: "short" }); }

  function barChart(keys) {
    var W = 360, H = 150, L = 28, R = 6, T = 8, B = 22;
    var n = data.dates.length, max = niceMax(Math.max.apply(null, keys.map(function (k) { return Math.max.apply(null, data.series[k]); })) || 0);
    var slot = (W - L - R) / n, bw = Math.max(1, (slot * 0.8) / keys.length);
    var y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img">';
    [0, max / 2, max].forEach(function (g) {
      svg += '<line class="chart-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g) + '" y2="' + y(g) + '"/>' +
             '<text class="chart-axis" x="' + (L - 4) + '" y="' + (y(g) + 3) + '" text-anchor="end">' + g + "</text>";
    });
    data.dates.forEach(function (d, i) {
      keys.forEach(function (k, j) {
        var v = data.series[k][i], x = L + i * slot + slot * 0.1 + j * bw;
        if (v > 0) svg += '<rect x="' + x.toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (y(0) - y(v)).toFixed(1) +
          '" rx="1" fill="' + COLOURS[j] + '"><title>' + esc(shortDate(d) + " · " + t(LABEL[k]) + ": " + v) + "</title></rect>";
      });
    });
    [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i, idx) {
      var x = L + i * slot + slot / 2;
      svg += '<text class="chart-axis" x="' + x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (idx === 0 ? "start" : idx === 2 ? "end" : "middle") + '">' + esc(shortDate(data.dates[i])) + "</text>";
    });
    return svg + "</svg>";
  }

  function csv(keys) {
    var rows = [["date"].concat(keys)].concat(data.dates.map(function (d, i) { return [d].concat(keys.map(function (k) { return data.series[k][i]; })); }));
    var blob = new Blob([rows.map(function (r) { return r.join(","); }).join("\n") + "\n"], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "muhurtham_" + keys.join("_") + "_" + data.days + "d.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }

  function ranks(list, el) {
    var top = list.length ? list[0].count : 1;
    $(el).innerHTML = list.length ? list.map(function (x) {
      return "<li><span>" + esc(tr(x.en, x.te || x.en)) + "</span><b>" + x.count + '</b><span class="bar"><span style="width:' + Math.round(100 * x.count / top) + '%"></span></span></li>';
    }).join("") : '<li class="empty-state">' + t("No searches in this period.") + "</li>";
  }

  function render() {
    if (!data) return;
    var tv = data.totals, a = data.active_people, acc = data.accounts;
    var tiles = [
      [t("Active in the last 7 days"), a.last_7_days, t("30 days: ") + a.last_30_days],
      [t("Accounts"), acc.active, t("{total} in all · {locked_now} locked now", { total: acc.total, locked_now: acc.locked_now })],
      [t("Searches"), tv.searches, t("in {days} days", { days: data.days })],
      [t("PDF downloads"), tv.pdfs, Object.keys(data.pdf_by_kind).map(function (k) { return k + " " + data.pdf_by_kind[k]; }).join(" · ") || "—"],
    ];
    $("statTiles").innerHTML = tiles.map(function (x) {
      return '<div class="stat"><span>' + esc(x[0]) + "</span><b>" + x[1] + '</b><small class="portal-hint">' + esc(x[2]) + "</small></div>";
    }).join("");
    $("statCharts").innerHTML = CHARTS.map(function (c) {
      var total = c.keys.map(function (k) { return tv[k]; }).join(" / ");
      var legend = c.keys.length > 1 ? '<div class="chart-legend">' + c.keys.map(function (k, j) { return '<span><i style="background:' + COLOURS[j] + '"></i>' + esc(t(LABEL[k])) + "</span>"; }).join("") + "</div>" : "";
      return '<section class="chart-card" aria-label="' + esc(t(c.en)) + '"><div class="chart-card__head"><h2>' + esc(t(c.en)) + '</h2><span class="chart-card__total">' + total + "</span></div>" +
        legend + barChart(c.keys) + '<div><button type="button" class="linkish" data-csv="' + c.id + '">' + t("Download CSV") + "</button></div></section>";
    }).join("");
    ranks(data.top_muhurtas, "topMuhurtas");
    ranks(data.top_tabs, "topTabs");
    var s = data.server, up = s.uptime_seconds, upText = up >= 86400 ? Math.floor(up / 86400) + t(" days") : up >= 3600 ? Math.floor(up / 3600) + t(" hours") : Math.max(1, Math.floor(up / 60)) + t(" min");
    $("statServer").innerHTML = [
      [t("Version"), s.version + " · " + s.env],
      [t("Last updated"), updatedText(s.build)],
      [t("Since last restart"), upText],
      [t("Ephemeris files"), s.ephemeris_ok ? s.ephemeris_files + t(" found") : t("Missing: run backend/install_ephemeris.sh")],
    ].map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("");
  }

  // When the running version was deployed (or, on a developer's machine, committed), in India time, + commit.
  function updatedText(b) {
    var when = b && (b.deployed_at || b.committed_at), d = when ? new Date(when) : null;
    if (!d || isNaN(d.getTime())) return t("Not known");
    var stamp = d.toLocaleString(currentLang === "te" ? "te-IN" : "en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short",
                                                                         year: "numeric", hour: "numeric", minute: "2-digit" }) + " IST";
    return stamp + (b.commit ? " · " + b.commit : "") + (b.deployed_at ? "" : t(" (last commit; not deployed)"));
  }

  async function load() {
    try {
      var res = await fetch(API_BASE + "/admin/statistics?days=" + $("statDays").value);
      var body = await res.json().catch(function () { return null; });
      if (!res.ok) throw new Error(Auth.errorText({ status: res.status, data: body }));
      data = body; $("statMsg").hidden = true; render();
    } catch (e) { $("statMsg").hidden = false; $("statMsg").textContent = e.message; }
  }

  $("statCharts").addEventListener("click", function (e) {
    var id = e.target.getAttribute("data-csv");
    var c = id && CHARTS.find(function (x) { return x.id === id; });
    if (c && data) csv(c.keys);
  });
  $("statDays").addEventListener("change", load);
  window.onLangChange = render;
  load();
})();
