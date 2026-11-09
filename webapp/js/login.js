// ============================================================
// Muhurtham App · login page (log in, create account, code, forgot / reset password)
// Talks to the server through Auth (js/auth.js); never handles a token.
// ============================================================
(function () {
  var CONSENT_VERSION = "2026-11-v1";
  var VIEWS = ["login", "signup", "otp", "forgot", "reset"];
  var TITLES = {
    login:  ["Sign in", "లాగిన్", "Use the mobile number you signed up with.", "మీరు నమోదు చేసిన మొబైల్ నంబర్ వాడండి."],
    signup: ["Create your account", "కొత్త ఖాతా", "We send a code to your WhatsApp to confirm the number.", "నంబర్ ధృవీకరణకు మీ వాట్సాప్‌కు కోడ్ పంపుతాము."],
    otp:    ["Enter the code", "కోడ్ నమోదు చేయండి", "The code is valid for 5 minutes.", "కోడ్ 5 నిమిషాలు చెల్లుతుంది."],
    forgot: ["Reset your password", "పాస్‌వర్డ్ రీసెట్", "We send a code to the WhatsApp of this number.", "ఈ నంబర్ వాట్సాప్‌కు కోడ్ పంపుతాము."],
    reset:  ["Choose a new password", "కొత్త పాస్‌వర్డ్", "All your devices will be signed out.", "మీ అన్ని పరికరాల నుండి సైన్ అవుట్ అవుతారు."],
  };
  var pendingPhone = "";
  var currentView = "login";

  function applyTitles() {
    var t = TITLES[currentView];
    $("authTitle").textContent = tr(t[0], t[1]);
    $("authLede").textContent = tr(t[2], t[3]);
  }
  window.onLangChange = applyTitles;

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
    AppShell.toast(tr("Welcome, " + user.name, "స్వాగతం, " + user.name), "success");
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
      return message("error", tr("Please tick the box to agree before creating an account.", "ఖాతా సృష్టించే ముందు అంగీకార పెట్టెను టిక్ చేయండి."));
    }
    busy(e.target, async function () {
      pendingPhone = $("signupPhone").value;
      var r = await Auth.signup({
        phone: pendingPhone, name: $("signupName").value.trim(), password: $("signupPassword").value,
        confirm_password: $("signupConfirm").value, consent_version: CONSENT_VERSION,
      });
      if (!r.ok) return message("error", Auth.errorText(r));
      showView("otp");
      $("otpHint").textContent = tr("We sent a code to WhatsApp on +91 " + pendingPhone + ".",
                                    "+91 " + pendingPhone + " వాట్సాప్‌కు కోడ్ పంపాము.");
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
    message(r.ok ? "info" : "error", r.ok ? tr("A new code has been sent.", "కొత్త కోడ్ పంపాము.") : Auth.errorText(r));
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
    var DELETED = ["Your account and everything saved in it have been deleted.", "మీ ఖాతా మరియు అందులో భద్రపరిచినవన్నీ తొలగించబడ్డాయి."];
    message("info", tr(DELETED[0], DELETED[1]));
    window.onLangChange = function () {
      applyTitles();
      var box = $("authInfo");
      if (!box.hidden && DELETED.indexOf(box.textContent) !== -1) box.textContent = tr(DELETED[0], DELETED[1]);
    };
    var q = new URLSearchParams(window.location.search);
    q.delete("deleted");
    history.replaceState(null, "", window.location.pathname + (q.toString() ? "?" + q.toString() : "") + window.location.hash);
  }
})();
