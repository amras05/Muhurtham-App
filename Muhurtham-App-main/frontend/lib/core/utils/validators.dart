import '../constants/app_constants.dart';

/// Form validation utilities for the Muhurtham app.
///
/// Validates Indian phone numbers (10 digits), passwords,
/// and OTP codes with user-friendly error messages.
class Validators {
  Validators._();

  /// Validates an Indian mobile number (10 digits, starts with 6-9).
  static String? validatePhone(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Please enter your mobile number';
    }

    // Strip spaces, dashes, country code prefix
    final cleaned = value.replaceAll(RegExp(r'[\s\-\+]'), '');
    final digits = cleaned.startsWith('91') && cleaned.length > 10
        ? cleaned.substring(cleaned.length - 10)
        : cleaned;

    if (digits.length != AppConstants.phoneNumberLength) {
      return 'Mobile number must be ${AppConstants.phoneNumberLength} digits';
    }

    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(digits)) {
      return 'Please enter a valid Indian mobile number';
    }

    return null;
  }

  /// Validates password strength.
  /// Min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit.
  static String? validatePassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Please enter your password';
    }

    if (value.length < AppConstants.minPasswordLength) {
      return 'Password must be at least ${AppConstants.minPasswordLength} characters';
    }

    if (!RegExp(r'[A-Z]').hasMatch(value)) {
      return 'Password must contain at least one uppercase letter';
    }

    if (!RegExp(r'[a-z]').hasMatch(value)) {
      return 'Password must contain at least one lowercase letter';
    }

    if (!RegExp(r'[0-9]').hasMatch(value)) {
      return 'Password must contain at least one number';
    }

    return null;
  }

  /// Validates confirm password matches the original.
  static String? validateConfirmPassword(String? value, String password) {
    if (value == null || value.isEmpty) {
      return 'Please confirm your password';
    }

    if (value != password) {
      return 'Passwords do not match';
    }

    return null;
  }

  /// Validates OTP code (6 digits).
  static String? validateOtp(String? value) {
    if (value == null || value.isEmpty) {
      return 'Please enter the OTP code';
    }

    if (value.length != AppConstants.otpLength) {
      return 'OTP must be ${AppConstants.otpLength} digits';
    }

    if (!RegExp(r'^\d+$').hasMatch(value)) {
      return 'OTP must contain only digits';
    }

    return null;
  }

  /// Validates a name field (non-empty, min 2 chars).
  static String? validateName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Please enter your name';
    }

    if (value.trim().length < 2) {
      return 'Name must be at least 2 characters';
    }

    return null;
  }

  /// Extracts clean 10-digit phone from any input format.
  static String cleanPhone(String phone) {
    final cleaned = phone.replaceAll(RegExp(r'[\s\-\+\(\)]'), '');
    if (cleaned.startsWith('91') && cleaned.length > 10) {
      return cleaned.substring(cleaned.length - 10);
    }
    return cleaned;
  }
}
