import { useState, useEffect } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { getTasks, updateTask, deleteTask, getEvents } from "../services/api.js";
import TaskForm from "../components/TaskForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const FILTERS = ["All", "Open", "Completed", "Due Soon"];
const SORT_OPTIONS = [
  { value: "manual", label: "Manual order" },
  { value: "due_date", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
  { value: "created_at", label: "Created date" },
];

function daysUntil(date) {
  return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [sortBy, setSortBy] = useState("manual");
  const [sortOpen, setSortOpen] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    Promise.all([getTasks(undefined, user?.isAdmin ? "all" : "role"), getEvents()])
      .then(([t, e]) => {
        const storedOrder = user?.org?.id
          ? JSON.parse(localStorage.getItem(`orgflow-task-order-${user.org.id}`) || "[]")
          : [];
        const orderMap = new Map(storedOrder.map((id, index) => [id, index]));
        const orderedTasks = [...t].sort((a, b) =>
          (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER)
        );
        setTasks(orderedTasks);
        setEvents(e);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user?.isAdmin, user?.org?.id]);

  const eventName = (id) => events.find((e) => e.id === id)?.name;

  async function toggleStatus(task) {
    const newStatus = task.status === "completed" ? "open" : "completed";
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    try {
      await updateTask(task.id, { status: newStatus });
    } catch (err) {
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
      alert(`Couldn't update the task: ${err.message}`);
    }
  }

  async function handleDelete(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await deleteTask(task.id);
      setTasks((ts) => ts.filter((t) => t.id !== task.id));
    } catch (err) {
      alert(`Couldn't delete the task: ${err.message}`);
    }
  }

  function persistManualOrder(nextTasks) {
    setTasks(nextTasks);
    if (user?.org?.id) {
      localStorage.setItem(`orgflow-task-order-${user.org.id}`, JSON.stringify(nextTasks.map((task) => task.id)));
    }
  }

  function handleDrop(targetId) {
    if (!user?.isAdmin || !draggedId || draggedId === targetId) return;
    const draggedIndex = tasks.findIndex((task) => task.id === draggedId);
    const targetIndex = tasks.findIndex((task) => task.id === targetId);
    if (draggedIndex < 0 || targetIndex < 0) return;
    const next = [...tasks];
    const [moved] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, moved);
    persistManualOrder(next);
  }

  const roleNames = Array.from(new Set((tasks.map((t) => t.assigned_to)).filter(Boolean)));
  const filtered = tasks
    .filter((t) => {
      if (filter === "All") return true;
      if (filter === "Open") return t.status === "open";
      if (filter === "Completed") return t.status === "completed";
      if (filter === "Due Soon") return t.due_date && t.status === "open" && daysUntil(t.due_date) <= 14;
      return true;
    })
    .filter((t) => roleFilter === "All" || t.assigned_to === roleFilter);

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "due_date") return new Date(a.due_date || "9999-12-31") - new Date(b.due_date || "9999-12-31");
    if (sortBy === "priority") {
      const priority = { high: 0, medium: 1, low: 2 };
      return (priority[a.priority] ?? 3) - (priority[b.priority] ?? 3);
    }
    if (sortBy === "status") return String(a.status).localeCompare(String(b.status));
    if (sortBy === "created_at") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    const order = new Map(tasks.map((task, index) => [task.id, index]));
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Page header */}
      <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
        <div>
          <h1>Tasks</h1>
          <p className="muted" style={{ marginTop: 3, fontSize: "0.85rem" }}>
            Assign and track work across all your events.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!user?.isAdmin && <span className="badge badge-neutral">Read-only view</span>}
          {user?.isAdmin && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Task</button>}
        </div>
      </div>

      {/* Filter strip */}
      <div
        className="flex gap-2"
        style={{
          margin: "18px 0 16px",
          padding: "12px 14px",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border-light)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <select
          className="select btn-sm"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter tasks by assigned role"
          style={{ maxWidth: 180 }}
        >
          <option value="All">All roles</option>
          {roleNames.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <div style={{ position: "relative" }}>
          <button
            className={`btn btn-sm ${sortBy !== "manual" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSortOpen((open) => !open)}
            aria-expanded={sortOpen}
          >
            Sort: {SORT_OPTIONS.find((option) => option.value === sortBy)?.label || "Manual order"}
          </button>
          {sortOpen && (
            <div className="card" style={{ position: "absolute", zIndex: 5, top: "calc(100% + 8px)", right: 0, minWidth: 180, padding: 8 }}>
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`btn btn-sm ${sortBy === option.value ? "btn-primary" : "btn-secondary"}`}
                  style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 4 }}
                  onClick={() => { setSortBy(option.value); setSortOpen(false); }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="muted" style={{ marginLeft: "auto", fontSize: "0.8rem", alignSelf: "center" }}>
          {filtered.length} task{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {error && <p className="form-error">Couldn't load tasks: {error}</p>}
        {loading && <p className="muted">Loading tasks…</p>}
        {!loading && !error && tasks.length === 0 && (
          <div className="empty-box">
            <p>No tasks yet. Add one, or ask OrgFlow to suggest a plan.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ New Task</button>
          </div>
        )}
        {!loading && tasks.length > 0 && filtered.length === 0 && (
          <p className="muted" style={{ padding: "20px 0" }}>No tasks match this filter.</p>
        )}
        {sorted.map((task) => (
          <div
            key={task.id}
            draggable={user?.isAdmin}
            onDragStart={() => setDraggedId(task.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(task.id)}
            onDragEnd={() => setDraggedId(null)}
            className="card"
            style={{
              display: "grid",
              gridTemplateColumns: "20px 28px 1fr auto auto auto auto",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              transition: "box-shadow 0.12s",
              opacity: task.status === "completed" ? 0.72 : 1,
              cursor: user?.isAdmin ? "grab" : "default",
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--shadow-md)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = ""}
          >
            {user?.isAdmin && <GripVertical size={15} className="muted" />}

            {user?.isAdmin ? (
              <input
                type="checkbox"
                checked={task.status === "completed"}
                onChange={() => toggleStatus(task)}
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--color-accent)" }}
              />
            ) : <span className="muted">•</span>}
            <div>
              <span style={{
                fontWeight: 600,
                fontSize: "0.875rem",
                textDecoration: task.status === "completed" ? "line-through" : "none",
                color: task.status === "completed" ? "var(--color-muted)" : "inherit",
              }}>
                {task.title}
              </span>
              <p className="muted" style={{ fontSize: "0.78rem", marginTop: 1 }}>
                {[eventName(task.event_id), task.category, task.assigned_to].filter(Boolean).join(" · ") || "No details"}
              </p>
            </div>
            <span className="muted" style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
              {task.due_date ? formatDate(task.due_date) : "—"}
            </span>
            <span className={`badge badge-${task.priority}`}>{task.priority}</span>
            <span className={`badge badge-${task.status}`}>{task.status}</span>
            {user?.isAdmin && (
              <button className="icon-btn" title="Delete task" onClick={() => handleDelete(task)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <TaskForm
          events={events}
          onClose={() => setShowForm(false)}
          onSaved={(t) => setTasks((ts) => [...ts, t])}
        />
      )}
    </div>
  );
}
