"""
Prints the SQL that creates Muhurtham's schema and its two PostgreSQL roles, using the
passwords in backend/.env. Paste the output into the Supabase SQL editor (development) or
run it with psql as a superuser on the production server.

  muhurtham_migrate  owns schema `app` and its tables (Alembic migrations)
  muhurtham_app      SELECT, INSERT, UPDATE, DELETE on those tables (the running app)

Passwords are written as SCRAM-SHA-256 verifiers, which PostgreSQL accepts in place of the
password itself, so the plain passwords never appear in the SQL editor or its history.

Usage:   python3 backend/scripts/pg_roles.py            (prints SQL to the terminal)
         python3 backend/scripts/pg_roles.py --env path/to/.env
Safe to run again: roles are created if missing, otherwise their passwords are reset.
Standard library only.
"""
import argparse
import base64
import hashlib
import hmac
import re
import secrets
import sys
from pathlib import Path

ITERATIONS = 4096  # PostgreSQL's default scram_iterations


def scram_verifier(password: str) -> str:
    """SCRAM-SHA-256$<iter>:<salt>$<StoredKey>:<ServerKey>, as PostgreSQL stores it."""
    if not password.isascii():
        raise ValueError("passwords must be ASCII (no SASLprep is applied)")
    salt = secrets.token_bytes(16)
    salted = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    client_key = hmac.new(salted, b"Client Key", hashlib.sha256).digest()
    stored_key = hashlib.sha256(client_key).digest()
    server_key = hmac.new(salted, b"Server Key", hashlib.sha256).digest()
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return f"SCRAM-SHA-256${ITERATIONS}:{b64(salt)}${b64(stored_key)}:{b64(server_key)}"


def read_env(path: Path) -> dict:
    values = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip()
    return values


IDENT = re.compile(r"^[a-z_][a-z0-9_]*$")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("--env", default=str(Path(__file__).resolve().parent.parent / ".env"))
    args = ap.parse_args()

    env_path = Path(args.env)
    if not env_path.is_file():
        print(f"{env_path} not found. Copy backend/.env.example to backend/.env first.", file=sys.stderr)
        return 1
    env = read_env(env_path)

    names = {k: env.get(k, "") for k in ("MUHURTHAM_DB_SCHEMA", "MUHURTHAM_DB_APP_USER", "MUHURTHAM_DB_MIGRATE_USER")}
    for k, v in names.items():
        if not IDENT.match(v):
            print(f"{k} must be lower-case letters, digits and _ (got '{v}')", file=sys.stderr)
            return 1
    for k in ("MUHURTHAM_DB_APP_PASSWORD", "MUHURTHAM_DB_MIGRATE_PASSWORD"):
        if len(env.get(k, "")) < 16:
            print(f"{k} is missing or shorter than 16 characters in {env_path}", file=sys.stderr)
            return 1

    schema = names["MUHURTHAM_DB_SCHEMA"]
    app = names["MUHURTHAM_DB_APP_USER"]
    mig = names["MUHURTHAM_DB_MIGRATE_USER"]
    try:
        app_v = scram_verifier(env["MUHURTHAM_DB_APP_PASSWORD"])
        mig_v = scram_verifier(env["MUHURTHAM_DB_MIGRATE_PASSWORD"])
    except ValueError as ex:
        print(str(ex), file=sys.stderr)
        return 1

    print(f"""-- Muhurtham: schema and roles. Run as `postgres` (Supabase SQL editor) or a superuser.
-- Contains password verifiers, not passwords. Do not save this as a shared snippet.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{mig}') THEN
    CREATE ROLE {mig} LOGIN PASSWORD '{mig_v}';
  ELSE
    ALTER ROLE {mig} LOGIN PASSWORD '{mig_v}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{app}') THEN
    CREATE ROLE {app} LOGIN PASSWORD '{app_v}';
  ELSE
    ALTER ROLE {app} LOGIN PASSWORD '{app_v}';
  END IF;
END $$;

-- Let the current admin user hand the schema to the migration role.
GRANT {mig} TO CURRENT_USER;

CREATE SCHEMA IF NOT EXISTS {schema} AUTHORIZATION {mig};
REVOKE ALL ON SCHEMA {schema} FROM PUBLIC;
GRANT USAGE ON SCHEMA {schema} TO {app};

-- Tables and sequences the migration role creates later are usable by the app role.
ALTER DEFAULT PRIVILEGES FOR ROLE {mig} IN SCHEMA {schema}
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {app};
ALTER DEFAULT PRIVILEGES FOR ROLE {mig} IN SCHEMA {schema}
  GRANT USAGE, SELECT ON SEQUENCES TO {app};

ALTER ROLE {mig} SET search_path = {schema};
ALTER ROLE {app} SET search_path = {schema};
ALTER ROLE {app} SET statement_timeout = '15s';
ALTER ROLE {app} SET idle_in_transaction_session_timeout = '30s';

-- Check: both roles exist and can log in.
SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname IN ('{app}', '{mig}');""")
    print(f"\n-- Printed for schema '{schema}', roles '{app}' and '{mig}' from {env_path}.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
