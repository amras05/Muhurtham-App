"""
Muhurtham App — time parsing and formatting helpers.

Extracted from main.py (parse_time_to_hours, is_colliding_time,
parse_time_str_to_h, format_hms) and muhurta_finder.py (_parse_time_str_to_h).
"""
from typing import Optional, Union


def parse_time_to_hours(t_str: Optional[str]) -> Optional[float]:
    """Parse an HH:MM:SS time string (with optional day offset) to decimal hours.

    Handles day-offset markers like '(-1)' or '(+1)' appended to the time string.

    Args:
        t_str: Time string in "HH:MM:SS" or "HH:MM:SS (+1)" format.

    Returns:
        Decimal hours, or None if input is empty/None.
    """
    if not t_str:
        return None
    offset = 0
    if "(-1)" in t_str:
        offset = -24
    elif "(+1)" in t_str:
        offset = 24
    clean = t_str.split()[0]
    parts = clean.split(":")
    return offset + float(parts[0]) + float(parts[1]) / 60.0 + float(parts[2]) / 3600.0


def is_colliding_time(
    h: float,
    time_dict_or_list: Union[dict, list, None],
    buffer_mins: float = 10.0,
) -> bool:
    """Check if decimal hour `h` falls within an inauspicious time window.

    Supports both dict (start/end) and list-of-dicts formats. Applies a
    configurable safety buffer around the window boundaries.

    Args:
        h: The hour to check (decimal, e.g. 10.5 = 10:30).
        time_dict_or_list: A {"start": ..., "end": ...} dict, a list of such dicts, or None.
        buffer_mins: Minutes of safety buffer around inauspicious windows.

    Returns:
        True if the hour collides with any inauspicious period.
    """
    if not time_dict_or_list:
        return False
    buffer_h = buffer_mins / 60.0
    if isinstance(time_dict_or_list, dict):
        s = parse_time_to_hours(time_dict_or_list.get("start"))
        e = parse_time_to_hours(time_dict_or_list.get("end"))
        if s is None or e is None:
            return False

        # If period is entirely on previous day (<= 0) or next day (>= 24), no collision
        if s <= 0 and e <= 0:
            return False
        if s >= 24 and e >= 24:
            return False

        # Apply safety buffer around inauspicious time window
        s_buf = s - buffer_h
        e_buf = e + buffer_h

        if s_buf <= e_buf:
            return s_buf <= h <= e_buf
        else:
            return h >= s_buf or h <= e_buf
    elif isinstance(time_dict_or_list, list):
        for item in time_dict_or_list:
            if is_colliding_time(h, item, buffer_mins):
                return True
    return False


def parse_time_str_to_h(t_str: Optional[str]) -> float:
    """Parse a 12-hour time string like '10:30 AM' to decimal hours.

    Args:
        t_str: Time string in "HH:MM AM/PM" format.

    Returns:
        Decimal hours. Defaults to 10.0 on parse failure.
    """
    if not t_str:
        return 10.0
    try:
        parts = t_str.strip().split()
        time_part = parts[0]
        ampm = parts[1].upper() if len(parts) > 1 else "AM"
        h_m = time_part.split(":")
        hh = int(h_m[0])
        mm = int(h_m[1])
        if ampm == "PM" and hh < 12:
            hh += 12
        elif ampm == "AM" and hh == 12:
            hh = 0
        return hh + mm / 60.0
    except Exception:
        return 10.0


def format_hms(h: float) -> str:
    """Format decimal hours into a 12-hour "HH:MM AM/PM" string.

    Args:
        h: Decimal hours (e.g. 14.5 = 2:30 PM).

    Returns:
        Formatted time string like "02:30 PM".
    """
    norm_h = h % 24.0
    hh = int(norm_h)
    mm = int(round((norm_h - hh) * 60))
    if mm >= 60:
        hh += 1
        mm = 0
        if hh >= 24:
            hh = 0
    ampm = "AM" if hh < 12 else "PM"
    display_h = hh if hh <= 12 else hh - 12
    if display_h == 0:
        display_h = 12
    return f"{display_h:02d}:{mm:02d} {ampm}"
