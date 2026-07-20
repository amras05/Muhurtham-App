import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/utils/snackbar_utils.dart';
import '../../../core/utils/validators.dart';
import '../../../shared/widgets/responsive_layout.dart';
import '../viewmodels/login_viewmodel.dart';
import 'widgets/auth_header.dart';
import 'widgets/gradient_button.dart';
import 'widgets/phone_input_field.dart';

/// Login Screen
///
/// Elegant login form with phone number + password.
/// Features glassmorphism card, animated entrance, and role-based redirect.
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => LoginViewModel(),
      child: const _LoginScreenContent(),
    );
  }
}

class _LoginScreenContent extends StatelessWidget {
  const _LoginScreenContent();

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
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Column(
                children: [
                  // ─── Branding Header ────────────────────────
                  const AuthHeader(),

                  const SizedBox(height: 40),

                  // ─── Login Card ─────────────────────────────
                  _buildLoginCard(context)
                      .animate()
                      .fadeIn(delay: 500.ms, duration: 500.ms)
                      .slideY(begin: 0.1, end: 0, delay: 500.ms, duration: 500.ms),

                  const SizedBox(height: 24),

                  // ─── Sign Up Link ───────────────────────────
                  _buildSignUpLink(context)
                      .animate()
                      .fadeIn(delay: 700.ms, duration: 400.ms),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoginCard(BuildContext context) {
    final viewModel = context.watch<LoginViewModel>();

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
            Text('Welcome Back', style: AppTextStyles.headlineLarge),
            const SizedBox(height: 4),
            Text(
              'Sign in to continue to Muhurtham',
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
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter your password';
                }
                return null;
              },
              style: AppTextStyles.bodyLarge,
              decoration: InputDecoration(
                hintText: 'Enter your password',
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

            // ─── Login Button ─────────────────────────────────
            GradientButton(
              text: 'Sign In',
              isLoading: viewModel.isLoading,
              icon: Icons.login_rounded,
              onPressed: viewModel.isLoading
                  ? null
                  : () async {
                      final route = await viewModel.login();
                      if (route != null && context.mounted) {
                        Navigator.of(context).pushNamedAndRemoveUntil(
                          route,
                          (route) => false,
                        );
                      }
                    },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSignUpLink(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          "Don't have an account? ",
          style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
        GestureDetector(
          onTap: () => Navigator.of(context).pushNamed('/signup'),
          child: Text(
            'Sign Up',
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
