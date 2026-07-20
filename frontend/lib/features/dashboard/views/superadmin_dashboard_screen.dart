import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/enums/user_role.dart';
import '../../../core/storage/local_storage.dart';
import '../viewmodels/superadmin_dashboard_viewmodel.dart';
import 'widgets/dashboard_drawer.dart';
import 'widgets/log_tile.dart';
import 'widgets/stats_card.dart';
import 'widgets/user_card.dart';

/// SuperAdmin Dashboard Screen
///
/// Full admin view with users list, activity logs, and system stats.
/// Tabbed interface: Overview | Users | Activity Logs.
/// Only accessible by super_admin role.
class SuperAdminDashboardScreen extends StatelessWidget {
  const SuperAdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => SuperAdminDashboardViewModel()..loadDashboard(),
      child: const _SuperAdminDashboardContent(),
    );
  }
}

class _SuperAdminDashboardContent extends StatelessWidget {
  const _SuperAdminDashboardContent();

  @override
  Widget build(BuildContext context) {
    final viewModel = context.watch<SuperAdminDashboardViewModel>();

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text('Super Admin', style: AppTextStyles.appBarTitle),
          centerTitle: true,
          flexibleSpace: Container(
            decoration: const BoxDecoration(gradient: AppColors.maroonGradient),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: viewModel.refresh,
            ),
          ],
          bottom: TabBar(
            onTap: viewModel.setSelectedTab,
            indicatorColor: AppColors.primary,
            indicatorWeight: 3,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white60,
            labelStyle: AppTextStyles.labelLarge.copyWith(color: Colors.white),
            unselectedLabelStyle: AppTextStyles.labelMedium.copyWith(color: Colors.white60),
            tabs: const [
              Tab(text: 'Overview', icon: Icon(Icons.dashboard_rounded, size: 20)),
              Tab(text: 'Users', icon: Icon(Icons.people_rounded, size: 20)),
              Tab(text: 'Logs', icon: Icon(Icons.receipt_long_rounded, size: 20)),
            ],
          ),
        ),
        drawer: DashboardDrawer(
          userRole: UserRole.superAdmin,
          userName: 'Super Admin',
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
          child: TabBarView(
            children: [
              _buildOverviewTab(viewModel),
              _buildUsersTab(viewModel),
              _buildLogsTab(viewModel),
            ],
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Overview Tab
  // ═══════════════════════════════════════════════════════════

  Widget _buildOverviewTab(SuperAdminDashboardViewModel viewModel) {
    return RefreshIndicator(
      onRefresh: viewModel.refresh,
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── Stats Grid ───────────────────────────────────
            LayoutBuilder(
              builder: (context, constraints) {
                final crossAxisCount = constraints.maxWidth > 600 ? 3 : 2;
                return GridView.count(
                  crossAxisCount: crossAxisCount,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.3,
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
                      label: 'Active',
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
                    StatsCard(
                      label: 'Super Admins',
                      value: '${viewModel.superAdminCount}',
                      icon: Icons.shield_rounded,
                      iconColor: AppColors.roleSuperAdmin,
                    ),
                    StatsCard(
                      label: 'Regular Users',
                      value: '${viewModel.regularUserCount}',
                      icon: Icons.person_rounded,
                      iconColor: AppColors.roleUser,
                    ),
                  ]
                      .animate(interval: 80.ms)
                      .fadeIn(duration: 400.ms)
                      .scale(begin: const Offset(0.9, 0.9), end: const Offset(1, 1)),
                );
              },
            ),

            const SizedBox(height: 28),

            // ─── Recent Activity ──────────────────────────────
            Text('Recent Activity', style: AppTextStyles.headlineSmall),
            const SizedBox(height: 12),

            if (viewModel.isLoadingLogs)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              )
            else if (viewModel.logs.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Center(
                  child: Column(
                    children: [
                      Icon(Icons.receipt_long_rounded,
                          size: 40, color: AppColors.textTertiary),
                      const SizedBox(height: 12),
                      Text(
                        'No activity logs yet',
                        style: AppTextStyles.bodyMedium
                            .copyWith(color: AppColors.textTertiary),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...viewModel.logs.take(10).map(
                    (log) => LogTile(log: log)
                        .animate()
                        .fadeIn(duration: 300.ms)
                        .slideX(begin: 0.05, end: 0),
                  ),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Users Tab
  // ═══════════════════════════════════════════════════════════

  Widget _buildUsersTab(SuperAdminDashboardViewModel viewModel) {
    return RefreshIndicator(
      onRefresh: viewModel.fetchUsers,
      color: AppColors.primary,
      child: Column(
        children: [
          // ─── Search Bar ─────────────────────────────────────
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              onChanged: viewModel.updateSearch,
              style: AppTextStyles.bodyMedium,
              decoration: InputDecoration(
                hintText: 'Search by name or phone...',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: viewModel.searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 20),
                        onPressed: () => viewModel.updateSearch(''),
                      )
                    : null,
              ),
            ),
          ),

          // ─── Role Filters ───────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('All', viewModel.roleFilter == null,
                      () => viewModel.updateRoleFilter(null)),
                  const SizedBox(width: 8),
                  _buildFilterChip(
                      'Users',
                      viewModel.roleFilter == UserRole.user,
                      () => viewModel.updateRoleFilter(UserRole.user),
                      AppColors.roleUser),
                  const SizedBox(width: 8),
                  _buildFilterChip(
                      'Admins',
                      viewModel.roleFilter == UserRole.admin,
                      () => viewModel.updateRoleFilter(UserRole.admin),
                      AppColors.roleAdmin),
                  const SizedBox(width: 8),
                  _buildFilterChip(
                      'Super Admins',
                      viewModel.roleFilter == UserRole.superAdmin,
                      () => viewModel.updateRoleFilter(UserRole.superAdmin),
                      AppColors.roleSuperAdmin),
                ],
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '${viewModel.users.length} user${viewModel.users.length != 1 ? 's' : ''}',
                style: AppTextStyles.labelMedium,
              ),
            ),
          ),

          // ─── User List ──────────────────────────────────────
          Expanded(
            child: viewModel.isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.primary))
                : viewModel.users.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.people_outline_rounded,
                                size: 56, color: AppColors.textTertiary),
                            const SizedBox(height: 12),
                            Text('No users found',
                                style: AppTextStyles.headlineSmall),
                          ],
                        ),
                      )
                    : ListView.builder(
                        itemCount: viewModel.users.length,
                        itemBuilder: (context, index) {
                          return UserCard(
                            user: viewModel.users[index],
                            onTap: () {
                              // Could navigate to user detail
                            },
                          )
                              .animate()
                              .fadeIn(
                                delay: Duration(milliseconds: 40 * index),
                                duration: 300.ms,
                              )
                              .slideX(begin: 0.05, end: 0);
                        },
                      ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Logs Tab
  // ═══════════════════════════════════════════════════════════

  Widget _buildLogsTab(SuperAdminDashboardViewModel viewModel) {
    return RefreshIndicator(
      onRefresh: () => viewModel.fetchLogs(),
      color: AppColors.primary,
      child: viewModel.isLoadingLogs
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : viewModel.logs.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.receipt_long_rounded,
                          size: 64, color: AppColors.textTertiary),
                      const SizedBox(height: 16),
                      Text('No activity logs', style: AppTextStyles.headlineSmall),
                      const SizedBox(height: 8),
                      Text(
                        'User activity will appear here',
                        style: AppTextStyles.bodyMedium
                            .copyWith(color: AppColors.textTertiary),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  itemCount: viewModel.logs.length,
                  itemBuilder: (context, index) {
                    return LogTile(log: viewModel.logs[index])
                        .animate()
                        .fadeIn(
                          delay: Duration(milliseconds: 30 * index),
                          duration: 300.ms,
                        );
                  },
                ),
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════════

  Widget _buildFilterChip(
      String label, bool isSelected, VoidCallback onTap,
      [Color? color]) {
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

  Future<void> _logout(BuildContext context) async {
    await LocalStorage().clearAll();
    if (context.mounted) {
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
    }
  }
}
