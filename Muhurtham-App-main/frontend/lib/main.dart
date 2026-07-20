import 'package:flutter/material.dart';
import 'app/app.dart';
import 'core/storage/local_storage.dart';

void main() async {
  // Ensure Flutter engine is initialized before calling native platforms (like SharedPreferences)
  WidgetsFlutterBinding.ensureInitialized();

  // Pre-initialize local storage singleton to warm up SharedPreferences cache
  final storage = LocalStorage();
  // Call a dummy storage read to trigger internal SharedPreferences.getInstance()
  await storage.isLoggedIn();

  // Run the app
  runApp(const MuhurthamApp());
}
