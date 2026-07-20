import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/storage/local_storage.dart';

/// User Home Screen — landing page for regular (non-admin) users.
///
/// Shows a welcome message, quick muhurta check placeholder,
/// and basic user info. Clean, warm, and inviting design.
class UserHomeScreen extends StatefulWidget {
  const UserHomeScreen({super.key});

  @override
  State<UserHomeScreen> createState() => _UserHomeScreenState();
}

class _UserHomeScreenState extends State<UserHomeScreen> {
  final LocalStorage _storage = LocalStorage();
  Map<String, dynamic>? _userData;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final data = await _storage.getUserData();
    if (mounted) {
      setState(() => _userData = data);
    }
  }

  Future<void> _logout() async {
    await _storage.clearAll();
    if (mounted) {
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = _userData?['name'] as String? ?? 'User';

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: AppColors.warmBackgroundGradient,
        ),
        child: SafeArea(
          child: CustomScrollView(
            slivers: [
              // ─── App Bar ──────────────────────────────────
              SliverAppBar(
                expandedHeight: 180,
                floating: false,
                pinned: true,
                backgroundColor: AppColors.secondary,
                flexibleSpace: FlexibleSpaceBar(
                  background: Container(
                    decoration: const BoxDecoration(
                      gradient: AppColors.maroonGradient,
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Text(
                            'Namaste, $name! 🙏',
                            style: AppTextStyles.headlineLarge.copyWith(
                              color: Colors.white,
                              fontSize: 26,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            AppConstants.appTagline,
                            style: AppTextStyles.bodyMedium.copyWith(
                              color: Colors.white.withOpacity(0.8),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  title: Text(
                    AppConstants.appName,
                    style: AppTextStyles.appBarTitle,
                  ),
                ),
                actions: [
                  IconButton(
                    icon: const Icon(Icons.person_outline_rounded),
                    onPressed: () =>
                        Navigator.of(context).pushNamed('/profile'),
                  ),
                  IconButton(
                    icon: const Icon(Icons.logout_rounded),
                    onPressed: () => _showLogoutDialog(),
                  ),
                ],
              ),

              // ─── Content ─────────────────────────────────
              SliverPadding(
                padding: const EdgeInsets.all(20),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    // Quick action cards
                    _buildQuickActionCard(
                      icon: Icons.search_rounded,
                      title: 'Find Muhurtham',
                      subtitle: 'Search for the next auspicious time for any activity',
                      color: AppColors.primary,
                      onTap: () {},
                    ).animate().fadeIn(delay: 200.ms).slideX(begin: -0.1, end: 0),

                    const SizedBox(height: 14),

                    _buildQuickActionCard(
                      icon: Icons.calendar_today_rounded,
                      title: 'Today\'s Panchang',
                      subtitle: 'View today\'s panchang details and recommendations',
                      color: AppColors.secondary,
                      onTap: () {},
                    ).animate().fadeIn(delay: 350.ms).slideX(begin: -0.1, end: 0),

                    const SizedBox(height: 14),

                    _buildQuickActionCard(
                      icon: Icons.auto_awesome_rounded,
                      title: 'Auspicious Activities',
                      subtitle: 'Browse all activities and their favorable timings',
                      color: AppColors.info,
                      onTap: () {},
                    ).animate().fadeIn(delay: 500.ms).slideX(begin: -0.1, end: 0),

                    const SizedBox(height: 30),

                    // Info card
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.primarySurface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: AppColors.primary.withOpacity(0.2),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.info_outline_rounded,
                            color: AppColors.primary,
                            size: 24,
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(
                              'Muhurtham features will be available soon. '
                              'Authentication is fully set up!',
                              style: AppTextStyles.bodySmall.copyWith(
                                color: AppColors.primaryDark,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ).animate().fadeIn(delay: 650.ms),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickActionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 2,
      shadowColor: AppColors.shadow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color, size: 26),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppTextStyles.titleSmall),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: AppTextStyles.bodySmall,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 16,
                color: AppColors.textTertiary,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Sign Out', style: AppTextStyles.headlineSmall),
        content: Text(
          'Are you sure you want to sign out?',
          style: AppTextStyles.bodyMedium,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _logout();
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }
}
