import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/app_constants.dart';

/// SharedPreferences wrapper for persisting auth tokens,
/// user data, and app settings locally.
class LocalStorage {
  static LocalStorage? _instance;
  SharedPreferences? _prefs;

  factory LocalStorage() {
    _instance ??= LocalStorage._internal();
    return _instance!;
  }

  LocalStorage._internal();

  Future<SharedPreferences> get _preferences async {
    _prefs ??= await SharedPreferences.getInstance();
    return _prefs!;
  }

  // ─── Auth Token ─────────────────────────────────────────
  Future<void> saveToken(String token) async {
    final prefs = await _preferences;
    await prefs.setString(AppConstants.tokenKey, token);
  }

  Future<String?> getToken() async {
    final prefs = await _preferences;
    return prefs.getString(AppConstants.tokenKey);
  }

  Future<void> saveRefreshToken(String token) async {
    final prefs = await _preferences;
    await prefs.setString(AppConstants.refreshTokenKey, token);
  }

  Future<String?> getRefreshToken() async {
    final prefs = await _preferences;
    return prefs.getString(AppConstants.refreshTokenKey);
  }

  // ─── User Data ──────────────────────────────────────────
  Future<void> saveUserData(Map<String, dynamic> userData) async {
    final prefs = await _preferences;
    await prefs.setString(AppConstants.userDataKey, jsonEncode(userData));
  }

  Future<Map<String, dynamic>?> getUserData() async {
    final prefs = await _preferences;
    final data = prefs.getString(AppConstants.userDataKey);
    if (data != null) {
      return jsonDecode(data) as Map<String, dynamic>;
    }
    return null;
  }

  // ─── User Role ──────────────────────────────────────────
  Future<void> saveUserRole(String role) async {
    final prefs = await _preferences;
    await prefs.setString(AppConstants.userRoleKey, role);
  }

  Future<String?> getUserRole() async {
    final prefs = await _preferences;
    return prefs.getString(AppConstants.userRoleKey);
  }

  // ─── Login State ────────────────────────────────────────
  Future<void> setLoggedIn(bool value) async {
    final prefs = await _preferences;
    await prefs.setBool(AppConstants.isLoggedInKey, value);
  }

  Future<bool> isLoggedIn() async {
    final prefs = await _preferences;
    return prefs.getBool(AppConstants.isLoggedInKey) ?? false;
  }

  // ─── Clear All ──────────────────────────────────────────
  Future<void> clearAll() async {
    final prefs = await _preferences;
    await prefs.remove(AppConstants.tokenKey);
    await prefs.remove(AppConstants.refreshTokenKey);
    await prefs.remove(AppConstants.userDataKey);
    await prefs.remove(AppConstants.userRoleKey);
    await prefs.remove(AppConstants.isLoggedInKey);
  }
}
