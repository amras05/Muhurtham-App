/// App-wide constants for the Muhurtham application.
class AppConstants {
  AppConstants._();

  // ─── App Info ─────────────────────────────────────────────
  static const String appName = 'Muhurtham';
  static const String appTagline = 'Find Auspicious Timings for Life\'s Moments';
  static const String appVersion = '1.0.0';

  // ─── Storage Keys ─────────────────────────────────────────
  static const String tokenKey = 'auth_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userDataKey = 'user_data';
  static const String userRoleKey = 'user_role';
  static const String isLoggedInKey = 'is_logged_in';
  static const String onboardingCompleteKey = 'onboarding_complete';

  // ─── Validation ───────────────────────────────────────────
  static const int phoneNumberLength = 10;
  static const int minPasswordLength = 8;
  static const int otpLength = 6;
  static const String defaultCountryCode = '+91';

  // ─── OTP ──────────────────────────────────────────────────
  static const int otpResendTimerSeconds = 60;
  static const int otpExpiryMinutes = 5;

  // ─── Pagination ───────────────────────────────────────────
  static const int defaultPageSize = 20;

  // ─── Animation Durations ──────────────────────────────────
  static const Duration shortAnimation = Duration(milliseconds: 200);
  static const Duration mediumAnimation = Duration(milliseconds: 400);
  static const Duration longAnimation = Duration(milliseconds: 600);
  static const Duration splashDuration = Duration(seconds: 3);

  // ─── Layout ───────────────────────────────────────────────
  static const double mobileBreakpoint = 600;
  static const double tabletBreakpoint = 900;
  static const double desktopBreakpoint = 1200;
  static const double authCardMaxWidth = 480;
  static const double dashboardMaxWidth = 1200;
}
