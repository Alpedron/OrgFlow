/**
 * Server-side mock data for OrgFlow.
 *
 * This data is used when USE_MOCK=true (the default).
 * It mirrors the Supabase schema so switching to the real DB requires
 * no changes to service interfaces.
 */

const mockEvents = [
  {
    id: "evt-001",
    name: "Student Organization Fair",
    description: "Annual fair showcasing all student organizations on campus.",
    event_date: "2026-10-20T17:00:00.000Z",
    location: "Student Union Ballroom",
    expected_attendance: 150,
    budget: 800,
    status: "planning",
    created_at: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "evt-002",
    name: "Welcome Week Mixer",
    description: "Kickoff social event for new and returning members.",
    event_date: "2026-09-05T18:00:00.000Z",
    location: "Campus Lawn",
    expected_attendance: 80,
    budget: 400,
    status: "completed",
    created_at: "2026-07-15T09:00:00.000Z",
  },
];

const mockTasks = [
  // Student Organization Fair tasks
  {
    id: "task-001",
    event_id: "evt-001",
    title: "Submit Event Request Form",
    category: "College Requirement",
    assigned_to: "Alex Chen",
    due_date: "2026-09-20",
    priority: "high",
    status: "completed",
    created_at: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "task-002",
    event_id: "evt-001",
    title: "Reserve Student Union Ballroom",
    category: "Logistics",
    assigned_to: "Alex Chen",
    due_date: "2026-09-22",
    priority: "high",
    status: "completed",
    created_at: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "task-003",
    event_id: "evt-001",
    title: "Submit Funding Request to Student Government",
    category: "Funding",
    assigned_to: "Jordan Lee",
    due_date: "2026-09-25",
    priority: "high",
    status: "open",
    created_at: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "task-004",
    event_id: "evt-001",
    title: "Contact Participating Organizations",
    category: "Logistics",
    assigned_to: "Sam Rivera",
    due_date: "2026-10-01",
    priority: "high",
    status: "open",
    created_at: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "task-005",
    event_id: "evt-001",
    title: "Create Promotional Materials",
    category: "Promotion",
    assigned_to: "Taylor Kim",
    due_date: "2026-10-05",
    priority: "medium",
    status: "open",
    created_at: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "task-006",
    event_id: "evt-001",
    title: "Recruit Volunteers",
    category: "Operations",
    assigned_to: "Morgan Patel",
    due_date: "2026-10-08",
    priority: "medium",
    status: "open",
    created_at: "2026-08-01T10:00:00.000Z",
  },
  // Welcome Week tasks (completed event)
  {
    id: "task-007",
    event_id: "evt-002",
    title: "Reserve Campus Lawn",
    category: "Logistics",
    assigned_to: "Alex Chen",
    due_date: "2026-08-20",
    priority: "high",
    status: "completed",
    created_at: "2026-07-15T09:00:00.000Z",
  },
  {
    id: "task-008",
    event_id: "evt-002",
    title: "Order Food & Drinks",
    category: "Logistics",
    assigned_to: "Jordan Lee",
    due_date: "2026-08-25",
    priority: "high",
    status: "completed",
    created_at: "2026-07-15T09:00:00.000Z",
  },
];

const mockEventReports = [
  {
    id: "report-001",
    event_id: "evt-002",
    actual_attendance: 186,
    actual_spending: 520,
    what_worked: "QR check-in worked extremely well and reduced entry wait times. Early social media promotion (3 weeks ahead) drove strong turnout.",
    what_went_wrong: "Food quantities were insufficient — ran out 45 minutes before the event ended. More volunteers were needed for setup.",
    recommendations: "Increase food quantities by at least 30% above forecast. Recruit volunteers 3 weeks in advance. Start promotion earlier.",
    created_at: "2026-09-06T10:00:00.000Z",
  },
];

module.exports = { mockEvents, mockTasks, mockEventReports };
