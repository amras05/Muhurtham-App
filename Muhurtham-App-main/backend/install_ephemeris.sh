#!/usr/bin/env bash
# Installs the real Swiss Ephemeris (.se1) data files that PyJHora needs but
# does NOT ship in its PyPI package (a known limitation since v3.6.6 — see
# https://github.com/naturalstupid/PyJHora#readme). Without these files,
# PyJHora silently falls back to a lower-precision approximation for most
# calculations, and some functions (e.g. the Souramana/solar calendar type)
# fail outright with a missing-file error.
#
# Run this once, after `pip install -r requirements.txt`, with the same
# Python environment (venv) activated.

set -e

PY_EPHE_DIR=$(python3 -c "import jhora, os; print(os.path.join(os.path.dirname(jhora.__file__), 'data', 'ephe'))")

if [ -z "$PY_EPHE_DIR" ]; then
    echo "Could not locate the installed jhora package. Is your venv activated?"
    exit 1
fi

echo "PyJHora ephemeris folder: $PY_EPHE_DIR"

EXISTING_SE1_COUNT=$(find "$PY_EPHE_DIR" -maxdepth 1 -name "*.se1" 2>/dev/null | wc -l)
if [ "$EXISTING_SE1_COUNT" -ge 90 ]; then
    echo "Found $EXISTING_SE1_COUNT .se1 files already — looks like this is already installed. Nothing to do."
    exit 0
fi

echo "Found only $EXISTING_SE1_COUNT .se1 files (expected ~100) — downloading the real data (~104MB)..."

TMP_DIR=$(mktemp -d)
git clone --depth 1 https://github.com/naturalstupid/PyJHora.git "$TMP_DIR/PyJHora"

cp "$TMP_DIR/PyJHora/src/jhora/data/ephe"/*.se1 "$PY_EPHE_DIR/"

rm -rf "$TMP_DIR"

NEW_COUNT=$(find "$PY_EPHE_DIR" -maxdepth 1 -name "*.se1" | wc -l)
echo "Done. $NEW_COUNT .se1 files now installed in $PY_EPHE_DIR"
