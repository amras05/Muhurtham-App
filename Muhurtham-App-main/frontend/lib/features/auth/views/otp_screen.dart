import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:pin_code_fields/pin_code_fields.dart';
import 'package:provider/provider.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/constants/app_constants.dart';
import '../../../shared/widgets/responsive_layout.dart';
import '../viewmodels/otp_viewmodel.dart';
import 'widgets/gradient_button.dart';

/// OTP Verification Screen
///
/// 6-digit PIN input with auto-focus, countdown timer,
/// WhatsApp resend, and success animation.
class OtpScreen extends StatelessWidget {
  const OtpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final phone = ModalRoute.of(context)?.settings.arguments as String? ?? '';

    return ChangeNotifierProvider(
      create: (_) => OtpViewModel(phone: phone),
      child: const _OtpScreenContent(),
    );
  }
}

class _OtpScreenContent extends StatelessWidget {
  const _OtpScreenContent();

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<OtpViewModel>();

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: AppColors.warmBackgroundGradient,
        ),
        child: SafeArea(
          child: CenteredContent(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: viewModel.isVerified
                  ? _buildSuccessView(context)
                  : _buildOtpForm(context),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOtpForm(BuildContext context) {
    final viewModel = context.watch<OtpViewModel>();

    return Column(
      children: [
        // ─── WhatsApp Icon ──────────────────────────────────
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: AppColors.whatsapp.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.chat_rounded,
            size: 40,
            color: AppColors.whatsapp,
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

        const SizedBox(height: 24),

        // ─── Title ────────────────────────────────────────────
        Text('Verify Your Number', style: AppTextStyles.headlineLarge)
            .animate()
            .fadeIn(delay: 200.ms, duration: 400.ms),

        const SizedBox(height: 8),

        Text(
          'We\'ve sent a ${AppConstants.otpLength}-digit OTP to your WhatsApp',
          style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
          textAlign: TextAlign.center,
        ).animate().fadeIn(delay: 300.ms, duration: 400.ms),

        const SizedBox(height: 4),

        // Phone number display
        Text(
          viewModel.formattedPhone,
          style: AppTextStyles.titleMedium.copyWith(
            color: AppColors.primary,
            fontWeight: FontWeight.w700,
          ),
        ).animate().fadeIn(delay: 400.ms, duration: 400.ms),

        const SizedBox(height: 36),

        // ─── OTP Card ─────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.85),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: Colors.white.withOpacity(0.6),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.shadow,
                blurRadius: 30,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            children: [
              // ─── PIN Input ──────────────────────────────────
              PinCodeTextField(
                appContext: context,
                length: AppConstants.otpLength,
                onChanged: viewModel.updateOtp,
                onCompleted: (_) {},
                animationType: AnimationType.scale,
                pinTheme: PinTheme(
                  shape: PinCodeFieldShape.box,
                  borderRadius: BorderRadius.circular(12),
                  fieldHeight: 56,
                  fieldWidth: 46,
                  activeFillColor: AppColors.primarySurface,
                  inactiveFillColor: AppColors.surface,
                  selectedFillColor: AppColors.primarySurface,
                  activeColor: AppColors.primary,
                  inactiveColor: AppColors.border,
                  selectedColor: AppColors.primaryDark,
                  borderWidth: 1.5,
                ),
                textStyle: AppTextStyles.headlineMedium.copyWith(
                  color: AppColors.textPrimary,
                ),
                enableActiveFill: true,
                keyboardType: TextInputType.number,
                animationDuration: const Duration(milliseconds: 200),
                cursorColor: AppColors.primary,
              ),

              // ─── Error Message ──────────────────────────────
              if (viewModel.errorMessage != null) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.error.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded,
                          color: AppColors.error, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          viewModel.errorMessage!,
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.error,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 24),

              // ─── Verify Button ──────────────────────────────
              GradientButton(
                text: 'Verify OTP',
                isLoading: viewModel.isLoading,
                icon: Icons.verified_rounded,
                onPressed: viewModel.isLoading
                    ? null
                    : () async {
                        final route = await viewModel.verifyOtp();
                        if (route != null && context.mounted) {
                          Navigator.of(context).pushNamedAndRemoveUntil(
                            route,
                            (route) => false,
                          );
                        }
                      },
              ),

              const SizedBox(height: 20),

              // ─── Resend Section ─────────────────────────────
              if (viewModel.canResend)
                TextButton.icon(
                  onPressed: viewModel.resendOtp,
                  icon: Icon(Icons.chat_rounded, color: AppColors.whatsapp, size: 18),
                  label: Text(
                    'Resend OTP via WhatsApp',
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: AppColors.whatsapp,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                )
              else
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Resend OTP in ',
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppColors.textTertiary,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primarySurface,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        viewModel.timerText,
                        style: AppTextStyles.labelLarge.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        )
            .animate()
            .fadeIn(delay: 500.ms, duration: 500.ms)
            .slideY(begin: 0.1, end: 0, delay: 500.ms, duration: 500.ms),

        const SizedBox(height: 24),

        // ─── Back to Login ────────────────────────────────────
        TextButton.icon(
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back_ios_rounded, size: 16),
          label: Text(
            'Back to Sign Up',
            style: AppTextStyles.bodyMedium.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ).animate().fadeIn(delay: 700.ms, duration: 400.ms),
      ],
    );
  }

  Widget _buildSuccessView(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 100,
          height: 100,
          decoration: BoxDecoration(
            color: AppColors.successLight,
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.check_circle_rounded,
            size: 60,
            color: AppColors.success,
          ),
        )
            .animate()
            .scale(
              begin: const Offset(0, 0),
              end: const Offset(1, 1),
              duration: 600.ms,
              curve: Curves.elasticOut,
            ),

        const SizedBox(height: 24),

        Text(
          'Verified Successfully!',
          style: AppTextStyles.headlineLarge.copyWith(color: AppColors.success),
        ).animate().fadeIn(delay: 400.ms, duration: 400.ms),

        const SizedBox(height: 8),

        Text(
          'Your phone number has been verified.\nRedirecting you...',
          style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
          textAlign: TextAlign.center,
        ).animate().fadeIn(delay: 600.ms, duration: 400.ms),
      ],
    );
  }
}
