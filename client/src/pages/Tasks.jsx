import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { getTasks, updateTask, deleteTask, getEvents } from "../services/api.js";
import TaskForm from "../components/TaskForm.jsx";

const FILTERS = ["All", "Open", "Completed", "Due Soon"];

function daysUntil(date) {
  return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    Promise.all([getTasks(), getEvents()])
      .then(([t, e]) => { setTasks(t); setEvents(e); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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

  const filtered = tasks.filter((t) => {
    if (filter === "All") return true;
    if (filter === "Open") return t.status === "open";
    if (filter === "Completed") return t.status === "completed";
    if (filter === "Due Soon") return t.due_date && t.status === "open" && daysUntil(t.due_date) <= 14;
    return true;
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
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Task</button>
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
        {filtered.map((task) => (
          <div
            key={task.id}
            className="card"
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr auto auto auto auto",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              transition: "box-shadow 0.12s",
              opacity: task.status === "completed" ? 0.72 : 1,
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--shadow-md)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = ""}
          >
            <input
              type="checkbox"
              checked={task.status === "completed"}
              onChange={() => toggleStatus(task)}
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--color-accent)" }}
            />
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
            <button className="icon-btn" title="Delete task" onClick={() => handleDelete(task)}>
              <Trash2 size={14} />
            </button>
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
