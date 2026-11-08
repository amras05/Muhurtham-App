"""
One-time copy of the old SQLite accounts (backend/muhurtham.db) into PostgreSQL.

    cd backend
    python -m app.db.import_sqlite muhurtham.db            # dry run: prints what would happen
    python -m app.db.import_sqlite muhurtham.db --apply    # copies

Copies verified users (phone → E.164 mobile, is_active → status) and their activity logs
into app.audit_logs. Skips unverified sign-ups, users whose number is invalid, numbers that
collide after conversion, and numbers already present in PostgreSQL — each is listed
(masked) so you can decide. The SQLite file is opened read-only and never changed.
Passwords keep working: the hashes are copied as they are.
"""
import argparse
import json
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

from sqlalchemy import text

from app.auth.mobile import mask_mobile, normalize_mobile
from app.db.engine import one_off_engine


def main() -> int:
    ap = argparse.ArgumentParser(description="Copy old SQLite accounts into PostgreSQL.")
    ap.add_argument("sqlite_file", type=Path)
    ap.add_argument("--apply", action="store_true", help="Write to PostgreSQL (default is a dry run)")
    args = ap.parse_args()

    if not args.sqlite_file.is_file():
        print(f"{args.sqlite_file} not found.", file=sys.stderr)
        return 1
    src = sqlite3.connect(f"file:{args.sqlite_file}?mode=ro", uri=True)
    src.row_factory = sqlite3.Row
    users = [dict(r) for r in src.execute("SELECT * FROM users")]
    tables = {r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    logs = [dict(r) for r in src.execute("SELECT * FROM activity_logs")] if "activity_logs" in tables else []
    src.close()

    skipped, by_mobile = [], defaultdict(list)
    for u in users:
        mobile = normalize_mobile(u.get("phone"))
        if not u.get("is_verified"):
            skipped.append((u.get("phone"), "never verified their mobile"))
        elif not mobile:
            skipped.append((u.get("phone"), "not a valid mobile number"))
        else:
            by_mobile[mobile].append(u)
    for mobile, group in list(by_mobile.items()):
        if len(group) > 1:
            skipped.append((mobile, f"{len(group)} old accounts share this number after conversion"))
            del by_mobile[mobile]

    engine = one_off_engine("app")
    with engine.connect() as c:
        present = {r[0] for r in c.execute(text("SELECT mobile FROM app.users WHERE mobile = ANY(:m)"),
                                           {"m": list(by_mobile)})}
    for mobile in present:
        skipped.append((mobile, "already in PostgreSQL"))
        del by_mobile[mobile]

    print(f"Old users: {len(users)}  ·  to copy: {len(by_mobile)}  ·  skipped: {len(skipped)}  ·  old log rows: {len(logs)}")
    for phone, why in skipped:
        print(f"  skip {mask_mobile(normalize_mobile(phone) or ('+' + str(phone or '')))}: {why}")
    if not args.apply:
        print("Dry run: nothing written. Add --apply to copy.")
        return 0

    old_to_new = {}
    with engine.begin() as c:
        for mobile, (u,) in by_mobile.items():
            name = (u.get("name") or "").strip()
            if not 2 <= len(name) <= 80:
                name = f"User {mobile[-4:]}"
            new_id = c.execute(text("""
                INSERT INTO app.users (mobile, mobile_verified_at, name, password_hash, role, status,
                                       disabled_reason, created_at, last_login_at, login_count)
                VALUES (:m, COALESCE(CAST(:ca AS timestamptz), now()), :n, :p, :r, :s, :dr,
                        COALESCE(CAST(:ca AS timestamptz), now()), CAST(:ll AS timestamptz), :lc)
                RETURNING id::text"""), {
                "m": mobile, "n": name, "p": u.get("password_hash"),
                "r": u.get("role") if u.get("role") in ("user", "admin", "super_admin") else "user",
                "s": "active" if u.get("is_active", 1) else "disabled",
                "dr": None if u.get("is_active", 1) else "disabled before the move",
                "ca": u.get("created_at"), "ll": u.get("last_login_at"), "lc": int(u.get("login_count") or 0),
            }).scalar()
            old_to_new[u["id"]] = new_id
        moved = 0
        for log in logs:
            new_actor = old_to_new.get(log.get("user_id"))
            if not new_actor:
                continue
            c.execute(text("""INSERT INTO app.audit_logs (actor_id, action, details_json, created_at)
                              VALUES (CAST(:a AS uuid), :act, CAST(:d AS jsonb), COALESCE(CAST(:t AS timestamptz), now()))"""),
                      {"a": new_actor, "act": f"legacy.{log.get('action') or 'event'}",
                       "d": json.dumps({"text": log.get("details")}) if log.get("details") else None,
                       "t": log.get("timestamp")})
            moved += 1
    print(f"Copied {len(old_to_new)} users and {moved} log rows. The SQLite file was not changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
