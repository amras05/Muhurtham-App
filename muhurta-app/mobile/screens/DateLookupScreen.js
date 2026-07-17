import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, SafeAreaView,
  ScrollView, TouchableOpacity, Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api } from "../api/client";
import { useLocation } from "../useLocation";

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

export default function DateLookupScreen() {
  const { location } = useLocation();
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async (d) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.daySummary({
        date: toDateStr(d),
        lat: location.lat,
        lon: location.lon,
        tzOffset: location.tzOffset,
        placeName: location.placeName,
      });
      setData(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(date); }, [location]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Panchang for a Date</Text>

      <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.dateButtonText}>{toDateStr(date)} — change date</Text>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(event, selected) => {
            setShowPicker(false);
            if (selected) { setDate(selected); load(selected); }
          }}
        />
      )}

      {loading && <ActivityIndicator style={{ marginTop: 24 }} size="large" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {data && !loading && (
        <ScrollView style={{ marginTop: 12 }}>
          <View style={styles.panchangCard}>
            <Text style={styles.row}>Vaara: <Text style={styles.bold}>{data.panchang.vaara}</Text></Text>
            <Text style={styles.row}>
              Tithi: <Text style={styles.bold}>{data.panchang.tithi_name}</Text> ({data.panchang.paksha} paksha)
            </Text>
            <Text style={styles.row}>
              Nakshatra: <Text style={styles.bold}>{data.panchang.nakshatra_name}</Text> pada {data.panchang.nakshatra_pada}
            </Text>
            <Text style={styles.row}>Yoga: <Text style={styles.bold}>{data.panchang.yoga_name}</Text></Text>
            <Text style={styles.row}>Karana: <Text style={styles.bold}>{data.panchang.karana_name}</Text></Text>
            <Text style={styles.row}>Sunrise: {data.panchang.sunrise} · Sunset: {data.panchang.sunset}</Text>
            <Text style={styles.row}>
              Rahu Kaalam: {data.panchang.rahu_kaalam?.[0]}–{data.panchang.rahu_kaalam?.[1]}
            </Text>
            <Text style={styles.row}>
              Durmuhurtam: {data.panchang.durmuhurtam?.[0]}–{data.panchang.durmuhurtam?.[1]}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>✅ Favorable today</Text>
          {data.favorable_activities.length === 0 && <Text style={styles.empty}>None</Text>}
          {data.favorable_activities.map((a) => (
            <Text key={a.activity_id} style={styles.activityGood}>{a.activity_name_en}</Text>
          ))}

          <Text style={styles.sectionTitle}>⚠️ Mixed / caution</Text>
          {data.mixed_activities.length === 0 && <Text style={styles.empty}>None</Text>}
          {data.mixed_activities.map((a) => (
            <Text key={a.activity_id} style={styles.activityMixed}>{a.activity_name_en}</Text>
          ))}

          <Text style={styles.sectionTitle}>❌ Avoid today</Text>
          {data.avoid_activities.length === 0 && <Text style={styles.empty}>None</Text>}
          {data.avoid_activities.map((a) => (
            <Text key={a.activity_id} style={styles.activityBad}>{a.activity_name_en}</Text>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  header: { fontSize: 24, fontWeight: "700", marginBottom: 12 },
  dateButton: {
    padding: 12, backgroundColor: "#fff3e0", borderRadius: 8, alignItems: "center",
  },
  dateButtonText: { fontWeight: "600" },
  error: { color: "#c62828", marginTop: 12 },
  panchangCard: {
    padding: 14, borderRadius: 12, backgroundColor: "#fafafa", borderWidth: 1, borderColor: "#eee",
  },
  row: { fontSize: 14, marginBottom: 4, color: "#333" },
  bold: { fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 6 },
  empty: { color: "#999", fontStyle: "italic" },
  activityGood: { color: "#2e7d32", marginBottom: 4 },
  activityMixed: { color: "#f9a825", marginBottom: 4 },
  activityBad: { color: "#c62828", marginBottom: 4 },
});
