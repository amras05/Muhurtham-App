import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/constants/app_constants.dart';

/// Muhurtham branding header for auth screens.
///
/// Shows the app logo (decorative ✦ symbol), app name,
/// and tagline with subtle entrance animations.
class AuthHeader extends StatelessWidget {
  final bool compact;

  const AuthHeader({super.key, this.compact = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // ─── Decorative Icon ──────────────────────────────────
        Container(
          width: compact ? 60 : 80,
          height: compact ? 60 : 80,
          decoration: BoxDecoration(
            gradient: AppColors.goldSaffronGradient,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withOpacity(0.3),
                blurRadius: 20,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Icon(
            Icons.auto_awesome,
            size: compact ? 30 : 40,
            color: Colors.white,
          ),
        )
            .animate()
            .scale(
              begin: const Offset(0.5, 0.5),
              end: const Offset(1, 1),
              duration: 600.ms,
              curve: Curves.elasticOut,
            )
            .fadeIn(duration: 400.ms),

        SizedBox(height: compact ? 12 : 20),

        // ─── App Name ─────────────────────────────────────────
        Text(
          AppConstants.appName,
          style: compact
              ? AppTextStyles.headlineLarge.copyWith(
                  color: AppColors.secondary,
                  letterSpacing: 2.0,
                )
              : AppTextStyles.brandName,
        )
            .animate()
            .fadeIn(delay: 200.ms, duration: 400.ms)
            .slideY(begin: 0.3, end: 0, duration: 400.ms),

        const SizedBox(height: 8),

        // ─── Tagline ──────────────────────────────────────────
        Text(
          AppConstants.appTagline,
          style: AppTextStyles.brandTagline,
          textAlign: TextAlign.center,
        )
            .animate()
            .fadeIn(delay: 400.ms, duration: 400.ms),
      ],
    );
  }
}
