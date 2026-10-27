// ============================================================
// Muhurtham App · UI component framework (no modules — file:// safe)
//
// A component = a pure function (props) => HTML string.
// `UI.mount(rootId, components)` renders the tree once on load;
// every DOM id and inline handler stays identical to the original
// markup, so all panel logic (panchang.js / samskaras.js / pdf.js)
// keeps working untouched.
// ============================================================

var UI = (function () {

  // ---- primitives ---------------------------------------------------------

  /** Compose fragments; null/false/'' ignored. */
  function h() {
    var out = "";
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (a === null || a === undefined || a === false || a === "") continue;
      if (Array.isArray(a)) { out += h.apply(null, a); continue; }
      out += String(a);
    }
    return out;
  }

  /** attr() — HTML-attribute escaping (values inside quotes). */
  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  // ---- building blocks ----------------------------------------------------

  function field(id, label, te, inputHTML, opts) {
    opts = opts || {};
    var style = opts.hidden
      ? ' style="display:none;flex:1;min-width:' + (opts.minWidth || 170) + 'px;"'
      : (opts.minWidth ? ' style="flex:1;min-width:' + opts.minWidth + 'px;"' : "");
    return (
      '<div class="field"' + style +">" +
      (label ? '<label for="' + esc(id) + '"' +
        (te ? ' data-en="' + esc(label) + '" data-te="' + esc(te) + '"' : "") + ">" + esc(label) + "</label>" : "") +
      inputHTML +
      "</div>"
    );
  }

  function selectInput(id, options) {
    var opts = options.map(function (o) {
      var extra = (o.en !== undefined) ? ' data-en="' + esc(o.en) + '" data-te="' + esc(o.te) + '"' : "";
      return '<option value="' + esc(o.value) + '"' + extra + ">" + esc(o.label) + "</option>";
    }).join("");
    return '<select id="' + esc(id) + '">' + opts + "</select>";
  }

  function button(props) {
    var p = props || {};
    return (
      '<button id="' + esc(p.id) + '" class="' + (p.cls || "btn btn--primary") + '"' +
      (p.onclick ? ' onclick="' + esc(p.onclick) + '"' : "") +
      (p.en ? ' data-en="' + esc(p.en) + '" data-te="' + esc(p.te) + '"' : "") +
      (p.style ? ' style="' + esc(p.style) + '"' : "") +
      (p.disabled ? " disabled" : "") + ">" +
      (p.icon ? "<span>" + p.icon + "</span> " : "") + esc(p.label || p.text || "") +
      "</button>"
    );
  }

  function badge(text, cls) {
    return '<span class="badge ' + (cls ? cls : "badge--maroon") + '">' + esc(text) + "</span>";
  }

  function statusChip(id) {
    return '<div class="status" id="' + esc(id) + '"></div>';
  }

  function card(label, value, cls) {
    return (
      '<div class="card ' + (cls || "") + '">' +
      '<div class="label">' + label + "</div>" +
      '<div class="value">' + value + "</div>" +
      "</div>"
    );
  }

  function kaalaRow(nameTe, nameEn, valueId, rowStyle) {
    return (
      '<div class="kaala-row"' + (rowStyle ? ' style="' + rowStyle + '"' : "") + ">" +
      '<span class="kname" data-en="' + esc(nameEn) + '" data-te="' + esc(nameTe) + '">' + esc(nameEn) + "</span>" +
      '<span class="ktime" id="' + esc(valueId) + '">—</span>' +
      "</div>"
    );
  }

  function kaalaSection(titleTe, titleEn, body, sectionClsOrStyle, titleStyle) {
    var isClass = sectionClsOrStyle && !sectionClsOrStyle.includes(":") && !sectionClsOrStyle.includes(";");
    return (
      '<div class="kaala-section' + (isClass ? " " + sectionClsOrStyle : "") + '"' +
      (!isClass && sectionClsOrStyle ? ' style="' + sectionClsOrStyle + '"' : "") + ">" +
      '<div class="kaala-title"' + (titleStyle ? ' style="' + titleStyle + '"' : "") +
      ' data-en="' + esc(titleEn) + '" data-te="' + esc(titleTe) + '">' + titleEn + "</div>" +
      body +
      "</div>"
    );
  }

  function suggestionsBox(listId, inputIdWidth) {
    return '<div id="' + esc(listId) + '" class="suggestions-container" style="display:none; width: calc(100% - ' + inputIdWidth + 'px);"></div>';
  }

  function placeSearchRow(inputId, buttonId, listId) {
    return (
      '<div class="place-row">' +
      '<input type="text" id="' + esc(inputId) + '" placeholder="Enter place name..." autocomplete="off">' +
      button({ id: buttonId, cls: "btn btn--gold btn--sm", en: "Search & Go", te: "వెతకండి", label: "Search & Go" }) +
      suggestionsBox(listId, 130) +
      "</div>"
    );
  }

  // ---- mount ---------------------------------------------------------------

  function mount(rootId, html) {
    document.getElementById(rootId).innerHTML = html;
  }

  return {
    h: h, esc: esc,
    field: field,
    selectInput: selectInput,
    button: button,
    badge: badge,
    statusChip: statusChip,
    card: card,
    kaalaRow: kaalaRow,
    kaalaSection: kaalaSection,
    suggestionsBox: suggestionsBox,
    placeSearchRow: placeSearchRow,
    mount: mount,
  };
})();

window.UI = UI;