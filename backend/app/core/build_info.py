"""
When this copy of the app was last updated (user, 21 Nov 2026): shown in every page's footer, in /health and
on the super admin's System page.

On the server the deploy workflow writes backend/build_info.json after pulling main:
    {"commit": "<full sha>", "committed_at": "<ISO time>", "deployed_at": "<ISO time>"}
Without that file (a developer's machine) the last commit's time is read from Git. Read once per process:
every deploy restarts the app, so the value is always the running version's.
"""
import json
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional

from app.core.logging import logger

BACKEND_DIR = Path(__file__).resolve().parents[2]
BUILD_FILE = BACKEND_DIR / "build_info.json"


@lru_cache(maxsize=1)
def build_info() -> Dict[str, Optional[str]]:
    """{commit: short sha, committed_at, deployed_at} as ISO strings; None where unknown."""
    if BUILD_FILE.exists():
        try:
            d = json.loads(BUILD_FILE.read_text(encoding="utf-8"))
            return {"commit": (str(d.get("commit") or "")[:7] or None),
                    "committed_at": d.get("committed_at") or None,
                    "deployed_at": d.get("deployed_at") or None}
        except (OSError, ValueError) as ex:
            logger.warning(f"build_info.json unreadable, falling back to Git: {type(ex).__name__}")
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%h|%cI"], cwd=BACKEND_DIR,
                             capture_output=True, text=True, timeout=3)
        if out.returncode == 0 and "|" in out.stdout:
            commit, when = out.stdout.strip().split("|", 1)
            return {"commit": commit or None, "committed_at": when or None, "deployed_at": None}
        logger.warning("Last commit time not available from Git")
    except (OSError, subprocess.SubprocessError) as ex:
        logger.warning(f"Git not available for the build time: {type(ex).__name__}")
    return {"commit": None, "committed_at": None, "deployed_at": None}
