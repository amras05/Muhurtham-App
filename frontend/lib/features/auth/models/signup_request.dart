/// Signup request body — phone + password + confirmPassword.
/// OTP verification is a separate step after signup.
class SignupRequest {
  final String phone;
  final String password;
  final String confirmPassword;

  SignupRequest({
    required this.phone,
    required this.password,
    required this.confirmPassword,
  });

  Map<String, dynamic> toJson() {
    return {
      'phone': phone,
      'password': password,
      'confirm_password': confirmPassword,
    };
  }
}
