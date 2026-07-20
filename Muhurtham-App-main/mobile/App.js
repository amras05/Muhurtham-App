import React from "react";
import { StatusBar } from "expo-status-bar";
import { View, TouchableOpacity, Text, StyleSheet, SafeAreaView } from "react-native";

import ActivitySearchScreen from "./screens/ActivitySearchScreen";
import DateLookupScreen from "./screens/DateLookupScreen";

// Simple two-tab switcher (kept dependency-light instead of pulling in
// @react-navigation/bottom-tabs — swap in real tab nav once the app grows).
export default function App() {
  const [tab, setTab] = React.useState("search");

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <View style={{ flex: 1 }}>
        {tab === "search" ? <ActivitySearchScreen /> : <DateLookupScreen />}
      </View>
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab} onPress={() => setTab("search")}>
          <Text style={[styles.tabText, tab === "search" && styles.tabTextActive]}>🔍 Activity Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => setTab("date")}>
          <Text style={[styles.tabText, tab === "date" && styles.tabTextActive]}>📅 Date Lookup</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row", borderTopWidth: 1, borderTopColor: "#eee", backgroundColor: "#fff",
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  tabText: { color: "#888", fontWeight: "600" },
  tabTextActive: { color: "#e65100" },
});
