// Point this at your deployed FastAPI backend.
// While developing: run the backend locally and use your machine's LAN IP
// (not "localhost" — the phone/emulator can't reach your laptop's localhost),
// e.g. "http://192.168.1.20:8000".
export const API_BASE_URL = "http://192.168.1.20:8000";

async function get(path, params = {}) {
  const url = new URL(API_BASE_URL + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  listActivities: () => get("/activities"),

  daySummary: ({ date, lat, lon, tzOffset, placeName, method }) =>
    get("/panchang/day-summary", { date, lat, lon, tz_offset: tzOffset, place_name: placeName, method }),

  panchang: ({ date, lat, lon, tzOffset, placeName, hour, method }) =>
    get("/panchang", { date, lat, lon, tz_offset: tzOffset, place_name: placeName, hour, method }),

  checkMuhurta: ({ activityId, date, lat, lon, tzOffset, placeName, method }) =>
    get("/muhurta/check", {
      activity_id: activityId, date, lat, lon, tz_offset: tzOffset, place_name: placeName, method,
    }),

  nextMuhurta: ({ activityId, fromDate, lat, lon, tzOffset, placeName, maxDays, method }) =>
    get("/muhurta/next", {
      activity_id: activityId, from_date: fromDate, lat, lon,
      tz_offset: tzOffset, place_name: placeName, max_days: maxDays, method,
    }),
};
