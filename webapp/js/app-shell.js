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
  function confirmDialog(message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var d = document.createElement("dialog");
      if (!d.showModal) { resolve(window.confirm(message)); return; }   // very old browsers
      d.className = "app-dialog";
      d.setAttribute("aria-describedby", "appDialogMsg");
      var msg = document.createElement("p");
      msg.id = "appDialogMsg";
      msg.className = "app-dialog__msg";
      msg.textContent = message;
      var actions = document.createElement("div");
      actions.className = "app-dialog__actions";
      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "app-dialog__btn";
      cancel.textContent = opts.cancel || (inTelugu() ? "రద్దు" : "Cancel");
      var ok = document.createElement("button");
      ok.type = "button";
      ok.className = "app-dialog__btn " + (opts.danger ? "app-dialog__btn--danger" : "app-dialog__btn--primary");
      ok.textContent = opts.ok || (inTelugu() ? "సరే" : "OK");
      actions.appendChild(cancel); actions.appendChild(ok);
      d.appendChild(msg); d.appendChild(actions);
      cancel.addEventListener("click", function () { d.close("cancel"); });
      ok.addEventListener("click", function () { d.close("ok"); });
      d.addEventListener("click", function (e) { if (e.target === d) d.close("cancel"); });   // the backdrop
      d.addEventListener("close", function () { var yes = d.returnValue === "ok"; d.remove(); resolve(yes); });
      document.body.appendChild(d);
      d.showModal();
      cancel.focus();   // the safe choice has focus, so Enter never confirms by accident
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
