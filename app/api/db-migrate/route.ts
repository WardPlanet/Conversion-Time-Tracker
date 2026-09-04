import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "MIGRATE_SECRET not configured." }, { status: 500 });
  }
  if (request.headers.get("x-migrate-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await runMigration();
    return NextResponse.json({ ok: true, message: "Migration complete." });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runMigration() {
  // ── Create tables ──────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      product_line TEXT NOT NULL,
      color TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      project_id TEXT NOT NULL,
      bcc_email TEXT NOT NULL DEFAULT '',
      notes TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS offices (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      completed BOOLEAN
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      trainer_id TEXT NOT NULL,
      title TEXT NOT NULL,
      billable BOOLEAN NOT NULL DEFAULT true,
      status TEXT NOT NULL DEFAULT 'not_started'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      trainer_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      office_id TEXT NOT NULL,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT NOT NULL,
      billable TEXT NOT NULL DEFAULT 'billable',
      billable_set_by_admin BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      status_changed_at TEXT NOT NULL,
      rejection_reason TEXT,
      cancellation_reason TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS time_clock_events (
      id TEXT PRIMARY KEY,
      trainer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      manually_logged BOOLEAN
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS task_entries (
      id TEXT PRIMARY KEY,
      trainer_id TEXT NOT NULL,
      date TEXT NOT NULL,
      project_id TEXT NOT NULL,
      office TEXT NOT NULL,
      task_id TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      hours NUMERIC NOT NULL,
      location TEXT,
      booking_id TEXT,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS favorite_tasks (
      id TEXT PRIMARY KEY,
      trainer_id TEXT NOT NULL,
      task_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS flag_thresholds (
      id INTEGER PRIMARY KEY,
      unsubmitted_task_tracker_days INTEGER NOT NULL DEFAULT 3,
      pending_booking_unanswered_hours INTEGER NOT NULL DEFAULT 48,
      inactive_trainer_days INTEGER NOT NULL DEFAULT 5
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS flag_records (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      signature TEXT NOT NULL,
      trainer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      related_booking_id TEXT,
      related_project_id TEXT,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      dismissed_at TEXT,
      dismissed_by_note TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS weekly_submissions (
      id TEXT PRIMARY KEY,
      trainer_id TEXT NOT NULL,
      week_start_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      submitted_at TEXT,
      reviewed_at TEXT,
      reviewed_by_admin_id TEXT,
      rejection_reason TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS timesheet_submissions (
      id TEXT PRIMARY KEY,
      trainer_id TEXT NOT NULL,
      week_start_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      submitted_at TEXT,
      reviewed_at TEXT,
      reviewed_by_admin_id TEXT,
      rejection_reason TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      recipient_role TEXT NOT NULL,
      message TEXT NOT NULL,
      related_trainer_id TEXT,
      related_entity_id TEXT,
      read BOOLEAN NOT NULL DEFAULT false,
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clock_correction_requests (
      id TEXT PRIMARY KEY,
      trainer_id TEXT NOT NULL,
      original_event_id TEXT NOT NULL,
      original_timestamp TEXT NOT NULL,
      requested_timestamp TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS manual_session_requests (
      id TEXT PRIMARY KEY,
      trainer_id TEXT NOT NULL,
      date TEXT NOT NULL,
      clock_in TEXT NOT NULL,
      clock_out TEXT NOT NULL,
      breaks JSONB NOT NULL DEFAULT '[]',
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      created_event_ids JSONB
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      trainer_id TEXT NOT NULL,
      project_id TEXT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by_admin_id TEXT,
      receipt_url TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS unavailability_blocks (
      id TEXT PRIMARY KEY,
      trainer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      start_time TEXT,
      end_time TEXT,
      recurring_day_of_week INTEGER,
      reason TEXT,
      created_at TEXT NOT NULL
    )
  `;

  // ── Seed data ──────────────────────────────────────────────────────────────

  // Users
  const [
    adminHash,
    ccHash,
    daHash,
    ljHash,
    jsmithHash,
    rleeHash,
  ] = await Promise.all([
    hashPassword("admin123"),
    hashPassword("Welcome1!"),
    hashPassword("Welcome1!"),
    hashPassword("Welcome1!"),
    hashPassword("trainer123"),
    hashPassword("trainer123"),
  ]);

  await sql`
    INSERT INTO users (id, role, username, password_hash, name, email, active) VALUES
      ('user-admin',         'admin',   'admin',                          ${adminHash}, 'Admin',              'admin@planetdds.com',               true),
      ('user-cclark',        'admin',   'carla.clark@planetdds.com',      ${ccHash},   'Carla Clark',         'carla.clark@planetdds.com',         true),
      ('user-darechavaleta', 'admin',   'denise.arechavaleta@planetdds.com', ${daHash},'Denise Arechavaleta', 'denise.arechavaleta@planetdds.com', true),
      ('user-ljaquin',       'admin',   'lenore.jaquin@planetdds.com',    ${ljHash},   'Lenore Jaquin',       'lenore.jaquin@planetdds.com',       true),
      ('user-jsmith',        'trainer', 'jsmith',                         ${jsmithHash},'Jordan Smith',       'jordan.smith@example.com',          true),
      ('user-rlee',          'trainer', 'rlee',                           ${rleeHash}, 'Riley Lee',           'riley.lee@example.com',             true)
    ON CONFLICT (id) DO NOTHING
  `;

  // Projects
  await sql`
    INSERT INTO projects (id, name, product_line, color, status, project_id, bcc_email, notes) VALUES
      ('proj-1', 'Project #1', 'cloud9',         '#0F6CBD', 'active', 'PROJ-001', 'test1@example.com', 'Client prefers morning sessions; primary contact is the office manager.'),
      ('proj-2', 'Project #2', 'denticon',        '#2E9E5B', 'active', 'PROJ-002', 'test2@example.com', null),
      ('proj-3', 'Project #3', 'denticon',        '#D97706', 'active', 'PROJ-003', 'test3@example.com', null),
      ('proj-4', 'Project #4', 'cloud9',          '#DB2777', 'active', 'PROJ-004', 'test4@example.com', null)
    ON CONFLICT (id) DO NOTHING
  `;

  // Offices
  await sql`
    INSERT INTO offices (id, project_id, name, active) VALUES
      ('office-1a', 'proj-1', '10001', true),
      ('office-1b', 'proj-1', '10002', true),
      ('office-2a', 'proj-2', '20001', true),
      ('office-3a', 'proj-3', '30001', true),
      ('office-4a', 'proj-4', '40001', true)
    ON CONFLICT (id) DO NOTHING
  `;

  // Tasks — 4 projects × 2 trainers × 5 standard tasks = 40 rows
  // STANDARD_TASKS order: On-Site Training (T), Virtual Customer Support (F),
  //   On-Site Customer Support (T), On-Site Customer Support (F), Virtual Training (T)
  await sql`
    INSERT INTO tasks (id, project_id, trainer_id, title, billable, status) VALUES
      -- proj-1, jsmith
      ('task-p1-t1-1','proj-1','user-jsmith','On-Site Training',true,'not_started'),
      ('task-p1-t1-2','proj-1','user-jsmith','Virtual Customer Support',false,'not_started'),
      ('task-p1-t1-3','proj-1','user-jsmith','On-Site Customer Support',true,'not_started'),
      ('task-p1-t1-4','proj-1','user-jsmith','On-Site Customer Support',false,'not_started'),
      ('task-p1-t1-5','proj-1','user-jsmith','Virtual Training',true,'not_started'),
      -- proj-1, rlee
      ('task-p1-t2-1','proj-1','user-rlee','On-Site Training',true,'not_started'),
      ('task-p1-t2-2','proj-1','user-rlee','Virtual Customer Support',false,'not_started'),
      ('task-p1-t2-3','proj-1','user-rlee','On-Site Customer Support',true,'not_started'),
      ('task-p1-t2-4','proj-1','user-rlee','On-Site Customer Support',false,'not_started'),
      ('task-p1-t2-5','proj-1','user-rlee','Virtual Training',true,'not_started'),
      -- proj-2, jsmith
      ('task-p2-t1-1','proj-2','user-jsmith','On-Site Training',true,'not_started'),
      ('task-p2-t1-2','proj-2','user-jsmith','Virtual Customer Support',false,'not_started'),
      ('task-p2-t1-3','proj-2','user-jsmith','On-Site Customer Support',true,'not_started'),
      ('task-p2-t1-4','proj-2','user-jsmith','On-Site Customer Support',false,'not_started'),
      ('task-p2-t1-5','proj-2','user-jsmith','Virtual Training',true,'not_started'),
      -- proj-2, rlee
      ('task-p2-t2-1','proj-2','user-rlee','On-Site Training',true,'not_started'),
      ('task-p2-t2-2','proj-2','user-rlee','Virtual Customer Support',false,'not_started'),
      ('task-p2-t2-3','proj-2','user-rlee','On-Site Customer Support',true,'not_started'),
      ('task-p2-t2-4','proj-2','user-rlee','On-Site Customer Support',false,'not_started'),
      ('task-p2-t2-5','proj-2','user-rlee','Virtual Training',true,'not_started'),
      -- proj-3, jsmith
      ('task-p3-t1-1','proj-3','user-jsmith','On-Site Training',true,'not_started'),
      ('task-p3-t1-2','proj-3','user-jsmith','Virtual Customer Support',false,'not_started'),
      ('task-p3-t1-3','proj-3','user-jsmith','On-Site Customer Support',true,'not_started'),
      ('task-p3-t1-4','proj-3','user-jsmith','On-Site Customer Support',false,'not_started'),
      ('task-p3-t1-5','proj-3','user-jsmith','Virtual Training',true,'not_started'),
      -- proj-3, rlee
      ('task-p3-t2-1','proj-3','user-rlee','On-Site Training',true,'not_started'),
      ('task-p3-t2-2','proj-3','user-rlee','Virtual Customer Support',false,'not_started'),
      ('task-p3-t2-3','proj-3','user-rlee','On-Site Customer Support',true,'not_started'),
      ('task-p3-t2-4','proj-3','user-rlee','On-Site Customer Support',false,'not_started'),
      ('task-p3-t2-5','proj-3','user-rlee','Virtual Training',true,'not_started'),
      -- proj-4, jsmith
      ('task-p4-t1-1','proj-4','user-jsmith','On-Site Training',true,'not_started'),
      ('task-p4-t1-2','proj-4','user-jsmith','Virtual Customer Support',false,'not_started'),
      ('task-p4-t1-3','proj-4','user-jsmith','On-Site Customer Support',true,'not_started'),
      ('task-p4-t1-4','proj-4','user-jsmith','On-Site Customer Support',false,'not_started'),
      ('task-p4-t1-5','proj-4','user-jsmith','Virtual Training',true,'not_started'),
      -- proj-4, rlee
      ('task-p4-t2-1','proj-4','user-rlee','On-Site Training',true,'not_started'),
      ('task-p4-t2-2','proj-4','user-rlee','Virtual Customer Support',false,'not_started'),
      ('task-p4-t2-3','proj-4','user-rlee','On-Site Customer Support',true,'not_started'),
      ('task-p4-t2-4','proj-4','user-rlee','On-Site Customer Support',false,'not_started'),
      ('task-p4-t2-5','proj-4','user-rlee','Virtual Training',true,'not_started')
    ON CONFLICT (id) DO NOTHING
  `;

  // Bookings
  await sql`
    INSERT INTO bookings
      (id, trainer_id, project_id, office_id, title, start_time, end_time, location, billable, billable_set_by_admin, status, notes, status_changed_at, rejection_reason, cancellation_reason)
    VALUES
      ('booking-1','user-jsmith','proj-1','office-1a','Project #1 Onboarding — Smile Dental',
       '2026-08-03T14:00:00.000Z','2026-08-03T18:00:00.000Z','on_site','billable',true,'pending',null,'2026-07-25T12:00:00.000Z',null,null),
      ('booking-2','user-jsmith','proj-2','office-2a','Project #2 Imaging Module Training',
       '2026-08-05T15:00:00.000Z','2026-08-05T17:00:00.000Z','remote','billable',true,'accepted',null,'2026-07-25T12:00:00.000Z',null,null),
      ('booking-3','user-rlee','proj-3','office-3a','Project #3 System Refresher',
       '2026-08-04T16:00:00.000Z','2026-08-04T17:30:00.000Z','remote','non_billable',true,'pending',null,'2026-07-25T12:00:00.000Z',null,null)
    ON CONFLICT (id) DO NOTHING
  `;

  // Time clock events
  await sql`
    INSERT INTO time_clock_events (id, trainer_id, type, timestamp, manually_logged) VALUES
      ('tce-1', 'user-jsmith','clock_in',   '2026-08-25T08:00:00.000Z',null),
      ('tce-2', 'user-jsmith','break_start','2026-08-25T12:00:00.000Z',null),
      ('tce-3', 'user-jsmith','break_end',  '2026-08-25T12:30:00.000Z',null),
      ('tce-4', 'user-jsmith','clock_out',  '2026-08-25T17:00:00.000Z',null),
      ('tce-5', 'user-jsmith','clock_in',   '2026-08-26T08:15:00.000Z',null),
      ('tce-6', 'user-jsmith','clock_out',  '2026-08-26T14:30:00.000Z',null),
      ('tce-7', 'user-rlee',  'clock_in',   '2026-08-25T07:45:00.000Z',null),
      ('tce-8', 'user-rlee',  'break_start','2026-08-25T12:00:00.000Z',null),
      ('tce-9', 'user-rlee',  'break_end',  '2026-08-25T13:00:00.000Z',null),
      ('tce-10','user-rlee',  'clock_out',  '2026-08-25T17:30:00.000Z',null),
      ('tce-11','user-rlee',  'clock_in',   '2026-08-28T09:00:00.000Z',null),
      ('tce-12','user-rlee',  'clock_out',  '2026-08-28T13:00:00.000Z',null)
    ON CONFLICT (id) DO NOTHING
  `;

  // Task entries
  await sql`
    INSERT INTO task_entries (id, trainer_id, date, project_id, office, task_id, note, hours, location, booking_id, created_at) VALUES
      ('te-1', 'user-jsmith','2026-08-25','proj-1','10001','task-p1-t1-1','Initial onboarding session, covered scheduling module.',4,null,null,'2026-08-25T16:00:00.000Z'),
      ('te-2', 'user-jsmith','2026-08-26','proj-1','10001','task-p1-t1-5','Virtual follow-up on appointment types setup.',2,null,null,'2026-08-26T15:00:00.000Z'),
      ('te-3', 'user-jsmith','2026-08-27','proj-2','20001','task-p2-t1-1','On-site training for imaging module — all staff attended.',6,null,null,'2026-08-27T17:00:00.000Z'),
      ('te-4', 'user-jsmith','2026-08-28','proj-2','20001','task-p2-t1-3','Addressed billing workflow questions from front desk.',3,null,null,'2026-08-28T15:00:00.000Z'),
      ('te-5', 'user-jsmith','2026-09-01','proj-1','10002','task-p1-t1-3','Second location kickoff — walked through provider setup.',5,null,null,'2026-09-01T18:00:00.000Z'),
      ('te-6', 'user-rlee', '2026-08-25','proj-2','20001','task-p2-t2-1','Day 1 on-site training, covered patient check-in flow.',7,null,null,'2026-08-25T17:30:00.000Z'),
      ('te-7', 'user-rlee', '2026-08-26','proj-2','20001','task-p2-t2-2','Virtual support call — helped with appointment reminders config.',1.5,null,null,'2026-08-26T14:00:00.000Z'),
      ('te-8', 'user-rlee', '2026-08-28','proj-3','30001','task-p3-t2-1','Remote refresher session — walkthrough of ledger corrections.',2,null,null,'2026-08-28T16:00:00.000Z'),
      ('te-9', 'user-rlee', '2026-09-02','proj-2','20001','task-p2-t2-3','On-site support for end-of-month close procedures.',4,null,null,'2026-09-02T17:00:00.000Z'),
      ('te-10','user-rlee', '2026-09-03','proj-4','40001','task-p4-t2-5','Virtual training session on treatment plan presentation.',1.5,null,null,'2026-09-03T15:00:00.000Z'),
      ('te-11','user-jsmith','2026-08-26','proj-1','10001','task-p1-t1-2','Follow-up support call, no charge to client.',1,null,null,'2026-08-26T16:00:00.000Z'),
      ('te-12','user-jsmith','2026-08-27','proj-2','20001','task-p2-t1-4','Courtesy on-site visit to address post-training questions.',2,null,null,'2026-08-27T18:00:00.000Z'),
      ('te-13','user-rlee', '2026-08-29','proj-2','20001','task-p2-t2-4','Non-billable on-site check-in after go-live.',1.5,null,null,'2026-08-29T14:00:00.000Z')
    ON CONFLICT (id) DO NOTHING
  `;

  // Expenses
  await sql`
    INSERT INTO expenses (id, trainer_id, project_id, date, category, amount, description, status, rejection_reason, created_at, reviewed_at, reviewed_by_admin_id) VALUES
      ('exp-1','user-jsmith','proj-1','2026-08-25','Travel',312.50,'Round-trip flight DEN→DEN for Project #1 Denver kickoff.','approved',null,'2026-08-25T20:00:00.000Z','2026-08-26T09:00:00.000Z','user-admin'),
      ('exp-2','user-jsmith','proj-2','2026-08-27','Meals',54.80,'Team lunch with client staff during on-site training day.','pending',null,'2026-08-27T19:00:00.000Z',null,null),
      ('exp-3','user-jsmith','proj-1','2026-09-01','Travel',189.00,'Amtrak to Chicago for Project #1 second location training.','pending',null,'2026-09-01T20:00:00.000Z',null,null),
      ('exp-4','user-rlee', 'proj-2','2026-08-25','Mileage',67.20,'160 miles driven to Atlanta Buckhead clinic @ $0.42/mi.','approved',null,'2026-08-25T21:00:00.000Z','2026-08-26T10:00:00.000Z','user-admin'),
      ('exp-5','user-rlee', 'proj-2','2026-09-02','Supplies',28.45,'Printed training handouts for end-of-month session.','pending',null,'2026-09-02T18:00:00.000Z',null,null)
    ON CONFLICT (id) DO NOTHING
  `;

  // Timesheet submissions
  await sql`
    INSERT INTO timesheet_submissions (id, trainer_id, week_start_date, status, submitted_at, reviewed_at, reviewed_by_admin_id, rejection_reason) VALUES
      ('ts-1','user-jsmith','2026-08-24','approved','2026-08-28T17:00:00.000Z','2026-08-29T09:00:00.000Z','user-admin',null),
      ('ts-2','user-rlee', '2026-08-24','submitted','2026-08-28T18:30:00.000Z',null,null,null),
      ('ts-3','user-jsmith','2026-08-31','draft',null,null,null,null)
    ON CONFLICT (id) DO NOTHING
  `;

  // Default flag thresholds
  await sql`
    INSERT INTO flag_thresholds (id, unsubmitted_task_tracker_days, pending_booking_unanswered_hours, inactive_trainer_days)
    VALUES (1, 3, 48, 5)
    ON CONFLICT (id) DO NOTHING
  `;
}
