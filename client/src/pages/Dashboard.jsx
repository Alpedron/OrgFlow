import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Calendar,
  CheckSquare,
  FolderOpen,
  Flame,
  ClipboardList,
  Clock,
  CheckCircle2,
  LayoutDashboard,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { checkHealth, getEvents, getTasks, updateTask } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./Dashboard.css";

const SHOW_DEV = import.meta.env.VITE_SHOW_DEV_BANNER === "true";

const QUICK_ACTIONS = [
  { label: "Plan Event",      Icon: Calendar,     to: "/events",         bg: "var(--qa-plan-bg)",      color: "var(--qa-plan-icon)" },
  { label: "Assign Work",     Icon: CheckSquare,  to: "/tasks",          bg: "var(--qa-assign-bg)",    color: "var(--qa-assign-icon)" },
  { label: "Find Resources",  Icon: FolderOpen,   to: "/resources",      bg: "var(--qa-find-bg)",      color: "var(--qa-find-icon)" },
  { label: "Record Decision", Icon: ClipboardList,to: "/ask",            bg: "var(--qa-record-bg)",    color: "var(--qa-record-icon)" },
  { label: "View Deadlines",  Icon: Clock,        to: "/tasks",          bg: "var(--qa-deadlines-bg)", color: "var(--qa-deadlines-icon)" },
  { label: "Pass the Torch",  Icon: Flame,        to: "/pass-the-torch", bg: "var(--qa-torch-bg)",     color: "var(--qa-torch-icon)" },
];

