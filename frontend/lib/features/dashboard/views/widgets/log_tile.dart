import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../models/activity_log_model.dart';

/// A tile displaying a single activity log entry.
///
/// Shows action icon, label, user name, timestamp,
/// and optional details. Used in SuperAdmin log viewer.
class LogTile extends StatelessWidget {
  final ActivityLogModel log;
  final bool showUserName;

  const LogTile({
    super.key,
    required this.log,
    this.showUserName = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight, width: 0.5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ─── Action Icon ──────────────────────────────────
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.primarySurface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(
                log.actionIcon,
                style: const TextStyle(fontSize: 16),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // ─── Details ──────────────────────────────────────
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Action label
                Text(
                  log.actionLabel,
                  style: AppTextStyles.titleSmall,
                ),
                const SizedBox(height: 2),

                // User name
                if (showUserName && log.userName != null)
                  Text(
                    log.userName!,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),

                // Details
                if (log.details != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    log.details!,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: AppColors.textTertiary,
                      fontStyle: FontStyle.italic,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),

          // ─── Timestamp & IP ───────────────────────────────
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                DateFormat('dd MMM').format(log.timestamp),
                style: AppTextStyles.labelSmall.copyWith(fontSize: 10),
              ),
              Text(
                DateFormat('HH:mm:ss').format(log.timestamp),
                style: AppTextStyles.labelSmall.copyWith(
                  fontSize: 10,
                  color: AppColors.textTertiary,
                ),
              ),
              if (log.ipAddress != null) ...[
                const SizedBox(height: 4),
                Text(
                  log.ipAddress!,
                  style: AppTextStyles.labelSmall.copyWith(
                    fontSize: 9,
                    color: AppColors.textTertiary,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
