import 'package:flutter/material.dart';
import '../core/constants/app_constants.dart';
import 'routes.dart';
import 'theme/app_theme.dart';

/// The root MaterialApp widget.
///
/// Configures app-wide settings such as routing, theming, and title.
class MuhurthamApp extends StatelessWidget {
  const MuhurthamApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      initialRoute: AppRoutes.splash,
      routes: AppRoutes.routes,
      onGenerateRoute: AppRoutes.onGenerateRoute,
    );
  }
}
