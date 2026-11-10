// ============================================================
// Muhurtham App · the icon set (Experience Plan U2)
// Drawn icons in place of emoji, so they look the same in every browser and take the colour of
// the text around them.
//   In script:  Icon("clock")            → an inline <svg> string;  Icon("star", { filled: true })
//   In a page:  <span data-icon="lamp"></span>   (filled in when the page loads)
// Icons are decoration: each is aria-hidden, so keep the words next to it. Styles: .icon in
// css/components.css. Server-made PDFs leave icons out, as they did with emoji.
// ============================================================
window.Icon = (function () {
  var P = {
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    landmark: '<path d="M3 22h18"/><path d="M4 18h16"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M12 2l8 5H4z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    pin: '<path d="M12 17v5"/><path d="M5 17h14l-2-4V6a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7z"/>',
    "map-pin": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    lamp: '<path d="M3 14h18c0 3.5-4 6-9 6s-9-2.5-9-6z"/><path d="M12 11c-1.7-1.5-2-3.2 0-6 2 2.8 1.7 4.5 0 6z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9l1.4 1.4"/><path d="M17.7 17.7l1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.9 19.1l1.4-1.4"/><path d="M17.7 6.3l1.4-1.4"/>',
    sunrise: '<path d="M12 2v6"/><path d="M8.5 5.5L12 2l3.5 3.5"/><path d="M4.9 10.9l1.4 1.4"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="M17.7 12.3l1.4-1.4"/><path d="M22 22H2"/><path d="M16 18a4 4 0 0 0-8 0"/>',
    sunset: '<path d="M12 8V2"/><path d="M8.5 4.5L12 8l3.5-3.5"/><path d="M4.9 10.9l1.4 1.4"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="M17.7 12.3l1.4-1.4"/><path d="M22 22H2"/><path d="M16 18a4 4 0 0 0-8 0"/>',
    "cloud-sun": '<path d="M12 2v2"/><path d="M4.9 4.9l1.4 1.4"/><path d="M20 12h2"/><path d="M17.7 6.3l1.4-1.4"/><path d="M15.9 12.6A4 4 0 1 0 9.4 8.5"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6z"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
    "moon-disc": '<circle cx="12" cy="12" r="8"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18h.01"/>',
    sparkle: '<path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/>',
    wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7"/><path d="M12 14v7"/><path d="M3 12h7"/><path d="M14 12h7"/><path d="M5.6 5.6l5 5"/><path d="M13.4 13.4l5 5"/><path d="M18.4 5.6l-5 5"/><path d="M10.6 13.4l-5 5"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 4 13C4 7 9 4 20 4c0 9-3 16-9 16z"/><path d="M4 21c2-6 6-9 11-11"/>',
    hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22"/><path d="M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2"/>',
    chart: '<path d="M3 3v18h18"/><path d="M8 17v-5"/><path d="M13 17V8"/><path d="M18 17v-9"/>',
    scroll: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/>',
    flame: '<path d="M12 22a7 7 0 0 0 7-7c0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-6-4-9 0 4-4 7-4 13a7 7 0 0 0 7 7z"/>',
    zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    plane: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
    car: '<path d="M5 17H3v-5l2-5h11l3 5h2v5h-2"/><path d="M9 17h6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M4 12h15"/>',
    star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8l-6.2 3.3L7 14.2 2 9.3l6.9-1z"/>',
  };

  function Icon(name, opts) {
    var body = P[name];
    if (!body) return "";
    return '<svg class="icon' + (opts && opts.filled ? " icon--filled" : "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + "</svg>";
  }

  // <span data-icon="name"></span> in a page's own HTML
  function fill() {
    document.querySelectorAll("[data-icon]").forEach(function (el) {
      if (!el.firstChild) el.innerHTML = Icon(el.getAttribute("data-icon"), { filled: el.hasAttribute("data-icon-filled") });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill);
  else fill();

  return Icon;
})();
