"""
Loads backend/.env into the process environment (standard library only).

Values already set in the real environment win, so Docker / the server's environment
always override the file. Lines are KEY=VALUE; blank lines and # comments are skipped;
surrounding single or double quotes are removed. Values are never logged.
"""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_ENV_FILE = BACKEND_DIR / ".env"


def load_env_file(path: Path = DEFAULT_ENV_FILE) -> int:
    """Set variables from `path` that are not already set. Returns how many were set."""
    if not path.is_file():
        return 0
    count = 0
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key.startswith("export "):
            key = key[len("export "):].strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        if key and key not in os.environ:
            os.environ[key] = value
            count += 1
    return count
