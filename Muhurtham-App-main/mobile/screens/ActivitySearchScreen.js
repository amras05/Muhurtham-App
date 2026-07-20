import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView,
} from "react-native";
import { api } from "../api/client";
import { useLocation } from "../useLocation";

const VERDICT_COLORS = {
  favorable: "#2e7d32",
  mixed: "#f9a825",
  avoid: "#c62828",
  neutral: "#616161",
};

export default function ActivitySearchScreen() {
  const { location } = useLocation();
  const [activities, setActivities] = useState([]);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listActivities().then(setActivities).catch((e) => setError(e.message));
  }, []);

  const search = async (activity) => {
    setSelected(activity);
    setResult(null);
    setLoading(true);
    setError(null);
    try {
      const r = await api.nextMuhurta({
        activityId: activity.id,
        lat: location.lat,
        lon: location.lon,
        tzOffset: location.tzOffset,
        placeName: location.placeName,
        maxDays: 60,
      });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Find a Muhurta</Text>
      <Text style={styles.subheader}>Pick an activity — I'll find the next good date</Text>

      <FlatList
        data={activities}
        keyExtractor={(a) => a.id}
        horizontal={false}
        style={{ maxHeight: 260 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.activityRow, selected?.id === item.id && styles.activityRowSelected]}
            onPress={() => search(item)}
          >
            <Text style={styles.activityText}>{item.name_en}</Text>
            <Text style={styles.activityTextTe}>{item.name_te}</Text>
          </TouchableOpacity>
        )}
      />

      {loading && <ActivityIndicator style={{ marginTop: 24 }} size="large" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {result && !loading && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>{result.activity_name_en}</Text>
          <Text style={[styles.verdict, { color: VERDICT_COLORS[result.verdict] || "#333" }]}>
            {result.date} — {result.verdict.toUpperCase()}
            {result.days_from_today === 0 ? "  (today!)" : ""}
          </Text>

          {result.panchang_snapshot && (
            <Text style={styles.snapshot}>
              {result.panchang_snapshot.vaara} · {result.panchang_snapshot.tithi} ·{" "}
              {result.panchang_snapshot.nakshatra}
            </Text>
          )}

          {result.reasons_favorable?.map((r, i) => (
            <Text key={`f${i}`} style={styles.reasonGood}>+ {r}</Text>
          ))}
          {result.reasons_avoid?.map((r, i) => (
            <Text key={`a${i}`} style={styles.reasonBad}>- {r}</Text>
          ))}
          {result.notes_from_book ? (
            <Text style={styles.notes}>Note: {result.notes_from_book}</Text>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  header: { fontSize: 24, fontWeight: "700" },
  subheader: { fontSize: 14, color: "#666", marginBottom: 12 },
  activityRow: {
    paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  activityRowSelected: { backgroundColor: "#fff3e0" },
  activityText: { fontSize: 16, fontWeight: "600" },
  activityTextTe: { fontSize: 14, color: "#888" },
  error: { color: "#c62828", marginTop: 12 },
  resultCard: {
    marginTop: 16, padding: 16, borderRadius: 12, backgroundColor: "#fafafa",
    borderWidth: 1, borderColor: "#eee",
  },
  resultTitle: { fontSize: 18, fontWeight: "700" },
  verdict: { fontSize: 16, fontWeight: "700", marginTop: 4, marginBottom: 8 },
  snapshot: { fontSize: 13, color: "#555", marginBottom: 8 },
  reasonGood: { color: "#2e7d32", marginBottom: 2 },
  reasonBad: { color: "#c62828", marginBottom: 2 },
  notes: { marginTop: 8, fontStyle: "italic", color: "#666" },
});
