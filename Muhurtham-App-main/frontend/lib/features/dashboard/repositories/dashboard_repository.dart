import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../models/activity_log_model.dart';
import '../models/user_info_model.dart';

/// Repository for dashboard API calls.
///
/// Used by both Admin and SuperAdmin dashboards to fetch
/// user lists, statistics, and activity logs.
class DashboardRepository {
  final ApiClient _apiClient = ApiClient();

  /// Fetch all users (admin/superadmin).
  Future<ApiResponse<List<UserInfoModel>>> getUsers({
    int page = 1,
    int pageSize = 20,
    String? search,
    String? roleFilter,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'page_size': pageSize,
      };
      if (search != null && search.isNotEmpty) queryParams['search'] = search;
      if (roleFilter != null && roleFilter.isNotEmpty) queryParams['role'] = roleFilter;

      final response = await _apiClient.get(
        ApiConstants.adminUsers,
        queryParameters: queryParams,
      );

      final data = response.data;
      List<UserInfoModel> users;

      if (data is Map<String, dynamic> && data.containsKey('users')) {
        users = (data['users'] as List)
            .map((json) => UserInfoModel.fromJson(json as Map<String, dynamic>))
            .toList();
      } else if (data is List) {
        users = data
            .map((json) => UserInfoModel.fromJson(json as Map<String, dynamic>))
            .toList();
      } else {
        users = [];
      }

      return ApiResponse.success(users);
    } on DioException catch (e) {
      return _handleDioError(e);
    }
  }

  /// Fetch dashboard statistics.
  Future<ApiResponse<Map<String, dynamic>>> getStats() async {
    try {
      final response = await _apiClient.get(ApiConstants.adminStats);
      return ApiResponse.success(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      return _handleDioError(e);
    }
  }

  /// Fetch activity logs (superadmin only).
  Future<ApiResponse<List<ActivityLogModel>>> getLogs({
    int page = 1,
    int pageSize = 50,
    String? userId,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'page_size': pageSize,
      };
      if (userId != null) queryParams['user_id'] = userId;

      final response = await _apiClient.get(
        ApiConstants.adminLogs,
        queryParameters: queryParams,
      );

      final data = response.data;
      List<ActivityLogModel> logs;

      if (data is Map<String, dynamic> && data.containsKey('logs')) {
        logs = (data['logs'] as List)
            .map((json) => ActivityLogModel.fromJson(json as Map<String, dynamic>))
            .toList();
      } else if (data is List) {
        logs = data
            .map((json) => ActivityLogModel.fromJson(json as Map<String, dynamic>))
            .toList();
      } else {
        logs = [];
      }

      return ApiResponse.success(logs);
    } on DioException catch (e) {
      return _handleDioError(e);
    }
  }

  ApiResponse<T> _handleDioError<T>(DioException e) {
    String message;
    int? statusCode = e.response?.statusCode;

    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        message = 'Connection timed out. Please try again.';
        break;
      case DioExceptionType.connectionError:
        message = 'No internet connection. Please check your network.';
        break;
      case DioExceptionType.badResponse:
        final data = e.response?.data;
        if (data is Map<String, dynamic>) {
          message = data['detail'] as String? ??
              data['message'] as String? ??
              'Something went wrong.';
        } else {
          message = 'Server error. Please try again later.';
        }
        break;
      default:
        message = 'Something went wrong. Please try again.';
    }

    return ApiResponse.error(message, statusCode: statusCode);
  }
}