const EXAMPLE_PROMPTS = [
  "Help me plan our club fair.",
  "What funding requirements should I know?",
  "What went wrong at last year's club fair?",
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function daysUntil(iso) {
  return Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function isOverdue(dateStr) {
  return dateStr && daysUntil(dateStr) < 0;
}

function isDueSoon(dateStr) {
  const d = daysUntil(dateStr);
  return d >= 0 && d <= 7;
}

// Animated count-up hook
function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return value;
}

function StatCard({ value, label, sub, subDanger, Icon, iconBg, iconColor, to, delay }) {
  const count = useCountUp(value);
  return (
    <Link
      to={to}
      className={`card card-hover stat-card anim-fade-up anim-delay-${delay}`}
      style={{ textDecoration: "none" }}
    >
      <div className="stat-icon-row">
        <div className="stat-icon" style={{ background: iconBg, color: iconColor }}>
          <Icon size={18} />
        </div>
      </div>
      <div className="stat-value count-pop">{count}</div>
      <div className="stat-label">{label}</div>
      {sub && (
        <div className="stat-sub" style={subDanger ? { color: "var(--color-danger)" } : {}}>
          {sub}
        </div>
      )}
    </Link>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const { user } = useAuth();
  const firstName = (user?.name || "").split(" ")[0] || "there";
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [apiStatus, setApiStatus] = useState("checking");

  useEffect(() => {
    if (SHOW_DEV) {
      checkHealth()
        .then(() => setApiStatus("ok"))
        .catch(() => setApiStatus("error"));
    }
    getEvents().then(setEvents).catch(() => {});
    getTasks().then(setTasks).catch(() => {});
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const upcomingEvents = events
    .filter((e) => e.status !== "completed")
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
    .slice(0, 3);

  const nextEvent = upcomingEvents[0] ?? null;
  const nextEventDays = nextEvent ? daysUntil(nextEvent.event_date) : null;

  const openTasks = tasks.filter((t) => t.status === "open");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const dueSoonTasks = openTasks
    .filter((t) => t.due_date && isDueSoon(t.due_date))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const overdueTasks = openTasks.filter((t) => isOverdue(t.due_date));

  // Dashboard shows overdue first, then due soon, then next few open tasks
  const displayTasks = [
    ...overdueTasks,
    ...dueSoonTasks.filter((t) => !isOverdue(t.due_date)),
    ...openTasks.filter((t) => !isOverdue(t.due_date) && !isDueSoon(t.due_date)),
  ].slice(0, 5);

  function handleAsk(e) {
    e.preventDefault();
    if (prompt.trim()) navigate("/ask", { state: { initialMessage: prompt.trim() } });
  }

  async function toggleTask(task) {
    const newStatus = task.status === "completed" ? "open" : "completed";
    // Optimistic update
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    try {
      await updateTask(task.id, { status: newStatus });
    } catch {
      // revert on failure
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
    }
  }

  return (
    <div className="dashboard">

      {/* API status banner — dev only */}
      {SHOW_DEV && apiStatus === "ok" && (
        <div className="status-banner status-banner--ok">
          ✓ OrgFlow API connected
        </div>
      )}
      {SHOW_DEV && apiStatus === "error" && (
        <div className="status-banner status-banner--error">
          ⚠ Cannot reach OrgFlow API — make sure the server is running on port 3001
        </div>
      )}

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <div className="greeting-row anim-fade-up">
        <div>
          <h1 className="greeting-title">{getGreeting()}, {firstName} 👋</h1>
          <div className="greeting-subtitle">
            {nextEvent ? (
              <>
                <span>Next up:</span>
                <span className="greeting-countdown">
                  <Calendar size={12} />
                  {nextEventDays === 0
                    ? "Today"
                    : nextEventDays === 1
                    ? "Tomorrow"
                    : `${nextEventDays} days`}
                  {" · "}{nextEvent.name}
                </span>
              </>
            ) : (
              <span>No upcoming events scheduled.</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Ask OrgFlow hero ──────────────────────────────────────────────── */}
      <section className="ask-hero anim-fade-up anim-delay-1">
        <div className="ask-hero-header">
          <div className="ask-hero-icon">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 style={{ fontWeight: 800 }}>Ask OrgFlow</h2>
            <p className="muted" style={{ fontSize: "0.82rem", marginTop: 2 }}>
              AI-powered planning, history &amp; advice for your organization.
            </p>
          </div>
        </div>

        <form className="ask-hero-form" onSubmit={handleAsk}>
          <input
            className="ask-hero-input"
            type="text"
            placeholder="What are you trying to accomplish?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={!prompt.trim()}>
            Ask <ArrowRight size={15} />
          </button>
        </form>

        <div className="ask-prompts">
          {EXAMPLE_PROMPTS.map((p) => (
            <button key={p} className="ask-prompt-chip" onClick={() => setPrompt(p)}>
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <section className="anim-fade-up anim-delay-2">
        <p className="section-label">Quick Actions</p>
        <div className="quick-actions">
          {QUICK_ACTIONS.map(({ label, Icon, to, bg, color }) => (
            <button key={label} className="quick-action-card" onClick={() => navigate(to)}>
              <div className="quick-action-icon-wrap" style={{ background: bg, color }}>
                <Icon size={18} />
              </div>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="stats-row anim-fade-up anim-delay-2">
        <StatCard
          value={upcomingEvents.length}
          label="Upcoming Events"
          sub={`Next: ${nextEvent ? nextEvent.name : "—"}`}
          Icon={Calendar}
          iconBg="var(--stat-events-bg)" iconColor="var(--stat-events-icon)"
          to="/events"
          delay={1}
        />
        <StatCard
          value={openTasks.length}
          label="Open Tasks"
          sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : "All on track"}
          subDanger={overdueTasks.length > 0}
          Icon={ClipboardList}
          iconBg="var(--stat-open-bg)" iconColor="var(--stat-open-icon)"
          to="/tasks"
          delay={2}
        />
        <StatCard
          value={dueSoonTasks.length}
          label="Due This Week"
          sub="Needs attention"
          Icon={Clock}
          iconBg="var(--stat-due-bg)" iconColor="var(--stat-due-icon)"
          to="/tasks"
          delay={3}
        />
        <StatCard
          value={completedTasks.length}
          label="Completed"
          sub="All time"
          Icon={CheckCircle2}
          iconBg="var(--stat-done-bg)" iconColor="var(--stat-done-icon)"
          to="/tasks"
          delay={4}
        />
      </div>

      {/* ── Pass the Torch featured card ──────────────────────────────────── */}
      <Link to="/pass-the-torch" className="torch-card anim-fade-up anim-delay-3">
        <div className="torch-card-icon">
          <Flame size={24} />
        </div>
        <div className="torch-card-body">
          <div className="torch-card-title">Pass the Torch</div>
          <div className="torch-card-desc">
            Hand off everything the next officer needs to know — past events, decisions, and lessons learned.
          </div>
        </div>
        <ChevronRight size={20} className="torch-card-arrow" />
      </Link>

      {/* ── Upcoming Events + Tasks Due Soon ──────────────────────────────── */}
      <div className="dashboard-lower anim-fade-up anim-delay-4">

        {/* Upcoming Events */}
        <section>
          <p className="section-label">Upcoming Events</p>
          <div className="card">
            {upcomingEvents.length === 0 ? (
              <p className="empty-state">No upcoming events.</p>
            ) : (
              upcomingEvents.map((evt) => {
                const days = daysUntil(evt.event_date);
                const pct = evt.tasksTotal
                  ? Math.round((evt.tasksDone / evt.tasksTotal) * 100)
                  : 0;
                return (
                  <div key={evt.id} className="event-item">
                    <div className="event-item-top">
                      <div>
                        <div className="event-item-name">{evt.name}</div>
                        <div className="event-item-meta">
                          {formatDate(evt.event_date)} · {evt.location}
                        </div>
                      </div>
                      <span className="event-item-countdown">
                        {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                      </span>
                    </div>
                    {evt.tasksTotal > 0 && (
                      <div className="progress-row">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="progress-label">
                          {evt.tasksDone}/{evt.tasksTotal} tasks
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Tasks Due Soon */}
        <section>
          <p className="section-label">Tasks Due Soon</p>
          <div className="card">
            {displayTasks.length === 0 ? (
              <p className="empty-state">No tasks due soon. 🎉</p>
            ) : (
              displayTasks.map((task) => {
                const overdue = isOverdue(task.due_date);
                const done = task.status === "completed";
                return (
                  <div key={task.id} className="task-item">
                    <input
                      type="checkbox"
                      className="task-checkbox"
                      checked={done}
                      onChange={() => toggleTask(task)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={`task-title ${done ? "task-title--done" : ""}`}>
                        {task.title}
                      </div>
                      <div className={`task-due ${overdue ? "task-due--overdue" : "task-due--normal"}`}>
                        {overdue
                          ? `Overdue · was due ${formatDate(task.due_date)}`
                          : task.due_date
                          ? `Due ${formatDate(task.due_date)}`
                          : "No due date"}
                      </div>
                      <div className="task-meta-row">
                        {overdue && !done && (
                          <span className="badge badge-overdue">Overdue</span>
                        )}
                        <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                        <span className="muted" style={{ fontSize: "0.72rem" }}>
                          {task.assigned_to}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {displayTasks.length > 0 && (
              <div style={{ paddingTop: 12, borderTop: "1px solid var(--color-border)", marginTop: 4 }}>
                <Link
                  to="/tasks"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: "4px 0", fontSize: "0.78rem" }}
                >
                  View all tasks <ChevronRight size={13} />
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

    </div>
  );
}
