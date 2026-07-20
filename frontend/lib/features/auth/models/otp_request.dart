/// OTP verification request body.
class OtpRequest {
  final String phone;
  final String otp;

  OtpRequest({
    required this.phone,
    required this.otp,
  });

  Map<String, dynamic> toJson() {
    return {
      'phone': phone,
      'otp': otp,
    };
  }
}
