/**
 * Client-side mock/demo data.
 * All dates are computed relative to today so they never go stale.
 */

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function dateStrFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export const mockEvents = [
  {
    id: "evt-001",
    name: "Student Organization Fair",
    description: "Annual fair showcasing all student organizations on campus.",
    event_date: daysFromNow(17),
    location: "Student Union Ballroom",
    expected_attendance: 150,
    budget: 800,
    status: "planning",
    tasksTotal: 9,
    tasksDone: 4,
  },
  {
    id: "evt-002",
    name: "Fall Leadership Workshop",
    description: "Half-day workshop for all elected officers.",
    event_date: daysFromNow(34),
    location: "Admin Building Room 201",
    expected_attendance: 40,
    budget: 250,
    status: "planning",
    tasksTotal: 5,
    tasksDone: 1,
  },
  {
    id: "evt-003",
    name: "Community Service Day",
    description: "Volunteering at the local food bank with 30+ members.",
    event_date: daysFromNow(52),
    location: "Downtown Food Bank",
    expected_attendance: 35,
    budget: 100,
    status: "planning",
    tasksTotal: 6,
    tasksDone: 0,
  },
  {
    id: "evt-004",
    name: "Welcome Week Mixer",
    description: "Kickoff social event for new and returning members.",
    event_date: daysFromNow(-29),
    location: "Campus Lawn",
    expected_attendance: 80,
    budget: 400,
    status: "completed",
    tasksTotal: 7,
    tasksDone: 7,
  },
];

export const mockTasks = [
  // ── Overdue ──────────────────────────────────────────────────────────────
  {
    id: "task-000",
    event_id: "evt-001",
    title: "Submit Funding Request to Student Government",
    category: "Funding",
    assigned_to: "Alex Chen",
    due_date: dateStrFromNow(-3),      // 3 days overdue
    priority: "high",
    status: "open",
  },
  // ── Due this week (1-6 days out) ─────────────────────────────────────────
  {
    id: "task-001",
    event_id: "evt-001",
    title: "Confirm Venue Setup Requirements",
    category: "Logistics",
    assigned_to: "Alex Chen",
    due_date: dateStrFromNow(2),
    priority: "high",
    status: "open",
  },
  {
    id: "task-002",
    event_id: "evt-001",
    title: "Send Invites to Participating Organizations",
    category: "Logistics",
    assigned_to: "Jordan Lee",
    due_date: dateStrFromNow(4),
    priority: "high",
    status: "open",
  },
  {
    id: "task-003",
    event_id: "evt-001",
    title: "Draft Promotional Social Media Posts",
    category: "Promotion",
    assigned_to: "Taylor Kim",
    due_date: dateStrFromNow(6),
    priority: "medium",
    status: "open",
  },
  // ── Later ─────────────────────────────────────────────────────────────────
  {
    id: "task-004",
    event_id: "evt-001",
    title: "Recruit Volunteers for Fair Day",
    category: "Operations",
    assigned_to: "Morgan Patel",
    due_date: dateStrFromNow(10),
    priority: "medium",
    status: "open",
  },
  {
    id: "task-005",
    event_id: "evt-001",
    title: "Order Printed Banners & Signage",
    category: "Promotion",
    assigned_to: "Sam Rivera",
    due_date: dateStrFromNow(12),
    priority: "medium",
    status: "open",
  },
  // ── Completed ─────────────────────────────────────────────────────────────
  {
    id: "task-006",
    event_id: "evt-001",
    title: "Submit Event Request Form",
    category: "College Requirement",
    assigned_to: "Alex Chen",
    due_date: dateStrFromNow(-10),
    priority: "high",
    status: "completed",
  },
  {
    id: "task-007",
    event_id: "evt-001",
    title: "Reserve Student Union Ballroom",
    category: "Logistics",
    assigned_to: "Alex Chen",
    due_date: dateStrFromNow(-8),
    priority: "high",
    status: "completed",
  },
  {
    id: "task-008",
    event_id: "evt-001",
    title: "Create Event Budget Spreadsheet",
    category: "Funding",
    assigned_to: "Jordan Lee",
    due_date: dateStrFromNow(-5),
    priority: "low",
    status: "completed",
  },
];

export const mockResources = [
  { id: "res-001", name: "Student Organization Guidelines",       type: "policy",   updatedAt: "Jan 15, 2025" },
  { id: "res-002", name: "Student Government Funding Guidelines", type: "policy",   updatedAt: "Jan 15, 2025" },
  { id: "res-003", name: "Organization Constitution",             type: "document", updatedAt: "Sep 1, 2024" },
  { id: "res-004", name: "Officer Responsibilities Guide",        type: "document", updatedAt: "Feb 1, 2025" },
];

export const mockOrgHistory = {
  eventsCompleted: 8,
  lessonsRecorded: 5,
  resourcesAvailable: 4,
  recentEvent: {
    name: "Welcome Week Mixer",
    date: "Last month",
    actualAttendance: 186,
    whatWorked: ["QR code check-in system", "Early social media promotion (3 weeks ahead)"],
    challenges: ["Food quantities were insufficient — ran out 45 minutes early", "Needed more setup volunteers"],
    recommendations: [
      "Increase food quantities by at least 30% above forecast",
      "Recruit volunteers 3 weeks in advance",
      "Start promotional push earlier",
    ],
  },
};
