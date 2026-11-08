import 'dart:convert';
import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../storage/local_storage.dart';

/// Dio-based HTTP client with JWT token interceptor.
///
/// Automatically attaches the stored auth token to every request
/// and handles 401 responses by clearing the session.
class ApiClient {
  static ApiClient? _instance;
  late final Dio _dio;
  final LocalStorage _storage = LocalStorage();

  ApiClient._internal() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(milliseconds: ApiConstants.connectionTimeout),
        receiveTimeout: const Duration(milliseconds: ApiConstants.receiveTimeout),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // ─── Request Interceptor: attach JWT token ────────────
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onResponse: (response, handler) {
          return handler.next(response);
        },
        onError: (error, handler) async {
          final options = error.requestOptions;
          final isAuthCall = options.path.startsWith('/auth/');
          final alreadyRetried = options.extra['retried'] == true;
          if (error.response?.statusCode == 401 && !isAuthCall && !alreadyRetried) {
            // Access token expired: get a new one with the refresh token, then retry once.
            final newToken = await _refreshAccessToken();
            if (newToken != null) {
              options.headers['Authorization'] = 'Bearer $newToken';
              options.extra['retried'] = true;
              try {
                return handler.resolve(await _dio.fetch(options));
              } on DioException catch (retryError) {
                return handler.next(retryError);
              }
            }
            await _storage.clearAll();
          }
          return handler.next(error);
        },
      ),
    );
  }

  /// Exchanges the stored refresh token for new tokens. Concurrent 401s share one call.
  Future<String?>? _refreshing;

  Future<String?> _refreshAccessToken() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<String?> _doRefresh() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return null;
    try {
      // A bare Dio, so this call does not go through the interceptor above.
      final response = await Dio(BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(milliseconds: ApiConstants.connectionTimeout),
        receiveTimeout: const Duration(milliseconds: ApiConstants.receiveTimeout),
      )).post(ApiConstants.refreshToken, data: {'refresh_token': refreshToken});
      final data = response.data as Map<String, dynamic>;
      final token = data['token'] as String?;
      final newRefresh = data['refresh_token'] as String?;
      if (token == null || newRefresh == null) return null;
      await _storage.saveToken(token);
      await _storage.saveRefreshToken(newRefresh);
      return token;
    } on DioException {
      return null;
    }
  }

  /// Signs this device out on the server (best effort), then clears local data.
  Future<void> logout({bool everywhere = false}) async {
    try {
      await _dio.post(ApiConstants.logout, data: {'everywhere': everywhere});
    } on DioException {
      // Offline or already signed out: still clear the device.
    }
    await _storage.clearAll();
  }

  /// Singleton accessor.
  factory ApiClient() {
    _instance ??= ApiClient._internal();
    return _instance!;
  }

  /// GET request.
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    return _dio.get(path, queryParameters: queryParameters);
  }

  /// POST request.
  Future<Response> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _dio.post(path, data: data, queryParameters: queryParameters);
  }

  /// PUT request.
  Future<Response> put(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _dio.put(path, data: data, queryParameters: queryParameters);
  }

  /// PATCH request.
  Future<Response> patch(
    String path, {
    dynamic data,
  }) async {
    return _dio.patch(path, data: data);
  }

  /// DELETE request.
  Future<Response> delete(
    String path, {
    dynamic data,
  }) async {
    return _dio.delete(path, data: data);
  }
}
