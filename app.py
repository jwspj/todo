from flask import Flask, request, jsonify, render_template
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "todos.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                priority TEXT DEFAULT 'medium',
                due_date TEXT DEFAULT '',
                completed INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()


def todo_to_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "priority": row["priority"],
        "due_date": row["due_date"],
        "completed": bool(row["completed"]),
        "created_at": row["created_at"],
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/todos", methods=["GET"])
def get_todos():
    status = request.args.get("status", "all")
    priority = request.args.get("priority", "all")
    search = request.args.get("search", "").strip()

    query = "SELECT * FROM todos WHERE 1=1"
    params = []

    if status == "active":
        query += " AND completed = 0"
    elif status == "completed":
        query += " AND completed = 1"

    if priority != "all":
        query += " AND priority = ?"
        params.append(priority)

    if search:
        query += " AND (title LIKE ? OR description LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY completed ASC, CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, created_at DESC"

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    return jsonify([todo_to_dict(r) for r in rows])


@app.route("/api/todos", methods=["POST"])
def create_todo():
    data = request.get_json()
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "タイトルは必須です"}), 400

    description = (data.get("description") or "").strip()
    priority = data.get("priority", "medium")
    if priority not in ("high", "medium", "low"):
        priority = "medium"
    due_date = (data.get("due_date") or "").strip()
    created_at = datetime.now().isoformat()

    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO todos (title, description, priority, due_date, created_at) VALUES (?, ?, ?, ?, ?)",
            (title, description, priority, due_date, created_at),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM todos WHERE id = ?", (cursor.lastrowid,)).fetchone()

    return jsonify(todo_to_dict(row)), 201


@app.route("/api/todos/<int:todo_id>", methods=["PUT"])
def update_todo(todo_id):
    data = request.get_json()

    with get_db() as conn:
        row = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()
        if not row:
            return jsonify({"error": "見つかりません"}), 404

        title = (data.get("title") or row["title"]).strip() or row["title"]
        description = data.get("description", row["description"])
        priority = data.get("priority", row["priority"])
        if priority not in ("high", "medium", "low"):
            priority = row["priority"]
        due_date = data.get("due_date", row["due_date"])
        completed = int(data.get("completed", row["completed"]))

        conn.execute(
            "UPDATE todos SET title=?, description=?, priority=?, due_date=?, completed=? WHERE id=?",
            (title, description, priority, due_date, completed, todo_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone()

    return jsonify(todo_to_dict(updated))


@app.route("/api/todos/<int:todo_id>", methods=["DELETE"])
def delete_todo(todo_id):
    with get_db() as conn:
        row = conn.execute("SELECT id FROM todos WHERE id = ?", (todo_id,)).fetchone()
        if not row:
            return jsonify({"error": "見つかりません"}), 404
        conn.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
        conn.commit()

    return jsonify({"message": "削除しました"})


@app.route("/api/todos/clear-completed", methods=["DELETE"])
def clear_completed():
    with get_db() as conn:
        conn.execute("DELETE FROM todos WHERE completed = 1")
        conn.commit()
    return jsonify({"message": "完了済みを削除しました"})


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5001)
