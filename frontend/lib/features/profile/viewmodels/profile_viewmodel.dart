import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/local_storage.dart';
import '../../auth/models/user_model.dart';

/// ViewModel for User Profile.
///
/// Handles displaying user details and updating user's name.
class ProfileViewModel extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();
  final LocalStorage _storage = LocalStorage();

  // ─── Form Controllers ─────────────────────────────────────
  final TextEditingController nameController = TextEditingController();
  final GlobalKey<FormState> formKey = GlobalKey<FormState>();

  // ─── State ────────────────────────────────────────────────
  UserModel? _user;
  bool _isLoading = false;
  bool _isSaving = false;
  String? _errorMessage;
  String? _successMessage;

  UserModel? get user => _user;
  bool get isLoading => _isLoading;
  bool get isSaving => _isSaving;
  String? get errorMessage => _errorMessage;
  String? get successMessage => _successMessage;

  // ─── Load Profile ─────────────────────────────────────────

  Future<void> loadProfile() async {
    _isLoading = true;
    _errorMessage = null;
    _successMessage = null;
    notifyListeners();

    try {
      // First try to load from local storage
      final localData = await _storage.getUserData();
      if (localData != null) {
        _user = UserModel.fromJson(localData);
        nameController.text = _user?.name ?? '';
        notifyListeners();
      }

      // Then fetch latest from API
      final response = await _apiClient.get(ApiConstants.userProfile);
      if (response.statusCode == 200 && response.data != null) {
        final userData = response.data as Map<String, dynamic>;
        _user = UserModel.fromJson(userData);
        await _storage.saveUserData(userData);
        nameController.text = _user?.name ?? '';
      }
    } on DioException catch (_) {
      // If offline/server issue, fall back silently since we have local data
      if (_user == null) {
        _errorMessage = 'Failed to load profile. Please check connection.';
      }
    } catch (_) {
      _errorMessage = 'An error occurred loading profile details.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ─── Save Profile ─────────────────────────────────────────

  Future<bool> saveProfile() async {
    if (!formKey.currentState!.validate()) return false;

    _isSaving = true;
    _errorMessage = null;
    _successMessage = null;
    notifyListeners();

    try {
      final updatedName = nameController.text.trim();
      final response = await _apiClient.put(
        ApiConstants.updateProfile,
        data: {'name': updatedName},
      );

      if (response.statusCode == 200 && response.data != null) {
        final userData = response.data as Map<String, dynamic>;
        _user = UserModel.fromJson(userData);
        await _storage.saveUserData(userData);
        _successMessage = 'Profile updated successfully!';
        _isSaving = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = 'Failed to update profile. Please try again.';
        _isSaving = false;
        notifyListeners();
        return false;
      }
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map<String, dynamic>) {
        _errorMessage = data['detail'] as String? ?? 'Failed to update profile.';
      } else {
        _errorMessage = 'Network error. Please try again.';
      }
      _isSaving = false;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'An error occurred saving changes.';
      _isSaving = false;
      notifyListeners();
      return false;
    }
  }

  void clearMessages() {
    _errorMessage = null;
    _successMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    nameController.dispose();
    super.dispose();
  }
}
