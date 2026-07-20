import '../../../core/enums/user_role.dart';

/// Extended user info model for admin dashboards.
///
/// Contains additional fields beyond the basic UserModel
/// that admins need to see (login count, status, etc.).
class UserInfoModel {
  final String id;
  final String phone;
  final String? name;
  final UserRole role;
  final bool isVerified;
  final bool isActive;
  final DateTime createdAt;
  final DateTime? lastLoginAt;
  final int loginCount;

  UserInfoModel({
    required this.id,
    required this.phone,
    this.name,
    required this.role,
    this.isVerified = false,
    this.isActive = true,
    required this.createdAt,
    this.lastLoginAt,
    this.loginCount = 0,
  });

  factory UserInfoModel.fromJson(Map<String, dynamic> json) {
    return UserInfoModel(
      id: json['id'] as String,
      phone: json['phone'] as String,
      name: json['name'] as String?,
      role: UserRole.fromString(json['role'] as String? ?? 'user'),
      isVerified: json['is_verified'] as bool? ?? false,
      isActive: json['is_active'] as bool? ?? true,
      createdAt: DateTime.parse(json['created_at'] as String),
      lastLoginAt: json['last_login_at'] != null
          ? DateTime.parse(json['last_login_at'] as String)
          : null,
      loginCount: json['login_count'] as int? ?? 0,
    );
  }

  /// User initials for avatar display.
  String get initials {
    if (name == null || name!.isEmpty) return phone.substring(phone.length - 2);
    final parts = name!.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
  }

  /// Formatted phone for display.
  String get displayPhone => '+91 ${phone.substring(0, 5)} ${phone.substring(5)}';
}
