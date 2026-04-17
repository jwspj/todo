const API = "/api/todos";

let state = {
  status: "all",
  priority: "all",
  search: "",
};

// ── Fetch & render ──────────────────────────────────────────────
async function loadTodos() {
  const params = new URLSearchParams({
    status: state.status,
    priority: state.priority,
    search: state.search,
  });
  const res = await fetch(`${API}?${params}`);
  const todos = await res.json();
  renderStats(todos);
  renderList(todos);
}

function renderStats(todos) {
  const total = todos.length;
  const done = todos.filter(t => t.completed).length;
  const active = total - done;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-active").textContent = active;
  document.getElementById("stat-done").textContent = done;
}

function renderList(todos) {
  const list = document.getElementById("todo-list");
  const count = document.getElementById("todo-count");
  count.textContent = `${todos.length} 件`;

  if (todos.length === 0) {
    list.innerHTML = `<div class="empty"><div class="icon">📋</div><p>タスクがありません</p></div>`;
    return;
  }

  list.innerHTML = todos.map(t => todoHTML(t)).join("");
  attachItemEvents();
}

function priorityLabel(p) {
  return { high: "高", medium: "中", low: "低" }[p] || p;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function dueDateClass(due, completed) {
  if (!due || completed) return "";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  if (d < today) return "due-overdue";
  const diff = (d - today) / 86400000;
  if (diff <= 2) return "due-soon";
  return "";
}

function todoHTML(t) {
  const cls = dueDateClass(t.due_date, t.completed);
  const dueLabel = t.due_date
    ? `<span class="${cls}">📅 ${formatDate(t.due_date)}${cls === "due-overdue" ? " 期限切れ" : ""}</span>`
    : "";
  const created = new Date(t.created_at).toLocaleDateString("ja-JP");

  return `
  <div class="todo-item priority-${t.priority} ${t.completed ? "completed" : ""}" data-id="${t.id}">
    <div class="checkbox-wrap">
      <input type="checkbox" id="cb-${t.id}" ${t.completed ? "checked" : ""}>
      <label for="cb-${t.id}">✓</label>
    </div>
    <div class="todo-body">
      <div class="todo-header-row">
        <span class="todo-title">${escHtml(t.title)}</span>
        <span class="badge badge-${t.priority}">${priorityLabel(t.priority)}</span>
      </div>
      ${t.description ? `<div class="todo-desc">${escHtml(t.description)}</div>` : ""}
      <div class="todo-meta">
        ${dueLabel}
        <span>🕐 ${created}</span>
      </div>
      <div class="edit-form" id="edit-${t.id}">
        <input type="text" class="edit-title" value="${escAttr(t.title)}" placeholder="タイトル">
        <textarea class="edit-desc" placeholder="詳細">${escHtml(t.description)}</textarea>
        <div class="edit-row">
          <select class="edit-priority">
            <option value="high" ${t.priority === "high" ? "selected" : ""}>高</option>
            <option value="medium" ${t.priority === "medium" ? "selected" : ""}>中</option>
            <option value="low" ${t.priority === "low" ? "selected" : ""}>低</option>
          </select>
          <input type="date" class="edit-due" value="${t.due_date || ""}">
        </div>
        <div class="edit-actions">
          <button class="btn btn-ghost btn-cancel-edit" data-id="${t.id}">キャンセル</button>
          <button class="btn btn-primary btn-save-edit" data-id="${t.id}">保存</button>
        </div>
      </div>
    </div>
    <div class="todo-actions">
      <button class="icon-btn edit btn-edit" data-id="${t.id}" title="編集">✏️</button>
      <button class="icon-btn delete btn-delete" data-id="${t.id}" title="削除">🗑️</button>
    </div>
  </div>`;
}

function attachItemEvents() {
  document.querySelectorAll('[id^="cb-"]').forEach(cb => {
    cb.addEventListener("change", () => toggleTodo(parseInt(cb.id.replace("cb-", "")), cb.checked));
  });
  document.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", () => deleteTodo(parseInt(btn.dataset.id)));
  });
  document.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => toggleEdit(parseInt(btn.dataset.id)));
  });
  document.querySelectorAll(".btn-cancel-edit").forEach(btn => {
    btn.addEventListener("click", () => toggleEdit(parseInt(btn.dataset.id), false));
  });
  document.querySelectorAll(".btn-save-edit").forEach(btn => {
    btn.addEventListener("click", () => saveEdit(parseInt(btn.dataset.id)));
  });
}

// ── CRUD ───────────────────────────────────────────────────────
async function createTodo() {
  const title = document.getElementById("new-title").value.trim();
  if (!title) { toast("タイトルを入力してください", "error"); return; }

  const body = {
    title,
    description: document.getElementById("new-desc").value.trim(),
    priority: document.getElementById("new-priority").value,
    due_date: document.getElementById("new-due").value,
  };

  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    document.getElementById("new-title").value = "";
    document.getElementById("new-desc").value = "";
    document.getElementById("new-priority").value = "medium";
    document.getElementById("new-due").value = "";
    toast("タスクを追加しました", "success");
    loadTodos();
  } else {
    const err = await res.json();
    toast(err.error || "エラーが発生しました", "error");
  }
}

async function toggleTodo(id, completed) {
  await fetch(`${API}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  loadTodos();
}

async function deleteTodo(id) {
  await fetch(`${API}/${id}`, { method: "DELETE" });
  toast("削除しました", "success");
  loadTodos();
}

function toggleEdit(id, show = null) {
  const form = document.getElementById(`edit-${id}`);
  if (!form) return;
  const visible = show !== null ? show : !form.classList.contains("visible");
  form.classList.toggle("visible", visible);
}

async function saveEdit(id) {
  const form = document.getElementById(`edit-${id}`);
  const title = form.querySelector(".edit-title").value.trim();
  if (!title) { toast("タイトルを入力してください", "error"); return; }

  const body = {
    title,
    description: form.querySelector(".edit-desc").value.trim(),
    priority: form.querySelector(".edit-priority").value,
    due_date: form.querySelector(".edit-due").value,
  };

  const res = await fetch(`${API}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    toast("更新しました", "success");
    loadTodos();
  } else {
    toast("更新に失敗しました", "error");
  }
}

async function clearCompleted() {
  await fetch(`${API}/clear-completed`, { method: "DELETE" });
  toast("完了済みを削除しました", "success");
  loadTodos();
}

// ── Filters ───────────────────────────────────────────────────
function setStatus(v) {
  state.status = v;
  document.querySelectorAll(".chip-status").forEach(c => c.classList.toggle("active", c.dataset.v === v));
  loadTodos();
}
function setPriority(v) {
  state.priority = v;
  document.querySelectorAll(".chip-priority").forEach(c => c.classList.toggle("active", c.dataset.v === v));
  loadTodos();
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = "success") {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ── Utils ─────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escAttr(str) { return escHtml(str); }

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadTodos();

  document.getElementById("btn-add").addEventListener("click", createTodo);
  document.getElementById("new-title").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); createTodo(); }
  });

  document.querySelectorAll(".chip-status").forEach(c => {
    c.addEventListener("click", () => setStatus(c.dataset.v));
  });
  document.querySelectorAll(".chip-priority").forEach(c => {
    c.addEventListener("click", () => setPriority(c.dataset.v));
  });

  let searchTimer;
  document.getElementById("search").addEventListener("input", e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = e.target.value; loadTodos(); }, 250);
  });

  document.getElementById("btn-clear-completed").addEventListener("click", clearCompleted);
});
