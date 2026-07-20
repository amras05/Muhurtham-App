import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exceptions.dart';
import '../../../core/network/api_response.dart';
import '../models/login_request.dart';
import '../models/signup_request.dart';
import '../models/otp_request.dart';
import '../models/user_model.dart';

/// Repository for all authentication API calls.
///
/// Handles signup, OTP verification, login, and session management.
/// The backend is responsible for sending WhatsApp OTP messages.
class AuthRepository {
  final ApiClient _apiClient = ApiClient();

  /// Register a new user with phone + password.
  /// 
  /// The backend will trigger a WhatsApp OTP message to the user's phone.
  /// Returns success with a message indicating OTP has been sent.
  Future<ApiResponse<Map<String, dynamic>>> signup(SignupRequest request) async {
    try {
      final response = await _apiClient.post(
        ApiConstants.signup,
        data: request.toJson(),
      );
      return ApiResponse.success(
        response.data as Map<String, dynamic>,
        message: 'OTP sent to your WhatsApp',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    }
  }

  /// Verify the OTP code sent to the user's WhatsApp.
  /// 
  /// On success, returns the user data and auth token.
  Future<ApiResponse<Map<String, dynamic>>> verifyOtp(OtpRequest request) async {
    try {
      final response = await _apiClient.post(
        ApiConstants.verifyOtp,
        data: request.toJson(),
      );
      return ApiResponse.success(
        response.data as Map<String, dynamic>,
        message: 'Phone verified successfully',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    }
  }

  /// Login with phone + password (no OTP required).
  /// 
  /// Returns the user data and JWT token on success.
  Future<ApiResponse<Map<String, dynamic>>> login(LoginRequest request) async {
    try {
      final response = await _apiClient.post(
        ApiConstants.login,
        data: request.toJson(),
      );
      return ApiResponse.success(
        response.data as Map<String, dynamic>,
        message: 'Login successful',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    }
  }

  /// Resend OTP to the user's WhatsApp.
  Future<ApiResponse<Map<String, dynamic>>> resendOtp(String phone) async {
    try {
      final response = await _apiClient.post(
        ApiConstants.resendOtp,
        data: {'phone': phone},
      );
      return ApiResponse.success(
        response.data as Map<String, dynamic>,
        message: 'OTP resent to your WhatsApp',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    }
  }

  /// Get the current user's profile.
  Future<ApiResponse<UserModel>> getUserProfile() async {
    try {
      final response = await _apiClient.get(ApiConstants.userProfile);
      final user = UserModel.fromJson(response.data as Map<String, dynamic>);
      return ApiResponse.success(user);
    } on DioException catch (e) {
      return _handleDioError(e);
    }
  }

  /// Handle Dio errors and convert to ApiResponse.
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
              'Something went wrong. Please try again.';
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
