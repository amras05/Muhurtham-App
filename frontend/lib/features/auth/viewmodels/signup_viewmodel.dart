import 'package:flutter/material.dart';
import '../../../core/utils/validators.dart';
import '../models/signup_request.dart';
import '../repositories/auth_repository.dart';

/// ViewModel for the Signup screen.
///
/// Manages form state, validation, and signup API call.
/// On success, navigates to OTP verification screen.
class SignupViewModel extends ChangeNotifier {
  final AuthRepository _repository = AuthRepository();

  // ─── Form Controllers ─────────────────────────────────────
  final TextEditingController phoneController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  final TextEditingController confirmPasswordController = TextEditingController();
  final GlobalKey<FormState> formKey = GlobalKey<FormState>();

  // ─── State ────────────────────────────────────────────────
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  String? _errorMessage;
  double _passwordStrength = 0;

  bool get isLoading => _isLoading;
  bool get obscurePassword => _obscurePassword;
  bool get obscureConfirmPassword => _obscureConfirmPassword;
  String? get errorMessage => _errorMessage;
  double get passwordStrength => _passwordStrength;

  // ─── Actions ──────────────────────────────────────────────

  void togglePasswordVisibility() {
    _obscurePassword = !_obscurePassword;
    notifyListeners();
  }

  void toggleConfirmPasswordVisibility() {
    _obscureConfirmPassword = !_obscureConfirmPassword;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  /// Update password strength indicator (0.0 – 1.0).
  void updatePasswordStrength(String password) {
    if (password.isEmpty) {
      _passwordStrength = 0;
    } else {
      double strength = 0;
      if (password.length >= 8) strength += 0.25;
      if (RegExp(r'[A-Z]').hasMatch(password)) strength += 0.25;
      if (RegExp(r'[a-z]').hasMatch(password)) strength += 0.25;
      if (RegExp(r'[0-9]').hasMatch(password)) strength += 0.15;
      if (RegExp(r'[!@#\$%\^&\*\(\)_\+\-=]').hasMatch(password)) strength += 0.10;
      _passwordStrength = strength.clamp(0.0, 1.0);
    }
    notifyListeners();
  }

  String get passwordStrengthLabel {
    if (_passwordStrength <= 0) return '';
    if (_passwordStrength < 0.3) return 'Weak';
    if (_passwordStrength < 0.6) return 'Fair';
    if (_passwordStrength < 0.85) return 'Good';
    return 'Strong';
  }

  Color get passwordStrengthColor {
    if (_passwordStrength < 0.3) return const Color(0xFFD32F2F);
    if (_passwordStrength < 0.6) return const Color(0xFFED6C02);
    if (_passwordStrength < 0.85) return const Color(0xFF0288D1);
    return const Color(0xFF2E7D32);
  }

  /// Validate and submit signup.
  /// Returns the phone number on success (for OTP screen), or null on failure.
  Future<String?> signup() async {
    if (!formKey.currentState!.validate()) return null;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final cleanedPhone = Validators.cleanPhone(phoneController.text);
      final request = SignupRequest(
        phone: cleanedPhone,
        password: passwordController.text,
        confirmPassword: confirmPasswordController.text,
      );

      final response = await _repository.signup(request);

      if (response.success) {
        _isLoading = false;
        notifyListeners();
        return cleanedPhone; // Pass phone to OTP screen
      } else {
        _errorMessage = response.message ?? 'Signup failed. Please try again.';
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

  @override
  void dispose() {
    phoneController.dispose();
    passwordController.dispose();
    confirmPasswordController.dispose();
    super.dispose();
  }
}
