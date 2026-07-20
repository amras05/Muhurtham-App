import 'package:flutter/material.dart';
import '../../../core/enums/user_role.dart';
import '../../../core/storage/local_storage.dart';
import '../../../core/utils/validators.dart';
import '../models/login_request.dart';
import '../models/user_model.dart';
import '../repositories/auth_repository.dart';

/// ViewModel for the Login screen.
///
/// Manages form state, validation, API calls, and role-based navigation.
class LoginViewModel extends ChangeNotifier {
  final AuthRepository _repository = AuthRepository();
  final LocalStorage _storage = LocalStorage();

  // ─── Form Controllers ─────────────────────────────────────
  final TextEditingController phoneController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  final GlobalKey<FormState> formKey = GlobalKey<FormState>();

  // ─── State ────────────────────────────────────────────────
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;
  UserModel? _user;

  bool get isLoading => _isLoading;
  bool get obscurePassword => _obscurePassword;
  String? get errorMessage => _errorMessage;
  UserModel? get user => _user;

  // ─── Actions ──────────────────────────────────────────────

  void togglePasswordVisibility() {
    _obscurePassword = !_obscurePassword;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  /// Validate and submit login.
  /// Returns the route to navigate to based on user role, or null on failure.
  Future<String?> login() async {
    if (!formKey.currentState!.validate()) return null;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final request = LoginRequest(
        phone: Validators.cleanPhone(phoneController.text),
        password: passwordController.text,
      );

      final response = await _repository.login(request);

      if (response.success && response.data != null) {
        final data = response.data!;

        // Save auth token
        final token = data['token'] as String? ?? data['access_token'] as String?;
        if (token != null) {
          await _storage.saveToken(token);
        }

        // Save refresh token if available
        final refreshToken = data['refresh_token'] as String?;
        if (refreshToken != null) {
          await _storage.saveRefreshToken(refreshToken);
        }

        // Parse and save user data
        final userData = data['user'] as Map<String, dynamic>?;
        if (userData != null) {
          _user = UserModel.fromJson(userData);
          await _storage.saveUserData(userData);
          await _storage.saveUserRole(_user!.role.value);
        }

        await _storage.setLoggedIn(true);

        _isLoading = false;
        notifyListeners();

        // Return route based on role
        return _getRouteForRole(_user?.role ?? UserRole.user);
      } else {
        _errorMessage = response.message ?? 'Login failed. Please try again.';
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
    phoneController.dispose();
    passwordController.dispose();
    super.dispose();
  }
}
