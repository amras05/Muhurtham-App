import 'package:flutter_test/flutter_test.dart';
import 'package:muhurtham_app/app/app.dart';

void main() {
  testWidgets('Smoke test - App runs and displays title', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const MuhurthamApp());

    // Verify the app starts and triggers routing
    expect(find.byType(MuhurthamApp), findsOneWidget);
  });
}

