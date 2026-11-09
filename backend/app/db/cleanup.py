"""
Scheduled clean-up (plan R5, periods approved as M3):

  OTP records          older than 7 days
  rate-limit counters  older than 2 days
  ended sessions       revoked or expired more than 30 days ago
  audit log rows       older than 1 year

Runs with the migrate role (the app's own role may not delete audit rows).

    python -m app.db.cleanup            # delete and print what was removed
    python -m app.db.cleanup --dry-run  # only count

On the server a nightly systemd timer runs it (deploy/muhurtham-cleanup.timer).
"""
import sys

from sqlalchemy import text

from app.db.engine import one_off_engine

RULES = [
    ("login codes", "app.otp_requests", "created_at < now() - interval '7 days'"),
    ("rate counters", "app.rate_limits", "window_start < now() - interval '2 days'"),
    ("ended sessions", "app.sessions", "(revoked_at < now() - interval '30 days') OR (expires_at < now() - interval '30 days')"),
    ("activity log rows", "app.audit_logs", "created_at < now() - interval '1 year'"),
]


def run(dry_run: bool = False) -> dict:
    out = {}
    with one_off_engine("migrate").begin() as c:
        for label, table, where in RULES:
            sql = f"SELECT count(*) FROM {table} WHERE {where}" if dry_run else f"DELETE FROM {table} WHERE {where}"
            r = c.execute(text(sql))
            out[label] = r.scalar() if dry_run else r.rowcount
    return out


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    result = run(dry)
    print(("Would remove: " if dry else "Removed: ") + ", ".join(f"{n} {k}" for k, n in result.items()))
