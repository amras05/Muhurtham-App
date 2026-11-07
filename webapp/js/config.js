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
  // If served directly from the FastAPI backend (port 8555) or production web reverse proxy (empty/80/443)
  if (window.location.port === "8555" || window.location.port === "" || window.location.port === "80" || window.location.port === "443") {
    API_BASE = ""; // same-origin: every fetch() uses a relative path
  }
}

const el = (id) => document.getElementById(id);
