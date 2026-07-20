/// Activity log entry model for SuperAdmin dashboard.
///
/// Tracks user actions like login, signup, profile updates, etc.
class ActivityLogModel {
  final String id;
  final String userId;
  final String? userName;
  final String action;
  final String? details;
  final String? ipAddress;
  final DateTime timestamp;

  ActivityLogModel({
    required this.id,
    required this.userId,
    this.userName,
    required this.action,
    this.details,
    this.ipAddress,
    required this.timestamp,
  });

  factory ActivityLogModel.fromJson(Map<String, dynamic> json) {
    return ActivityLogModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      userName: json['user_name'] as String?,
      action: json['action'] as String,
      details: json['details'] as String?,
      ipAddress: json['ip_address'] as String?,
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }

  /// Human-readable action label.
  String get actionLabel {
    switch (action) {
      case 'login':
        return 'Logged In';
      case 'signup':
        return 'Signed Up';
      case 'logout':
        return 'Logged Out';
      case 'profile_update':
        return 'Updated Profile';
      case 'otp_verify':
        return 'Verified OTP';
      case 'otp_resend':
        return 'Resent OTP';
      case 'password_change':
        return 'Changed Password';
      default:
        return action.replaceAll('_', ' ').split(' ').map((word) =>
          word.isNotEmpty ? '${word[0].toUpperCase()}${word.substring(1)}' : ''
        ).join(' ');
    }
  }

  /// Icon for this action type.
  String get actionIcon {
    switch (action) {
      case 'login':
        return '🔑';
      case 'signup':
        return '✨';
      case 'logout':
        return '🚪';
      case 'profile_update':
        return '✏️';
      case 'otp_verify':
        return '✅';
      case 'otp_resend':
        return '📨';
      case 'password_change':
        return '🔒';
      default:
        return '📋';
    }
  }
}
