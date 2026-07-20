import 'package:flutter/material.dart';
import '../features/auth/views/login_screen.dart';
import '../features/auth/views/signup_screen.dart';
import '../features/auth/views/otp_screen.dart';
import '../features/dashboard/views/user_home_screen.dart';
import '../features/dashboard/views/admin_dashboard_screen.dart';
import '../features/dashboard/views/superadmin_dashboard_screen.dart';
import '../features/splash/views/splash_screen.dart';
import '../features/profile/views/profile_screen.dart';

/// Navigation routes for the Muhurtham application.
class AppRoutes {
  AppRoutes._();

  static const String splash = '/';
  static const String login = '/login';
  static const String signup = '/signup';
  static const String otp = '/otp';
  static const String home = '/home';
  static const String admin = '/admin';
  static const String superadmin = '/superadmin';
  static const String profile = '/profile';

  static Map<String, WidgetBuilder> get routes => {
        splash: (context) => const SplashScreen(),
        login: (context) => const LoginScreen(),
        signup: (context) => const SignupScreen(),
        otp: (context) => const OtpScreen(),
        home: (context) => const UserHomeScreen(),
        admin: (context) => const AdminDashboardScreen(),
        superadmin: (context) => const SuperAdminDashboardScreen(),
        profile: (context) => const ProfileScreen(),
      };

  /// Generate dynamic routes if arguments are needed (fallback/optional).
  static Route<dynamic>? onGenerateRoute(RouteSettings settings) {
    // For now we use standard named routes defined in [routes].
    // If we need custom transitions or parameter passing later, it goes here.
    return null;
  }
}
