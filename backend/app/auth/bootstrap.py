"""
Create the first super admin from the server's command line (never by signing up first).

    cd backend
    python -m app.auth.bootstrap --mobile +919848012345 --name "Your Name"

Refuses if an active super admin already exists. If the mobile already has an account,
that account is promoted (and its mobile marked verified); otherwise a new account is made
and you are asked for its password twice (input hidden). Nothing is printed or logged
except the masked mobile.
"""
import argparse
import getpass
import sys

from sqlalchemy import text

from app.auth.crypto import hash_password
from app.auth.database import count_active_super_admins, get_user_by_phone, write_activity_log
from app.auth.mobile import mask_mobile, normalize_mobile
from app.db.engine import app_engine


def main() -> int:
    ap = argparse.ArgumentParser(description="Create the first super admin.")
    ap.add_argument("--mobile", required=True, help="Mobile number, e.g. +919848012345")
    ap.add_argument("--name", required=True, help="Display name (2-80 characters)")
    args = ap.parse_args()

    mobile = normalize_mobile(args.mobile)
    if not mobile:
        print("That is not a valid mobile number.", file=sys.stderr)
        return 1
    name = args.name.strip()
    if not 2 <= len(name) <= 80:
        print("Name must be 2 to 80 characters.", file=sys.stderr)
        return 1
    if count_active_super_admins() > 0:
        print("A super admin already exists. Use the admin screens to change roles.", file=sys.stderr)
        return 1

    existing = get_user_by_phone(mobile)
    if existing:
        with app_engine().begin() as c:
            c.execute(text("""UPDATE app.users SET role = 'super_admin', status = 'active', disabled_reason = NULL,
                                     mobile_verified_at = COALESCE(mobile_verified_at, now()), name = :n
                              WHERE id = CAST(:i AS uuid)"""), {"n": name, "i": existing["id"]})
        user_id = existing["id"]
        print(f"Promoted the existing account {mask_mobile(mobile)} to super admin.")
    else:
        pw = getpass.getpass("Password for the new super admin (at least 10 characters): ")
        if len(pw) < 10:
            print("Password must be at least 10 characters.", file=sys.stderr)
            return 1
        if getpass.getpass("Type it again: ") != pw:
            print("The passwords did not match.", file=sys.stderr)
            return 1
        with app_engine().begin() as c:
            user_id = c.execute(text("""
                INSERT INTO app.users (mobile, mobile_verified_at, name, password_hash, role, status)
                VALUES (:m, now(), :n, :p, 'super_admin', 'active') RETURNING id::text"""),
                {"m": mobile, "n": name, "p": hash_password(pw)}).scalar()
        print(f"Created super admin {mask_mobile(mobile)}. Log in with this mobile and password.")

    write_activity_log(None, "bootstrap.super_admin", details="Super admin created from the server command line",
                       target_type="user", target_id=user_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
