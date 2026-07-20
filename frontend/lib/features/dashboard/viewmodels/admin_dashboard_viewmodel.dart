import 'package:flutter/material.dart';
import '../../../core/enums/user_role.dart';
import '../models/user_info_model.dart';
import '../repositories/dashboard_repository.dart';

/// ViewModel for the Admin Dashboard.
///
/// Fetches and manages the list of all users, search/filter,
/// and basic statistics. Used by both Admin and SuperAdmin screens.
class AdminDashboardViewModel extends ChangeNotifier {
  final DashboardRepository _repository = DashboardRepository();

  // ─── State ────────────────────────────────────────────────
  List<UserInfoModel> _users = [];
  List<UserInfoModel> _filteredUsers = [];
  Map<String, dynamic> _stats = {};
  bool _isLoading = false;
  bool _isLoadingStats = false;
  String? _errorMessage;
  String _searchQuery = '';
  UserRole? _roleFilter;

  List<UserInfoModel> get users => _filteredUsers;
  Map<String, dynamic> get stats => _stats;
  bool get isLoading => _isLoading;
  bool get isLoadingStats => _isLoadingStats;
  String? get errorMessage => _errorMessage;
  String get searchQuery => _searchQuery;
  UserRole? get roleFilter => _roleFilter;

  // ─── Computed Stats ───────────────────────────────────────
  int get totalUsers => _users.length;
  int get activeUsers => _users.where((u) => u.isActive).length;
  int get verifiedUsers => _users.where((u) => u.isVerified).length;
  int get adminCount => _users.where((u) => u.role.isAdmin).length;

  // ─── Init ─────────────────────────────────────────────────

  Future<void> loadDashboard() async {
    await Future.wait([
      fetchUsers(),
      fetchStats(),
    ]);
  }

  // ─── Fetch Users ──────────────────────────────────────────

  Future<void> fetchUsers() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _repository.getUsers();

      if (response.success && response.data != null) {
        _users = response.data!;
        _applyFilters();
      } else {
        _errorMessage = response.message ?? 'Failed to load users.';
      }
    } catch (e) {
      _errorMessage = 'An unexpected error occurred.';
    }

    _isLoading = false;
    notifyListeners();
  }

  // ─── Fetch Stats ──────────────────────────────────────────

  Future<void> fetchStats() async {
    _isLoadingStats = true;
    notifyListeners();

    try {
      final response = await _repository.getStats();

      if (response.success && response.data != null) {
        _stats = response.data!;
      }
    } catch (_) {
      // Stats are non-critical — silently fail
    }

    _isLoadingStats = false;
    notifyListeners();
  }

  // ─── Search & Filter ─────────────────────────────────────

  void updateSearch(String query) {
    _searchQuery = query;
    _applyFilters();
    notifyListeners();
  }

  void updateRoleFilter(UserRole? role) {
    _roleFilter = role;
    _applyFilters();
    notifyListeners();
  }

  void clearFilters() {
    _searchQuery = '';
    _roleFilter = null;
    _applyFilters();
    notifyListeners();
  }

  void _applyFilters() {
    _filteredUsers = _users.where((user) {
      // Search filter
      if (_searchQuery.isNotEmpty) {
        final query = _searchQuery.toLowerCase();
        final matchesPhone = user.phone.contains(query);
        final matchesName =
            user.name?.toLowerCase().contains(query) ?? false;
        if (!matchesPhone && !matchesName) return false;
      }

      // Role filter
      if (_roleFilter != null && user.role != _roleFilter) return false;

      return true;
    }).toList();
  }

  // ─── Refresh ──────────────────────────────────────────────

  Future<void> refresh() async {
    await loadDashboard();
  }
}
