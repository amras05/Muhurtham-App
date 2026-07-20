import { useEffect, useState } from "react";
import * as Location from "expo-location";

// Falls back to Vijayawada if permission is denied, so the app is usable
// even without location access (astrology apps commonly let users set a
// fixed "birth place" / "current place" manually too — this is just the
// quick-start default).
const FALLBACK = { lat: 16.5062, lon: 80.648, tzOffset: 5.5, placeName: "Vijayawada" };

export function useLocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocation(FALLBACK);
          setLoading(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        const tzOffset = -new Date().getTimezoneOffset() / 60;
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          tzOffset,
          placeName: "Current location",
        });
      } catch (e) {
        setLocation(FALLBACK);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { location: location || FALLBACK, loading, setLocation };
}
