import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/utils/snackbar_utils.dart';
import '../../../core/utils/validators.dart';
import '../../../shared/widgets/custom_app_bar.dart';
import '../../../shared/widgets/loading_overlay.dart';
import '../../../shared/widgets/responsive_layout.dart';
import '../viewmodels/profile_viewmodel.dart';

/// Profile Screen
///
/// Displays user info and allows changing user's display name.
/// Utilizes MVVM viewmodel and fits Muhurtham aesthetic.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ProfileViewModel()..loadProfile(),
      child: const _ProfileScreenContent(),
    );
  }
}

class _ProfileScreenContent extends StatelessWidget {
  const _ProfileScreenContent();

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<ProfileViewModel>();

    return Scaffold(
      appBar: const CustomAppBar(
        title: 'User Profile',
        showBackButton: true,
      ),
      body: LoadingOverlay(
        isLoading: viewModel.isLoading,
        message: 'Loading details...',
        child: Container(
          decoration: const BoxDecoration(
            gradient: AppColors.warmBackgroundGradient,
          ),
          child: SafeArea(
            child: CenteredContent(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Form(
                  key: viewModel.formKey,
                  child: Column(
                    children: [
                      // Avatar placeholder
                      _buildAvatar(viewModel),

                      const SizedBox(height: 24),

                      // Profile Info Card
                      _buildProfileCard(context, viewModel),

                      const SizedBox(height: 24),

                      // Actions
                      if (!viewModel.isLoading)
                        SizedBox(
                          width: double.infinity,
                          height: 54,
                          child: ElevatedButton.icon(
                            onPressed: viewModel.isSaving
                                ? null
                                : () async {
                                    final success = await viewModel.saveProfile();
                                    if (success && context.mounted) {
                                      SnackbarUtils.showSuccess(
                                        context,
                                        viewModel.successMessage ?? 'Profile updated!',
                                      );
                                    } else if (viewModel.errorMessage != null && context.mounted) {
                                      SnackbarUtils.showError(
                                        context,
                                        viewModel.errorMessage!,
                                      );
                                    }
                                  },
                            icon: viewModel.isSaving
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                    ),
                                  )
                                : const Icon(Icons.save_rounded),
                            label: Text(
                              viewModel.isSaving ? 'Saving Changes...' : 'Save Changes',
                              style: AppTextStyles.buttonMedium,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar(ProfileViewModel viewModel) {
    final user = viewModel.user;
    final initials = user != null
        ? (user.name != null && user.name!.isNotEmpty
            ? user.name!.trim().split(' ').map((e) => e[0]).take(2).join().toUpperCase()
            : user.phone.substring(user.phone.length - 2))
        : '?';

    return Container(
      width: 90,
      height: 90,
      decoration: BoxDecoration(
        gradient: AppColors.goldSaffronGradient,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Center(
        child: Text(
          initials,
          style: AppTextStyles.displaySmall.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 28,
          ),
        ),
      ),
    );
  }

  Widget _buildProfileCard(BuildContext context, ProfileViewModel viewModel) {
    final user = viewModel.user;

    return Card(
      elevation: 2,
      shadowColor: AppColors.shadow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Account Information', style: AppTextStyles.titleMedium),
            const SizedBox(height: 20),

            // Name Input
            Text('Full Name', style: AppTextStyles.labelLarge),
            const SizedBox(height: 8),
            TextFormField(
              controller: viewModel.nameController,
              validator: Validators.validateName,
              style: AppTextStyles.bodyLarge,
              decoration: const InputDecoration(
                hintText: 'Enter your full name',
                prefixIcon: Icon(Icons.person_outline_rounded),
              ),
            ),

            const SizedBox(height: 20),

            // Phone display (disabled)
            Text('Mobile Number', style: AppTextStyles.labelLarge),
            const SizedBox(height: 8),
            TextFormField(
              initialValue: user != null ? '+91 ${user.phone}' : '',
              enabled: false,
              style: AppTextStyles.bodyLarge.copyWith(color: AppColors.textSecondary),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.phone_android_rounded),
                disabledBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: AppColors.borderLight),
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Role display & Verified Badge
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('User Role', style: AppTextStyles.labelLarge),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primarySurface,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        user?.role.displayName ?? 'User',
                        style: AppTextStyles.labelMedium.copyWith(
                          color: AppColors.primaryDark,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                if (user?.isVerified ?? false)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('Status', style: AppTextStyles.labelLarge),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.successLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.verified_rounded,
                              size: 14,
                              color: AppColors.success,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Verified',
                              style: AppTextStyles.labelMedium.copyWith(
                                color: AppColors.success,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
