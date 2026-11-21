// ============================================================
// Muhurtham App · login page (log in, create account, code, forgot / reset password)
// Talks to the server through Auth (js/auth.js); never handles a token.
// ============================================================
(function () {
  var CONSENT_VERSION = "2026-11-v1";
  var VIEWS = ["login", "signup", "otp", "forgot", "reset"];
  var TITLES = {
    login:  ["Sign in to your account", "Use the mobile number you signed up with."],
    signup: ["Create your account", "We send a code to your WhatsApp to confirm the number."],
    otp:    ["Enter the code", "The code is valid for 5 minutes."],
    forgot: ["Reset your password", "We send a code to the WhatsApp of this number."],
    reset:  ["Choose a new password", "All your devices will be signed out."],
  };
  var pendingPhone = "";
  var currentView = "login";

  function applyTitles() {
    var tv = TITLES[currentView];
    var S = window.SiteConfig;
    var own = currentView === "login" && S;   // the super admin may reword the sign-in view (plan D8)
    $("authTitle").textContent = own ? S.text("login_title", tv[0]) : t(tv[0]);
    $("authLede").textContent = own ? S.text("login_lede", tv[1]) : t(tv[1]);
  }
  window.onLangChange = applyTitles;
  if (window.SiteConfig) SiteConfig.onChange(function () { applyTitles(); });

  function tr(en, te) { return currentLang === "te" ? te : en; }
  function $(id) { return document.getElementById(id); }

  function nextUrl() {
    // Only same-site pages: a relative file name like "muhurta-finder.html#x", never another host.
    var next = new URLSearchParams(window.location.search).get("next") || "";
    return /^[a-z0-9-]+\.html(#[\w-]*)?$/i.test(next) ? next : "/";   // "/" = your role's home
  }

  function message(kind, text) {
    $("authError").hidden = kind !== "error";
    $("authInfo").hidden = kind !== "info";
    if (kind === "error") $("authError").textContent = text;
    if (kind === "info") $("authInfo").textContent = text;
  }

  window.showView = function (name) {
    VIEWS.forEach(function (v) { $("view" + v.charAt(0).toUpperCase() + v.slice(1)).hidden = v !== name; });
    var tabsVisible = name === "login" || name === "signup";
    document.querySelector(".auth-tabs").hidden = !tabsVisible;
    [["tabLogin", "login"], ["tabSignup", "signup"]].forEach(function (p) {
      $(p[0]).classList.toggle("active", p[1] === name);
      $(p[0]).setAttribute("aria-selected", String(p[1] === name));
    });
    currentView = name;
    applyTitles();
    message(null);
    var first = document.querySelector("#view" + name.charAt(0).toUpperCase() + name.slice(1) + " input");
    if (first) first.focus();
  };

  async function busy(form, fn) {
    var btn = form.querySelector(".auth-submit");
    btn.disabled = true;
    try { await fn(); } finally { btn.disabled = false; }
  }

  function done(user) {
    AppShell.toast(t("Welcome, {name}", { name: user.name }), "success");
    window.location.href = nextUrl();
  }

  $("viewLogin").addEventListener("submit", function (e) {
    e.preventDefault();
    busy(e.target, async function () {
      var r = await Auth.login($("loginPhone").value, $("loginPassword").value);
      if (r.ok) return done(r.data.user);
      message("error", Auth.errorText(r));
    });
  });

  $("viewSignup").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!$("signupConsent").checked) {
      return message("error", t("Please tick the box to agree before creating an account."));
    }
    busy(e.target, async function () {
      pendingPhone = $("signupPhone").value;
      var r = await Auth.signup({
        phone: pendingPhone, name: $("signupName").value.trim(), password: $("signupPassword").value,
        confirm_password: $("signupConfirm").value, consent_version: CONSENT_VERSION,
      });
      if (!r.ok) return message("error", Auth.errorText(r));
      showView("otp");
      $("otpHint").textContent = t("We sent a code to WhatsApp on +91 {pendingPhone}.", { pendingPhone: pendingPhone });
    });
  });

  $("viewOtp").addEventListener("submit", function (e) {
    e.preventDefault();
    busy(e.target, async function () {
      var r = await Auth.verify(pendingPhone, $("otpCode").value.trim());
      if (r.ok) return done(r.data.user);
      message("error", Auth.errorText(r));
    });
  });

  window.resendCode = async function () {
    var btn = $("resendBtn");
    btn.disabled = true;
    var r = await Auth.resend(pendingPhone);
    message(r.ok ? "info" : "error", r.ok ? t("A new code has been sent.") : Auth.errorText(r));
    setTimeout(function () { btn.disabled = false; }, 30000);   // the server allows one code per 30 seconds
  };

  $("viewForgot").addEventListener("submit", function (e) {
    e.preventDefault();
    busy(e.target, async function () {
      pendingPhone = $("forgotPhone").value;
      var r = await Auth.forgot(pendingPhone);
      if (!r.ok) return message("error", Auth.errorText(r));
      showView("reset");
      message("info", r.data.message);
    });
  });

  $("viewReset").addEventListener("submit", function (e) {
    e.preventDefault();
    busy(e.target, async function () {
      var r = await Auth.reset({ phone: pendingPhone, otp: $("resetCode").value.trim(),
                                 new_password: $("resetPassword").value, confirm_password: $("resetConfirm").value });
      if (!r.ok) return message("error", Auth.errorText(r));
      showView("login");
      $("loginPhone").value = pendingPhone;
      message("info", r.data.message);
    });
  });

  // Already signed in: go straight on.
  Auth.me().then(function (user) { if (user) window.location.replace(nextUrl()); });
  if (window.location.hash === "#signup") showView("signup");

  // After "Delete my account" (account.js sends ?deleted=1, plan F2). Shown once: the flag is taken
  // out of the address so a reload doesn't show it again; a language switch shows it in the new language.
  if (new URLSearchParams(window.location.search).get("deleted") === "1") {
    var DELETED = ["Your account and everything saved in it have been deleted."];
    message("info", t(DELETED));
    window.onLangChange = function () {
      applyTitles();
      var box = $("authInfo");
      if (!box.hidden && DELETED.indexOf(box.textContent) !== -1) box.textContent = t(DELETED);
    };
    var q = new URLSearchParams(window.location.search);
    q.delete("deleted");
    history.replaceState(null, "", window.location.pathname + (q.toString() ? "?" + q.toString() : "") + window.location.hash);
  }

  // Show / hide password (Stitch sign-in design, 19 Nov 2026). The button only changes the field's type.
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a10.6 10.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function eyeState(btn, shown) {
    btn.innerHTML = shown ? EYE_OFF : EYE;
    btn.setAttribute("aria-pressed", String(shown));
    btn.setAttribute("aria-label", shown ? t("Hide password") : t("Show password"));
  }
  document.querySelectorAll("[data-show-pass]").forEach(function (btn) {
    eyeState(btn, false);
    btn.addEventListener("click", function () {
      var input = $(btn.getAttribute("data-show-pass"));
      var shown = input.type === "password";
      input.type = shown ? "text" : "password";
      eyeState(btn, shown);
    });
  });
})();
