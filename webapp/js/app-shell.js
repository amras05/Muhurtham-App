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
    window.setTimeout(function () { item.remove(); }, 5000);
  }

  function bindModalEscape() {
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var close = document.querySelector(".modal-overlay[style*='flex'] .modal-close");
      if (close) close.click();
    });
  }

  function init() { bindModalEscape(); }
  return { init: init, toast: toast };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", window.AppShell.init);
} else {
  window.AppShell.init();
}
