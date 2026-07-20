import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/enums/user_role.dart';
import '../../../core/storage/local_storage.dart';

/// Animated Splash Screen.
///
/// Welcomes users with a gold shimmer logo and checks local storage
/// to auto-redirect users to their respective dashboards based on role.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  final LocalStorage _storage = LocalStorage();

  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    // Wait for the splash screen animation duration
    await Future.delayed(AppConstants.splashDuration);

    if (!mounted) return;

    try {
      final isLoggedIn = await _storage.isLoggedIn();
      if (isLoggedIn) {
        final roleValue = await _storage.getUserRole();
        if (roleValue != null && mounted) {
          final role = UserRole.fromString(roleValue);
          _navigateToDashboard(role);
          return;
        }
      }
    } catch (_) {
      // If error occurs reading storage, fallback to login
    }

    if (mounted) {
      Navigator.of(context).pushReplacementNamed('/login');
    }
  }

  void _navigateToDashboard(UserRole role) {
    switch (role) {
      case UserRole.superAdmin:
        Navigator.of(context).pushReplacementNamed('/superadmin');
        break;
      case UserRole.admin:
        Navigator.of(context).pushReplacementNamed('/admin');
        break;
      case UserRole.user:
        Navigator.of(context).pushReplacementNamed('/home');
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: AppColors.warmBackgroundGradient,
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Logo Symbol
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  gradient: AppColors.goldSaffronGradient,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.3),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.auto_awesome,
                  size: 48,
                  color: Colors.white,
                ),
              )
                  .animate()
                  .scale(
                    begin: const Offset(0.3, 0.3),
                    end: const Offset(1, 1),
                    duration: 800.ms,
                    curve: Curves.elasticOut,
                  )
                  .shimmer(
                    delay: 800.ms,
                    duration: 1500.ms,
                    color: Colors.white.withOpacity(0.4),
                  ),

              const SizedBox(height: 24),

              // Brand Title
              Text(
                AppConstants.appName,
                style: AppTextStyles.brandName,
              )
                  .animate()
                  .fadeIn(delay: 300.ms, duration: 500.ms)
                  .slideY(begin: 0.3, end: 0, delay: 300.ms, duration: 500.ms),

              const SizedBox(height: 8),

              // Brand Tagline
              Text(
                AppConstants.appTagline,
                style: AppTextStyles.brandTagline,
              ).animate().fadeIn(delay: 600.ms, duration: 500.ms),

              const SizedBox(height: 60),

              // Small loader indicator at the bottom
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                ),
              ).animate().fadeIn(delay: 800.ms),
            ],
          ),
        ),
      ),
    );
  }
}
