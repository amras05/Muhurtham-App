"""
Muhurtham App — date parsing and manipulation helpers.

Consolidates the repeated `y, m, d = (int(x) for x in date_str.split("-"))` logic
used across routes and services.
"""
from datetime import date
from typing import Tuple


def parse_date_str(date_str: str) -> Tuple[int, int, int]:
    """
    Parse a 'YYYY-MM-DD' date string into a (year, month, day) integer tuple.

    Raises ValueError if format is invalid.
    """
    if not date_str:
        raise ValueError("Empty date string provided")
    parts = date_str.strip().split("-")
    if len(parts) != 3:
        raise ValueError(f"Invalid date format: '{date_str}', expected YYYY-MM-DD")
    try:
        return int(parts[0]), int(parts[1]), int(parts[2])
    except ValueError as e:
        raise ValueError(f"Invalid integer values in date '{date_str}': {e}") from e


def parse_date(date_str: str) -> date:
    """Parse a 'YYYY-MM-DD' date string into a datetime.date object."""
    y, m, d = parse_date_str(date_str)
    return date(y, m, d)
