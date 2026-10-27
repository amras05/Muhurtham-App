// ============================================================
// Muhurtham App · component: core config & name maps
// ============================================================

// Same-origin detection:
//   - Pages served by the Muhurtham server (http/https, not via a CDN host)
//     talk to their own origin — no hardcoded host, works behind any
//     reverse proxy, domain or port.
//   - Pages opened via file:// keep pointing at the local dev server.
var API_BASE = "http://127.0.0.1:8555";
if (window.location.protocol === "http:" || window.location.protocol === "https:") {
  API_BASE = ""; // same-origin: every fetch() uses a relative path
}

const el = (id) => document.getElementById(id);
