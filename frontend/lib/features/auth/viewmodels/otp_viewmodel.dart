import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/enums/user_role.dart';
import '../../../core/storage/local_storage.dart';
import '../models/otp_request.dart';
import '../models/user_model.dart';
import '../repositories/auth_repository.dart';

/// ViewModel for the OTP Verification screen.
///
/// Manages OTP input, countdown timer, resend functionality,
/// and verification API call.
class OtpViewModel extends ChangeNotifier {
  final AuthRepository _repository = AuthRepository();
  final LocalStorage _storage = LocalStorage();

  // ─── State ────────────────────────────────────────────────
  final String phone;
  String _otp = '';
  bool _isLoading = false;
  bool _isVerified = false;
  String? _errorMessage;
  int _resendTimer = AppConstants.otpResendTimerSeconds;
  bool _canResend = false;
  Timer? _timer;
  UserModel? _user;

  OtpViewModel({required this.phone}) {
    _startTimer();
  }

  String get otp => _otp;
  bool get isLoading => _isLoading;
  bool get isVerified => _isVerified;
  String? get errorMessage => _errorMessage;
  int get resendTimer => _resendTimer;
  bool get canResend => _canResend;
  UserModel? get user => _user;

  String get formattedPhone => '+91 ${phone.substring(0, 5)} ${phone.substring(5)}';

  String get timerText {
    final minutes = (_resendTimer ~/ 60).toString().padLeft(2, '0');
    final seconds = (_resendTimer % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  // ─── Timer ────────────────────────────────────────────────

  void _startTimer() {
    _resendTimer = AppConstants.otpResendTimerSeconds;
    _canResend = false;
    _timer?.cancel();

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendTimer > 0) {
        _resendTimer--;
        notifyListeners();
      } else {
        _canResend = true;
        timer.cancel();
        notifyListeners();
      }
    });
  }

  // ─── Actions ──────────────────────────────────────────────

  void updateOtp(String value) {
    _otp = value;
    _errorMessage = null;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  /// Verify the OTP code.
  /// Returns the route to navigate to based on user role, or null on failure.
  Future<String?> verifyOtp() async {
    if (_otp.length != AppConstants.otpLength) {
      _errorMessage = 'Please enter the complete ${AppConstants.otpLength}-digit OTP';
      notifyListeners();
      return null;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final request = OtpRequest(phone: phone, otp: _otp);
      final response = await _repository.verifyOtp(request);

      if (response.success && response.data != null) {
        final data = response.data!;

        // Save auth token
        final token = data['token'] as String? ?? data['access_token'] as String?;
        if (token != null) {
          await _storage.saveToken(token);
        }
        final refreshToken = data['refresh_token'] as String?;
        if (refreshToken != null) {
          await _storage.saveRefreshToken(refreshToken);
        }

        // Save user data
        final userData = data['user'] as Map<String, dynamic>?;
        if (userData != null) {
          _user = UserModel.fromJson(userData);
          await _storage.saveUserData(userData);
          await _storage.saveUserRole(_user!.role.value);
        }

        await _storage.setLoggedIn(true);

        _isVerified = true;
        _isLoading = false;
        notifyListeners();

        // Return route based on role
        return _getRouteForRole(_user?.role ?? UserRole.user);
      } else {
        _errorMessage = response.message ?? 'Invalid OTP. Please try again.';
        _isLoading = false;
        notifyListeners();
        return null;
      }
    } catch (e) {
      _errorMessage = 'An unexpected error occurred. Please try again.';
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  /// Resend OTP to the user's WhatsApp.
  Future<void> resendOtp() async {
    if (!_canResend) return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _repository.resendOtp(phone);

      if (response.success) {
        _startTimer();
      } else {
        _errorMessage = response.message ?? 'Failed to resend OTP.';
      }
    } catch (e) {
      _errorMessage = 'Failed to resend OTP. Please try again.';
    }

    _isLoading = false;
    notifyListeners();
  }

  String _getRouteForRole(UserRole role) {
    switch (role) {
      case UserRole.superAdmin:
        return '/superadmin';
      case UserRole.admin:
        return '/admin';
      case UserRole.user:
        return '/home';
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
