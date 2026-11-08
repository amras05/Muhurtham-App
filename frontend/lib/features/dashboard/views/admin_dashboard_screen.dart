import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/enums/user_role.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/widgets/custom_app_bar.dart';
import '../viewmodels/admin_dashboard_viewmodel.dart';
import 'widgets/dashboard_drawer.dart';
import 'widgets/stats_card.dart';
import 'widgets/user_card.dart';

/// Admin Dashboard Screen
///
/// Shows all registered users with search/filter, role badges,
/// and basic statistics. Accessible by admin role.
class AdminDashboardScreen extends StatelessWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AdminDashboardViewModel()..loadDashboard(),
      child: const _AdminDashboardContent(),
    );
  }
}

class _AdminDashboardContent extends StatelessWidget {
  const _AdminDashboardContent();

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<AdminDashboardViewModel>();

    return Scaffold(
      appBar: CustomAppBar(
        title: 'Admin Dashboard',
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: viewModel.refresh,
          ),
        ],
      ),
      drawer: DashboardDrawer(
        userRole: UserRole.admin,
        userName: 'Admin',
        onItemSelected: (index) {
          Navigator.of(context).pop();
          if (index == 10) Navigator.of(context).pushNamed('/profile');
        },
        onLogout: () => _logout(context),
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: AppColors.warmBackgroundGradient,
        ),
        child: RefreshIndicator(
          onRefresh: viewModel.refresh,
          color: AppColors.primary,
          child: CustomScrollView(
            slivers: [
              // ─── Stats Section ────────────────────────────
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverToBoxAdapter(
                  child: _buildStatsGrid(viewModel),
                ),
              ),

              // ─── Search Bar ───────────────────────────────
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverToBoxAdapter(
                  child: _buildSearchBar(context, viewModel),
                ),
              ),

              // ─── Role Filter Chips ────────────────────────
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                sliver: SliverToBoxAdapter(
                  child: _buildFilterChips(viewModel),
                ),
              ),

              // ─── User Count ───────────────────────────────
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                sliver: SliverToBoxAdapter(
                  child: Text(
                    '${viewModel.users.length} user${viewModel.users.length != 1 ? 's' : ''} found',
                    style: AppTextStyles.labelMedium,
                  ),
                ),
              ),

              // ─── Users List / Loading / Error ─────────────
              if (viewModel.isLoading)
                const SliverFillRemaining(
                  child: Center(
                    child: CircularProgressIndicator(
                      color: AppColors.primary,
                    ),
                  ),
                )
              else if (viewModel.errorMessage != null)
                SliverFillRemaining(
                  child: _buildErrorView(viewModel),
                )
              else if (viewModel.users.isEmpty)
                SliverFillRemaining(
                  child: _buildEmptyView(),
                )
              else
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      return UserCard(user: viewModel.users[index])
                          .animate()
                          .fadeIn(
                            delay: Duration(milliseconds: 50 * index),
                            duration: 300.ms,
                          )
                          .slideX(begin: 0.05, end: 0);
                    },
                    childCount: viewModel.users.length,
                  ),
                ),

              // Bottom padding
              const SliverPadding(padding: EdgeInsets.only(bottom: 20)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatsGrid(AdminDashboardViewModel viewModel) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 600 ? 4 : 2;
        return GridView.count(
          crossAxisCount: crossAxisCount,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.4,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            StatsCard(
              label: 'Total Users',
              value: '${viewModel.totalUsers}',
              icon: Icons.people_rounded,
              iconColor: AppColors.primary,
            ),
            StatsCard(
              label: 'Active Users',
              value: '${viewModel.activeUsers}',
              icon: Icons.person_pin_rounded,
              iconColor: AppColors.success,
            ),
            StatsCard(
              label: 'Verified',
              value: '${viewModel.verifiedUsers}',
              icon: Icons.verified_rounded,
              iconColor: AppColors.info,
            ),
            StatsCard(
              label: 'Admins',
              value: '${viewModel.adminCount}',
              icon: Icons.admin_panel_settings_rounded,
              iconColor: AppColors.roleAdmin,
            ),
          ]
              .animate(interval: 100.ms)
              .fadeIn(duration: 400.ms)
              .scale(begin: const Offset(0.9, 0.9), end: const Offset(1, 1)),
        );
      },
    );
  }

  Widget _buildSearchBar(BuildContext context, AdminDashboardViewModel viewModel) {
    return TextField(
      onChanged: viewModel.updateSearch,
      style: AppTextStyles.bodyMedium,
      decoration: InputDecoration(
        hintText: 'Search by name or phone number...',
        prefixIcon: const Icon(Icons.search_rounded),
        suffixIcon: viewModel.searchQuery.isNotEmpty
            ? IconButton(
                icon: const Icon(Icons.clear_rounded, size: 20),
                onPressed: () {
                  viewModel.updateSearch('');
                },
              )
            : null,
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppColors.border),
        ),
      ),
    );
  }

  Widget _buildFilterChips(AdminDashboardViewModel viewModel) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _buildChip(
            label: 'All',
            isSelected: viewModel.roleFilter == null,
            onTap: () => viewModel.updateRoleFilter(null),
          ),
          const SizedBox(width: 8),
          _buildChip(
            label: 'Users',
            isSelected: viewModel.roleFilter == UserRole.user,
            onTap: () => viewModel.updateRoleFilter(UserRole.user),
            color: AppColors.roleUser,
          ),
          const SizedBox(width: 8),
          _buildChip(
            label: 'Admins',
            isSelected: viewModel.roleFilter == UserRole.admin,
            onTap: () => viewModel.updateRoleFilter(UserRole.admin),
            color: AppColors.roleAdmin,
          ),
          const SizedBox(width: 8),
          _buildChip(
            label: 'Super Admins',
            isSelected: viewModel.roleFilter == UserRole.superAdmin,
            onTap: () => viewModel.updateRoleFilter(UserRole.superAdmin),
            color: AppColors.roleSuperAdmin,
          ),
        ],
      ),
    );
  }

  Widget _buildChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
    Color? color,
  }) {
    final effectiveColor = color ?? AppColors.primary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? effectiveColor : effectiveColor.withOpacity(0.08),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? effectiveColor : effectiveColor.withOpacity(0.2),
          ),
        ),
        child: Text(
          label,
          style: AppTextStyles.labelMedium.copyWith(
            color: isSelected ? Colors.white : effectiveColor,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _buildErrorView(AdminDashboardViewModel viewModel) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
          const SizedBox(height: 16),
          Text(viewModel.errorMessage!, style: AppTextStyles.bodyMedium),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: viewModel.refresh,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyView() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.people_outline_rounded,
              size: 64, color: AppColors.textTertiary),
          const SizedBox(height: 16),
          Text('No users found', style: AppTextStyles.headlineSmall),
          const SizedBox(height: 8),
          Text(
            'Try adjusting your search or filters',
            style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textTertiary),
          ),
        ],
      ),
    );
  }

  Future<void> _logout(BuildContext context) async {
    await ApiClient().logout();
    if (context.mounted) {
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
    }
  }
}
