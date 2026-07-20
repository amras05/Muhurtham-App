import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/utils/snackbar_utils.dart';
import '../../../core/utils/validators.dart';
import '../../../shared/widgets/responsive_layout.dart';
import '../viewmodels/signup_viewmodel.dart';
import 'widgets/auth_header.dart';
import 'widgets/gradient_button.dart';
import 'widgets/phone_input_field.dart';

/// Signup Screen
///
/// Registration form with phone number, password, confirm password.
/// Includes real-time password strength indicator.
/// On success, navigates to OTP verification screen.
class SignupScreen extends StatelessWidget {
  const SignupScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => SignupViewModel(),
      child: const _SignupScreenContent(),
    );
  }
}

class _SignupScreenContent extends StatelessWidget {
  const _SignupScreenContent();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: AppColors.warmBackgroundGradient,
        ),
        child: SafeArea(
          child: CenteredContent(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Column(
                children: [
                  // ─── Branding Header ────────────────────────
                  const AuthHeader(compact: true),

                  const SizedBox(height: 32),

                  // ─── Signup Card ────────────────────────────
                  _buildSignupCard(context)
                      .animate()
                      .fadeIn(delay: 400.ms, duration: 500.ms)
                      .slideY(begin: 0.1, end: 0, delay: 400.ms, duration: 500.ms),

                  const SizedBox(height: 24),

                  // ─── Login Link ─────────────────────────────
                  _buildLoginLink(context)
                      .animate()
                      .fadeIn(delay: 600.ms, duration: 400.ms),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSignupCard(BuildContext context) {
    final viewModel = context.watch<SignupViewModel>();

    return Container(
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
      child: Form(
        key: viewModel.formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title
            Text('Create Account', style: AppTextStyles.headlineLarge),
            const SizedBox(height: 4),
            Text(
              'Join Muhurtham to discover auspicious timings',
              style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
            ),

            const SizedBox(height: 28),

            // ─── Phone Field ──────────────────────────────────
            Text('Mobile Number', style: AppTextStyles.labelLarge),
            const SizedBox(height: 8),
            PhoneInputField(
              controller: viewModel.phoneController,
              validator: Validators.validatePhone,
            ),

            const SizedBox(height: 20),

            // ─── Password Field ───────────────────────────────
            Text('Password', style: AppTextStyles.labelLarge),
            const SizedBox(height: 8),
            TextFormField(
              controller: viewModel.passwordController,
              obscureText: viewModel.obscurePassword,
              validator: Validators.validatePassword,
              onChanged: viewModel.updatePasswordStrength,
              style: AppTextStyles.bodyLarge,
              decoration: InputDecoration(
                hintText: 'Create a strong password',
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  icon: Icon(
                    viewModel.obscurePassword
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded,
                    color: AppColors.textTertiary,
                  ),
                  onPressed: viewModel.togglePasswordVisibility,
                ),
              ),
            ),

            // ─── Password Strength Indicator ──────────────────
            if (viewModel.passwordStrength > 0) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: viewModel.passwordStrength,
                        backgroundColor: AppColors.border,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          viewModel.passwordStrengthColor,
                        ),
                        minHeight: 4,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    viewModel.passwordStrengthLabel,
                    style: AppTextStyles.labelSmall.copyWith(
                      color: viewModel.passwordStrengthColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],

            const SizedBox(height: 20),

            // ─── Confirm Password Field ───────────────────────
            Text('Confirm Password', style: AppTextStyles.labelLarge),
            const SizedBox(height: 8),
            TextFormField(
              controller: viewModel.confirmPasswordController,
              obscureText: viewModel.obscureConfirmPassword,
              validator: (value) => Validators.validateConfirmPassword(
                value,
                viewModel.passwordController.text,
              ),
              style: AppTextStyles.bodyLarge,
              decoration: InputDecoration(
                hintText: 'Re-enter your password',
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  icon: Icon(
                    viewModel.obscureConfirmPassword
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded,
                    color: AppColors.textTertiary,
                  ),
                  onPressed: viewModel.toggleConfirmPasswordVisibility,
                ),
              ),
            ),

            // ─── Error Message ────────────────────────────────
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
                        style: AppTextStyles.bodySmall.copyWith(color: AppColors.error),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 28),

            // ─── WhatsApp OTP Notice ──────────────────────────
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.whatsapp.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.whatsapp.withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  Icon(Icons.chat_rounded, color: AppColors.whatsapp, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'An OTP will be sent to your WhatsApp for verification',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppColors.whatsappDark,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ─── Signup Button ────────────────────────────────
            GradientButton(
              text: 'Send OTP',
              isLoading: viewModel.isLoading,
              icon: Icons.send_rounded,
              onPressed: viewModel.isLoading
                  ? null
                  : () async {
                      final phone = await viewModel.signup();
                      if (phone != null && context.mounted) {
                        Navigator.of(context).pushNamed(
                          '/otp',
                          arguments: phone,
                        );
                      }
                    },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoginLink(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'Already have an account? ',
          style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
        GestureDetector(
          onTap: () => Navigator.of(context).pop(),
          child: Text(
            'Sign In',
            style: AppTextStyles.bodyMedium.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w700,
              decoration: TextDecoration.underline,
              decorationColor: AppColors.primary,
            ),
          ),
        ),
      ],
    );
  }
}
