import sqlite3
from datetime import datetime

DB_NAME = "chat_logs.db"


def init_db():
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS chat_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        attack_type TEXT,
        risk_score INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )
    """)

    conn.commit()
    conn.close()


def save_message(conversation_id, role, content, attack_type=None, risk_score=0):
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO chat_logs
    (conversation_id, role, content, attack_type, risk_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (
        conversation_id,
        role,
        content,
        attack_type,
        risk_score,
        datetime.now().isoformat()
    ))

    conn.commit()
    conn.close()


def get_history(conversation_id, limit=10):
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
    SELECT role, content
    FROM chat_logs
    WHERE conversation_id = ?
    ORDER BY id DESC
    LIMIT ?
    """, (conversation_id, limit))

    rows = cur.fetchall()
    conn.close()

    rows.reverse()

    return [
        {
            "role": role,
            "content": content
        }
        for role, content in rows
    ]