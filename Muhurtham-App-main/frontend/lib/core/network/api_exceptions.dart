/// Custom exception types for API error handling.

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  @override
  String toString() => 'ApiException: $message (status: $statusCode)';
}

class NetworkException extends ApiException {
  NetworkException([String message = 'No internet connection. Please check your network.'])
      : super(message);
}

class ServerException extends ApiException {
  ServerException([String message = 'Server error. Please try again later.'])
      : super(message, statusCode: 500);
}

class UnauthorizedException extends ApiException {
  UnauthorizedException([String message = 'Session expired. Please log in again.'])
      : super(message, statusCode: 401);
}

class ForbiddenException extends ApiException {
  ForbiddenException([String message = 'You do not have permission to perform this action.'])
      : super(message, statusCode: 403);
}

class NotFoundException extends ApiException {
  NotFoundException([String message = 'The requested resource was not found.'])
      : super(message, statusCode: 404);
}

class ValidationException extends ApiException {
  final Map<String, dynamic>? errors;

  ValidationException(
    String message, {
    this.errors,
  }) : super(message, statusCode: 422);
}

class TimeoutException extends ApiException {
  TimeoutException([String message = 'Request timed out. Please try again.'])
      : super(message);
}
