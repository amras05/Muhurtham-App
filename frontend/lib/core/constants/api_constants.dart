/// API endpoint constants for the Muhurtham backend.
///
/// WhatsApp OTPs are sent by the backend. Its WhatsApp credentials live only in the
/// server's environment (MUHURTHAM_WHATSAPP_*); never put them in the app.
class ApiConstants {
  ApiConstants._();

  // ─── Base URL ─────────────────────────────────────────────
  // Change this to your backend server URL.
  // For local development, use your machine's LAN IP (not localhost)
  // so that mobile devices on the same network can reach it.
  static const String baseUrl = 'http://192.168.1.20:8000';

  // ─── Auth Endpoints ───────────────────────────────────────
  static const String login = '/auth/login';
  static const String signup = '/auth/signup';
  static const String verifyOtp = '/auth/verify-otp';
  static const String resendOtp = '/auth/resend-otp';
  static const String refreshToken = '/auth/refresh';
  static const String logout = '/auth/logout';

  // ─── User Endpoints ───────────────────────────────────────
  static const String userProfile = '/user/profile';
  static const String updateProfile = '/user/profile';

  // ─── Admin Endpoints ──────────────────────────────────────
  static const String adminUsers = '/admin/users';
  static const String adminUserDetail = '/admin/users/'; // + userId
  static const String adminStats = '/admin/stats';

  // ─── Super Admin Endpoints ────────────────────────────────
  static const String adminLogs = '/admin/logs';
  static const String adminUserLogs = '/admin/users/'; // + userId + /logs
  static const String systemHealth = '/admin/health';

  // ─── Timeout ──────────────────────────────────────────────
  static const int connectionTimeout = 30000; // 30 seconds
  static const int receiveTimeout = 30000;    // 30 seconds
}
