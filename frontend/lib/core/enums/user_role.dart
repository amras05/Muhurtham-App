/// User roles in the Muhurtham application.
/// 
/// - [superAdmin] — Developers with full system access (users + logs)
/// - [admin] — Administrative users who can view all user info
/// - [user] — Regular app users
enum UserRole {
  superAdmin('super_admin', 'Super Admin'),
  admin('admin', 'Admin'),
  user('user', 'User');

  const UserRole(this.value, this.displayName);

  /// The value sent to/from the API (e.g. 'super_admin')
  final String value;

  /// Human-readable label for UI display
  final String displayName;

  /// Parse a role from its API string value.
  static UserRole fromString(String value) {
    return UserRole.values.firstWhere(
      (role) => role.value == value,
      orElse: () => UserRole.user,
    );
  }

  /// Whether this role has admin-level privileges.
  bool get isAdmin => this == UserRole.admin || this == UserRole.superAdmin;

  /// Whether this role has super admin privileges.
  bool get isSuperAdmin => this == UserRole.superAdmin;
}
