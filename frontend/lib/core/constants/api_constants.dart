/// API endpoint constants for the Muhurtham backend.
///
/// ┌──────────────────────────────────────────────────────────────────┐
/// │  IMPORTANT: WhatsApp Business API Configuration                  │
/// │                                                                  │
/// │  Paste your WhatsApp Business API key in [whatsAppApiKey] below. │
/// │  The OTP is actually sent by the BACKEND — the frontend only     │
/// │  triggers the flow. You also need to configure the WhatsApp      │
/// │  credentials on your FastAPI backend server.                     │
/// └──────────────────────────────────────────────────────────────────┘
class ApiConstants {
  ApiConstants._();

  // ─── Base URL ─────────────────────────────────────────────
  // Change this to your backend server URL.
  // For local development, use your machine's LAN IP (not localhost)
  // so that mobile devices on the same network can reach it.
  static const String baseUrl = 'http://192.168.1.20:8000';

  // ─── WhatsApp Business API ────────────────────────────────
  // Paste your WhatsApp Business API key here.
  // This is used by the backend to send OTP messages.
  // Get your key from: https://business.whatsapp.com/
  static const String whatsAppApiKey = 'YOUR_WHATSAPP_BUSINESS_API_KEY_HERE';
  
  // WhatsApp Business API base URL (Meta Cloud API)
  static const String whatsAppApiUrl = 'https://graph.facebook.com/v18.0';
  
  // Your WhatsApp Business phone number ID
  static const String whatsAppPhoneNumberId = 'YOUR_PHONE_NUMBER_ID_HERE';

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
