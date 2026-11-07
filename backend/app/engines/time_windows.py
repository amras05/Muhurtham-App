"""
Time Window Interval Engine (Layer 1).
Provides continuous interval algebra for intersecting auspicious periods and
subtracting inauspicious kalas (Rahu, Yama, Gulika, Varjyam, Durmuhurtham).

Mathematical Model:
  Auspicious Window = (Tithi_Span ∩ Nakshatra_Span ∩ Lagna_Span) ∖ (Rahu ∪ Yama ∪ Gulika ∪ Varjyam ∪ Durmuhurta)
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class TimeWindow:
    """Represents a continuous interval of time [start, end]."""
    start: datetime
    end: datetime
    label: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if self.start > self.end:
            raise ValueError(f"Invalid TimeWindow: start ({self.start}) is after end ({self.end})")

    @property
    def start_time(self) -> str:
        return self.start.strftime("%H:%M:%S")

    @property
    def end_time(self) -> str:
        return self.end.strftime("%H:%M:%S")

    @property
    def duration_seconds(self) -> float:
        return (self.end - self.start).total_seconds()

    @property
    def duration_minutes(self) -> float:
        return self.duration_seconds / 60.0

    @property
    def duration_ghatis(self) -> float:
        """1 Ghati = 24 minutes (60 ghatis = 24 hours / 1 ahoratram)."""
        return self.duration_minutes / 24.0

    def contains(self, dt: datetime) -> bool:
        return self.start <= dt <= self.end

    def overlaps(self, other: "TimeWindow") -> bool:
        return self.start < other.end and self.end > other.start

    def intersection(self, other: "TimeWindow", label: Optional[str] = None) -> Optional["TimeWindow"]:
        """Compute the intersection between self and other."""
        s = max(self.start, other.start)
        e = min(self.end, other.end)
        if s < e:
            new_label = label or (f"{self.label} ∩ {other.label}" if self.label and other.label else (self.label or other.label))
            merged_meta = {**self.metadata, **other.metadata}
            return TimeWindow(start=s, end=e, label=new_label, metadata=merged_meta)
        return None

    def subtract(self, blocked: "TimeWindow") -> List["TimeWindow"]:
        """
        Subtracts a blocked interval from self.
        Returns a list of 0, 1, or 2 remaining TimeWindows.
        """
        # If no overlap, self remains intact
        if not self.overlaps(blocked):
            return [self]

        remaining: List[TimeWindow] = []

        # Left remainder: before blocked start
        if self.start < blocked.start:
            remaining.append(
                TimeWindow(
                    start=self.start,
                    end=min(self.end, blocked.start),
                    label=self.label,
                    metadata=dict(self.metadata),
                )
            )

        # Right remainder: after blocked end
        if self.end > blocked.end:
            remaining.append(
                TimeWindow(
                    start=max(self.start, blocked.end),
                    end=self.end,
                    label=self.label,
                    metadata=dict(self.metadata),
                )
            )

        return remaining

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "start_time": self.start.strftime("%H:%M:%S"),
            "end_time": self.end.strftime("%H:%M:%S"),
            "duration_minutes": round(self.duration_minutes, 1),
            "duration_ghatis": round(self.duration_ghatis, 2),
            "label": self.label,
            "metadata": self.metadata,
        }


# ==============================================================================
# Interval Set Operations
# ==============================================================================

def intersect_interval_lists(list_a: List[TimeWindow], list_b: List[TimeWindow]) -> List[TimeWindow]:
    """Compute pairwise intersections between two sets of TimeWindows."""
    result: List[TimeWindow] = []
    for a in list_a:
        for b in list_b:
            inter = a.intersection(b)
            if inter and inter.duration_minutes > 0.0:
                result.append(inter)
    return merge_overlapping_windows(result)


def subtract_blocked_intervals(
    candidates: List[TimeWindow],
    blocked_intervals: List[TimeWindow],
    min_duration_minutes: float = 12.0
) -> List[TimeWindow]:
    """
    Subtracts a list of blocked/inauspicious intervals from candidate windows.
    Filters out any sliver windows smaller than min_duration_minutes (default: 12 min / 0.5 ghati).
    """
    current_windows = list(candidates)

    for blocked in blocked_intervals:
        next_windows: List[TimeWindow] = []
        for w in current_windows:
            rem = w.subtract(blocked)
            next_windows.extend(rem)
        current_windows = next_windows

    # Filter out tiny impractical fragments
    surviving = [w for w in current_windows if w.duration_minutes >= min_duration_minutes]
    return merge_overlapping_windows(surviving)


def merge_overlapping_windows(windows: List[TimeWindow]) -> List[TimeWindow]:
    """Sort and merge contiguous or overlapping intervals with the same label."""
    if not windows:
        return []

    sorted_w = sorted(windows, key=lambda w: w.start)
    merged: List[TimeWindow] = [sorted_w[0]]

    for current in sorted_w[1:]:
        prev = merged[-1]
        # Overlapping or exactly adjacent
        if current.start <= prev.end:
            prev.end = max(prev.end, current.end)
            if current.metadata:
                prev.metadata.update(current.metadata)
        else:
            merged.append(current)

    return merged


# ==============================================================================
# Ghati & Traditional Time Conversion Helpers
# ==============================================================================

def minutes_to_ghatis(minutes: float) -> Tuple[int, float]:
    """Convert minutes to (ghatis, vighatis). 1 ghati = 24 min, 1 vighati = 24 sec (0.4 min)."""
    total_ghatis = minutes / 24.0
    g = int(total_ghatis)
    rem_min = minutes - (g * 24.0)
    vg = rem_min / 0.4
    return g, round(vg, 1)


def ghatis_to_minutes(ghatis: float, vighatis: float = 0.0) -> float:
    """Convert ghatis and vighatis into minutes."""
    return (ghatis * 24.0) + (vighatis * 0.4)


def sunrise_ghatis_to_datetime(sunrise: datetime, ghatis: float, vighatis: float = 0.0) -> datetime:
    """Calculate the exact clock datetime given sunrise time and elapsed ghatis/vighatis."""
    mins = ghatis_to_minutes(ghatis, vighatis)
    return sunrise + timedelta(minutes=mins)

