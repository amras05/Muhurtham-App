import 'package:flutter/material.dart';

/// Muhurtham App Color Palette
/// Inspired by traditional Indian auspicious ceremony aesthetics —
/// saffron gold, deep maroon, warm cream tones.
class AppColors {
  AppColors._();

  // ─── Primary (Gold) ─────────────────────────────────────
  static const Color primary = Color(0xFFD4A017);
  static const Color primaryLight = Color(0xFFE8C54A);
  static const Color primaryDark = Color(0xFFB8860B);
  static const Color primarySurface = Color(0xFFFFF8E7);

  // ─── Secondary (Deep Maroon) ────────────────────────────
  static const Color secondary = Color(0xFF8B1A1A);
  static const Color secondaryLight = Color(0xFFA83232);
  static const Color secondaryDark = Color(0xFF5E1010);
  static const Color secondarySurface = Color(0xFFFFF0F0);

  // ─── Backgrounds ────────────────────────────────────────
  static const Color background = Color(0xFFFFF8F0);
  static const Color backgroundDark = Color(0xFFF5EDE0);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFFAF5ED);
  static const Color scaffoldBackground = Color(0xFFFFF8F0);

  // ─── Text ───────────────────────────────────────────────
  static const Color textPrimary = Color(0xFF2D1810);
  static const Color textSecondary = Color(0xFF6B5344);
  static const Color textTertiary = Color(0xFF9A8878);
  static const Color textOnPrimary = Color(0xFFFFFFFF);
  static const Color textOnSecondary = Color(0xFFFFFFFF);

  // ─── Semantic ───────────────────────────────────────────
  static const Color success = Color(0xFF2E7D32);
  static const Color successLight = Color(0xFFE8F5E9);
  static const Color error = Color(0xFFD32F2F);
  static const Color errorLight = Color(0xFFFFEBEE);
  static const Color warning = Color(0xFFED6C02);
  static const Color warningLight = Color(0xFFFFF3E0);
  static const Color info = Color(0xFF0288D1);
  static const Color infoLight = Color(0xFFE1F5FE);

  // ─── Borders & Dividers ─────────────────────────────────
  static const Color border = Color(0xFFE8D8C8);
  static const Color borderLight = Color(0xFFF0E8DC);
  static const Color divider = Color(0xFFF0E0D0);

  // ─── Shadows ────────────────────────────────────────────
  static const Color shadow = Color(0x1A2D1810);
  static const Color shadowDark = Color(0x332D1810);

  // ─── WhatsApp ───────────────────────────────────────────
  static const Color whatsapp = Color(0xFF25D366);
  static const Color whatsappDark = Color(0xFF128C7E);

  // ─── Gradients ──────────────────────────────────────────
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFD4A017), Color(0xFFE8C54A)],
  );

  static const LinearGradient goldSaffronGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFD4A017), Color(0xFFFF8C00)],
  );

  static const LinearGradient maroonGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF8B1A1A), Color(0xFFA83232)],
  );

  static const LinearGradient warmBackgroundGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFFFF8F0), Color(0xFFFFF0D4)],
  );

  static const LinearGradient authCardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xCCFFFFFF),
      Color(0x99FFFFFF),
    ],
  );

  // ─── Role Badge Colors ──────────────────────────────────
  static const Color roleSuperAdmin = Color(0xFF6A1B9A);
  static const Color roleAdmin = Color(0xFF0277BD);
  static const Color roleUser = Color(0xFF2E7D32);
}
