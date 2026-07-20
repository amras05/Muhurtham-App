import sqlite3
import os
import uuid
from datetime import datetime

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "muhurtham.db"
)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Create sqlite tables if they do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # ─── Users Table ───────────────────────────────────────
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        name TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        is_verified INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        last_login_at TEXT,
        login_count INTEGER DEFAULT 0
    )
    """)
    
    # ─── OTP Codes Table ───────────────────────────────────
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS otp_codes (
        phone TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL
    )
    """)
    
    # ─── Activity Logs Table ───────────────────────────────
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    conn.close()

# Initialize tables immediately
init_db()

# ─── DB Access Helpers ─────────────────────────────────────

def get_user_by_phone(phone: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE phone = ?", (phone,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_id(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_user(phone: str, password_hash: str, name: str = None, role: str = "user", is_verified: bool = False) -> dict:
    user_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "INSERT INTO users (id, phone, name, password_hash, role, is_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, phone, name, password_hash, role, 1 if is_verified else 0, created_at)
    )
    conn.commit()
    conn.close()
    return {
        "id": user_id,
        "phone": phone,
        "name": name,
        "role": role,
        "is_verified": is_verified,
        "is_active": True,
        "created_at": created_at,
        "login_count": 0
    }

def update_user_profile(user_id: str, fields: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Dynamically build query parameters
    set_clauses = []
    values = []
    for key, val in fields.items():
        set_clauses.append(f"{key} = ?")
        values.append(val)
        
    values.append(user_id)
    query = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ?"
    
    cursor.execute(query, tuple(values))
    conn.commit()
    conn.close()

def log_login_event(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "UPDATE users SET last_login_at = ?, login_count = login_count + 1 WHERE id = ?",
        (now, user_id)
    )
    conn.commit()
    conn.close()

def store_otp(phone: str, code: str, expires_at: datetime):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO otp_codes (phone, code, expires_at) VALUES (?, ?, ?)",
        (phone, code, expires_at.isoformat())
    )
    conn.commit()
    conn.close()

def get_otp(phone: str) -> dict | None:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM otp_codes WHERE phone = ?", (phone,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_otp(phone: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM otp_codes WHERE phone = ?", (phone,))
    conn.commit()
    conn.close()

def write_activity_log(user_id: str, action: str, details: str = None, ip_address: str = None):
    log_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO activity_logs (id, user_id, action, details, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        (log_id, user_id, action, details, ip_address, timestamp)
    )
    conn.commit()
    conn.close()

# ─── Admin Fetch Helpers ───────────────────────────────────

def fetch_all_users(search: str = None, role: str = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT id, phone, name, role, is_verified, is_active, created_at, last_login_at, login_count FROM users"
    conditions = []
    params = []
    
    if search:
        conditions.append("(phone LIKE ? OR name LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])
    if role:
        conditions.append("role = ?")
        params.append(role)
        
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
        
    query += " ORDER BY created_at DESC"
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def fetch_activity_logs(user_id: str = None, limit: int = 50):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT l.*, u.phone as user_name 
        FROM activity_logs l
        JOIN users u ON l.user_id = u.id
    """
    params = []
    if user_id:
        query += " WHERE l.user_id = ?"
        params.append(user_id)
        
    query += " ORDER BY l.timestamp DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def fetch_system_statistics():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    stats = {}
    
    # User counts
    cursor.execute("SELECT COUNT(*) FROM users")
    stats["total_users"] = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM users WHERE is_active = 1")
    stats["active_users"] = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM users WHERE is_verified = 1")
    stats["verified_users"] = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
    stats["admin_users"] = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'super_admin'")
    stats["super_admin_users"] = cursor.fetchone()[0]
    
    # Log counts
    cursor.execute("SELECT COUNT(*) FROM activity_logs")
    stats["total_logs"] = cursor.fetchone()[0]
    
    conn.close()
    return stats
