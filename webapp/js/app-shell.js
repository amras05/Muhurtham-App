// Shared progressive-enhancement helpers. No routes or API contracts are changed.
window.AppShell = (function () {
  function ensureToastRegion() {
    var region = document.getElementById("toastRegion");
    if (region) return region;
    region = document.createElement("div");
    region.id = "toastRegion";
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    document.body.appendChild(region);
    return region;
  }

  function toast(message, kind) {
    if (!message) return;
    var item = document.createElement("div");
    item.className = "toast toast--" + (kind || "info");
    item.setAttribute("role", kind === "error" ? "alert" : "status");
    item.textContent = message;
    ensureToastRegion().appendChild(item);
    window.setTimeout(function () { item.remove(); }, kind === "error" ? 9000 : 5000);   // errors stay longer
  }

  function inTelugu() { return typeof currentLang !== "undefined" && currentLang === "te"; }

  // The app's own "Are you sure?" dialog, in place of the browser's confirm() (Experience Plan U2).
  //   if (!(await AppShell.confirm(message, { ok: "Remove", cancel: "Keep", danger: true }))) return;
  // Resolves true for the main button, false for Cancel, Escape or a click outside.
  // Optional (21 Nov 2026): opts.title (a heading) and opts.input, a box to fill before confirming:
  //   { label, placeholder, minLength, maxLength, mustEqual, error }  - mustEqual is compared ignoring case;
  //   then the promise resolves to the typed text (trimmed), or null when cancelled.
  function confirmDialog(message, opts) {
    opts = opts || {};
    var ask = opts.input || null;
    return new Promise(function (resolve) {
      var d = document.createElement("dialog");
      if (!d.showModal) {                                            // very old browsers
        if (!ask) { resolve(window.confirm(message)); return; }
        var v = window.prompt(message + (ask.label ? "\n\n" + ask.label : ""));
        resolve(v == null ? null : v.trim()); return;
      }
      d.className = "app-dialog" + (opts.title ? " app-dialog--titled" : "");
      d.setAttribute("aria-describedby", "appDialogMsg");
      var form = document.createElement("form");
      form.method = "dialog";
      form.noValidate = true;
      if (opts.title) {
        var h = document.createElement("h2");
        h.id = "appDialogTitle";
        h.className = "app-dialog__title";
        h.textContent = opts.title;
        d.setAttribute("aria-labelledby", "appDialogTitle");
        form.appendChild(h);
      }
      var msg = document.createElement("p");
      msg.id = "appDialogMsg";
      msg.className = "app-dialog__msg";
      msg.textContent = message;
      form.appendChild(msg);
      var input = null, err = null;
      if (ask) {
        var wrap = document.createElement("div");
        wrap.className = "app-dialog__field";
        var lab = document.createElement("label");
        lab.htmlFor = "appDialogInput";
        lab.textContent = ask.label || "";
        input = document.createElement("input");
        input.id = "appDialogInput";
        input.autocomplete = "off";
        if (ask.placeholder) input.placeholder = ask.placeholder;
        if (ask.maxLength) input.maxLength = ask.maxLength;
        err = document.createElement("p");
        err.className = "app-dialog__error";
        err.setAttribute("role", "alert");
        err.hidden = true;
        wrap.appendChild(lab); wrap.appendChild(input); wrap.appendChild(err);
        form.appendChild(wrap);
      }
      var actions = document.createElement("div");
      actions.className = "app-dialog__actions";
      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "app-dialog__btn";
      cancel.textContent = opts.cancel || (typeof t === "function" ? t("Cancel") : "Cancel");
      var ok = document.createElement("button");
      ok.type = "submit";
      ok.className = "app-dialog__btn " + (opts.danger ? "app-dialog__btn--danger" : "app-dialog__btn--primary");
      ok.textContent = opts.ok || (typeof t === "function" ? t("OK@@dialog") : "OK");
      actions.appendChild(cancel); actions.appendChild(ok);
      form.appendChild(actions);
      d.appendChild(form);
      var result = ask ? null : false;
      cancel.addEventListener("click", function () { d.close(); });
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!ask) { result = true; d.close(); return; }
        var v = input.value.trim();
        var bad = (ask.minLength && v.length < ask.minLength) ||
                  (ask.mustEqual != null && v.toLocaleLowerCase() !== String(ask.mustEqual).trim().toLocaleLowerCase());
        if (bad) {
          err.textContent = ask.error || (typeof t === "function" ? t("Please fill this in correctly.") : "Please fill this in correctly.");
          err.hidden = false; input.focus(); return;
        }
        result = v; d.close();
      });
      d.addEventListener("click", function (e) { if (e.target === d) d.close(); });   // the backdrop
      d.addEventListener("close", function () { d.remove(); resolve(result); });
      document.body.appendChild(d);
      d.showModal();
      (input || cancel).focus();   // the box to fill, else the safe choice: Enter never confirms by accident
    });
  }

  function bindModalEscape() {
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var close = document.querySelector(".modal-overlay[style*='flex'] .modal-close");
      if (close) close.click();
    });
  }

  function init() { bindModalEscape(); }
  return { init: init, toast: toast, confirm: confirmDialog };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", window.AppShell.init);
} else {
  window.AppShell.init();
}
