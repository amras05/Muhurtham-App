import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/enums/user_role.dart';
import '../../models/user_info_model.dart';

/// A card displaying user information for admin dashboards.
///
/// Shows avatar (initials), name, phone, role badge,
/// verification status, and last login time.
class UserCard extends StatelessWidget {
  final UserInfoModel user;
  final VoidCallback? onTap;

  const UserCard({
    super.key,
    required this.user,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: AppColors.borderLight, width: 0.5),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // ─── Avatar ─────────────────────────────────────
              _buildAvatar(),
              const SizedBox(width: 14),

              // ─── Info ───────────────────────────────────────
              Expanded(child: _buildInfo()),

              // ─── Status Indicators ──────────────────────────
              _buildStatusColumn(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar() {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _getRoleColor(user.role),
            _getRoleColor(user.role).withOpacity(0.7),
          ],
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: _getRoleColor(user.role).withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Center(
        child: Text(
          user.initials,
          style: AppTextStyles.titleMedium.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _buildInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Name
        Text(
          user.name ?? 'Unnamed User',
          style: AppTextStyles.titleSmall,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 2),

        // Phone
        Text(
          user.displayPhone,
          style: AppTextStyles.bodySmall.copyWith(color: AppColors.textTertiary),
        ),
        const SizedBox(height: 6),

        // Role badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: _getRoleColor(user.role).withOpacity(0.1),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            user.role.displayName,
            style: AppTextStyles.labelSmall.copyWith(
              color: _getRoleColor(user.role),
              fontWeight: FontWeight.w600,
              fontSize: 10,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatusColumn() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // Verified / Unverified
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              user.isVerified
                  ? Icons.verified_rounded
                  : Icons.pending_rounded,
              size: 14,
              color: user.isVerified ? AppColors.success : AppColors.textTertiary,
            ),
            const SizedBox(width: 4),
            Text(
              user.isVerified ? 'Verified' : 'Pending',
              style: AppTextStyles.labelSmall.copyWith(
                color: user.isVerified ? AppColors.success : AppColors.textTertiary,
                fontSize: 10,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),

        // Last login
        if (user.lastLoginAt != null)
          Text(
            DateFormat('dd MMM, HH:mm').format(user.lastLoginAt!),
            style: AppTextStyles.labelSmall.copyWith(fontSize: 10),
          ),

        // Active/Inactive dot
        const SizedBox(height: 4),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: user.isActive ? AppColors.success : AppColors.error,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 4),
            Text(
              user.isActive ? 'Active' : 'Inactive',
              style: AppTextStyles.labelSmall.copyWith(fontSize: 10),
            ),
          ],
        ),
      ],
    );
  }

  Color _getRoleColor(UserRole role) {
    switch (role) {
      case UserRole.superAdmin:
        return AppColors.roleSuperAdmin;
      case UserRole.admin:
        return AppColors.roleAdmin;
      case UserRole.user:
        return AppColors.roleUser;
    }
  }
}
