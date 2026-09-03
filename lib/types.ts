export type Role = "admin" | "trainer";

export interface User {
  id: string;
  role: Role;
  username: string;
  passwordHash: string;
  name: string;
  email: string;
  active: boolean;
}

export type PublicUser = Omit<User, "passwordHash">;

export type ProductLine = "denticon" | "cloud9" | "internal_admin";

/**
 * A project's lifecycle state. "active" and "on_hold" both remain on the
 * main Projects pages ("on_hold" in its own section) and are still fully
 * editable (tasks, task tracker, offices); only "active" is bookable for
 * new bookings. "completed" and "deactivated" are archived — hidden from
 * the main Projects pages and new-booking pickers, reference-only.
 */
export type ProjectStatus = "active" | "on_hold" | "completed" | "deactivated";

export interface Project {
  id: string;
  name: string;
  productLine: ProductLine;
  color: string;
  status: ProjectStatus;
  /**
   * External/client-facing identifier (e.g. "BSN-2026"), distinct from `id`
   * (the internal database key). Not to be confused with the `projectId`
   * foreign key on other entities like Office/Task/Booking, which always
   * refers to this record's `id`.
   */
  projectId: string;
  /** Email address to BCC on project-related notifications. Stored only — not yet wired up to send anything. */
  bccEmail: string;
  /** Free-text, admin-only-editable context shown read-only to trainers. */
  notes?: string;
}

export type TaskStatus = "not_started" | "in_progress" | "completed";

export interface Task {
  id: string;
  projectId: string;
  trainerId: string;
  title: string;
  /** Whether time logged against this task is billable to the client. Drives billable/non-billable hour reporting and the "(Non Billable)" display suffix — never itself part of the stored `title`. */
  billable: boolean;
  status: TaskStatus;
}

export type BookingLocation = "on_site" | "remote";
export type BillableStatus = "billable" | "non_billable";
export type BookingStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "reassigned"
  | "rebooked"
  | "cancellation_requested"
  | "cancelled";

export interface Booking {
  id: string;
  trainerId: string;
  projectId: string;
  officeId: string;
  title: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  location: BookingLocation;
  billable: BillableStatus;
  /** True once an admin has explicitly set `billable`. Trainers can never set this. */
  billableSetByAdmin: boolean;
  status: BookingStatus;
  notes?: string;
  /** When `status` was last changed — drives the 24-hour undo window on a rejection. */
  statusChangedAt: string; // ISO 8601
  /** Optional note a trainer leaves when rejecting. Cleared if the booking later moves off "rejected". */
  rejectionReason?: string;
  /** Why the trainer asked to back out of an already-"accepted" booking. Required to request cancellation; kept on the record once "cancelled", cleared if an admin denies the request. */
  cancellationReason?: string;
}

export type TimeClockEventType =
  | "clock_in"
  | "clock_out"
  | "break_start"
  | "break_end";

export interface TimeClockEvent {
  id: string;
  trainerId: string;
  type: TimeClockEventType;
  timestamp: string; // ISO 8601
  /** True only for events created by an approved ManualSessionRequest — lets admin views distinguish a retroactively-logged session from a live clock-in/out. Absent (not `false`) for every ordinary live event. */
  manuallyLogged?: boolean;
}

export type ClockCorrectionStatus = "pending" | "approved" | "denied";

/**
 * A trainer disputing a past TimeClockEvent's timestamp. `originalTimestamp`
 * is copied at request time so the record stays a permanent audit trail
 * even after approval changes the underlying event. Approving is the only
 * path through which a TimeClockEvent's timestamp is ever modified after
 * creation; denying leaves it untouched and the trainer may request again.
 */
export interface ClockCorrectionRequest {
  id: string;
  trainerId: string;
  originalEventId: string;
  originalTimestamp: string; // ISO 8601, copied at request time
  requestedTimestamp: string; // ISO 8601
  reason: string;
  status: ClockCorrectionStatus;
  adminNote?: string;
  createdAt: string; // ISO 8601
  reviewedAt?: string; // ISO 8601
}

export type ManualSessionRequestStatus = "pending" | "approved" | "denied";

export interface ManualSessionBreakInput {
  start: string; // ISO 8601
  end: string; // ISO 8601
}

/**
 * A trainer manually logging a full past day they forgot to clock in/out
 * for entirely — unlike {@link ClockCorrectionRequest}, there's no
 * `originalEventId` since nothing existed to correct. No TimeClockEvents
 * exist until an admin approves; approving creates a clock_in, one
 * clock_out, and a break_start/break_end pair per entry in `breaks`, all
 * flagged `manuallyLogged`. Denying leaves no events behind.
 */
export interface ManualSessionRequest {
  id: string;
  trainerId: string;
  date: string; // "YYYY-MM-DD" — the day being logged, as picked by the trainer
  clockIn: string; // ISO 8601
  clockOut: string; // ISO 8601
  breaks: ManualSessionBreakInput[];
  reason: string;
  status: ManualSessionRequestStatus;
  adminNote?: string;
  createdAt: string; // ISO 8601
  reviewedAt?: string; // ISO 8601
  /** Set once approved — the ids of the TimeClockEvents this request created. */
  createdEventIds?: string[];
}

/**
 * A physical location belonging to a specific project (a project represents
 * a DSO client; its offices are that client's locations). Scoped to one
 * project — not a flat global list.
 */
export interface Office {
  id: string;
  projectId: string;
  name: string;
  active: boolean;
}

/**
 * A trainer's daily log of work performed against a checklist `Task`.
 * `office` is copied from the Office list at submission time, so
 * deactivating an office later never rewrites already-logged history —
 * but `taskId` is a live reference, so the linked Task's current title and
 * status (e.g. completed via this same form) always show up to date.
 */
export interface TaskEntry {
  id: string;
  trainerId: string;
  date: string; // ISO date, e.g. "2026-07-27" — editable, defaults to today
  projectId: string;
  office: string;
  taskId: string;
  note: string;
  hours: number;
  /** Required for customer projects (denticon/cloud9); absent for internal_admin projects. Free text: supports OIDs, location names, multiple locations, or "all locations". */
  location?: string;
  bookingId?: string;
  createdAt: string; // ISO 8601
}

/**
 * A trainer's personal shortcut list of task *names* — deliberately not
 * tied to any specific Task/project, since the same task name (e.g.
 * "Onboarding call") can exist across multiple projects.
 */
export interface FavoriteTask {
  id: string;
  trainerId: string;
  taskName: string;
  createdAt: string; // ISO 8601
}

export type FlagType =
  | "accepted_booking_no_hours"
  | "unsubmitted_task_tracker"
  | "pending_booking_unanswered"
  | "trainer_inactive"
  | "cancellation_requested";

export type FlagSeverity = "info" | "warning";
export type FlagStatus = "active" | "dismissed";

/**
 * A flag is never created directly — it's computed by reading current
 * bookings/task entries/clock events against {@link FlagThresholds}, then
 * reconciled against a persisted dismissal record so a dismissed flag
 * doesn't reappear on the next computation unless the underlying situation
 * has since changed (gotten worse, or resolved and later recurred).
 */
export interface Flag {
  id: string;
  trainerId: string;
  type: FlagType;
  message: string;
  relatedBookingId?: string;
  relatedProjectId?: string;
  severity: FlagSeverity;
  status: FlagStatus;
  createdAt: string; // ISO 8601
  dismissedAt?: string; // ISO 8601
  dismissedByNote?: string;
}

export type WeeklySubmissionStatus = "draft" | "submitted" | "approved" | "rejected";

/**
 * A trainer's submission of one business week's Task Tracker entries for
 * admin review. At most one record per (trainerId, weekStartDate) — if none
 * exists yet for a given week, treat it as "draft". Submitting or approving
 * locks that week's entries against further edits/new entries; rejecting
 * unlocks them again (even a past week) so the trainer can revise and
 * resubmit.
 */
export interface WeeklySubmission {
  id: string;
  trainerId: string;
  weekStartDate: string; // "YYYY-MM-DD" — the Monday of the week
  status: WeeklySubmissionStatus;
  submittedAt?: string; // ISO 8601
  reviewedAt?: string; // ISO 8601
  reviewedByAdminId?: string;
  rejectionReason?: string;
}

export type TimesheetSubmissionStatus = "draft" | "submitted" | "approved" | "rejected";

/**
 * A trainer's submission of one business week's time clock data for admin
 * review — the time-clock counterpart to {@link WeeklySubmission}. At most
 * one record per (trainerId, weekStartDate) — if none exists yet for a
 * given week, treat it as "draft". Submitting or approving locks that
 * week's TimeClockEvents against further clock-in/out/break actions;
 * rejecting unlocks them again (even a past week) so the trainer can
 * resubmit. A locked week's data can still be corrected via a
 * ClockCorrectionRequest, which goes through its own admin approval.
 */
export interface TimesheetSubmission {
  id: string;
  trainerId: string;
  weekStartDate: string; // "YYYY-MM-DD" — the Monday of the week
  status: TimesheetSubmissionStatus;
  submittedAt?: string; // ISO 8601
  reviewedAt?: string; // ISO 8601
  reviewedByAdminId?: string;
  rejectionReason?: string;
}

export type ExpenseCategory = "Travel" | "Meals" | "Supplies" | "Mileage" | "Other";
export type ExpenseStatus = "pending" | "approved" | "rejected";

/**
 * A trainer's out-of-pocket expense submitted for reimbursement — the same
 * submission/approval shape as WeeklySubmission/TimesheetSubmission, but for
 * an individual cost rather than a business week. `projectId` is optional
 * since not every expense is billable to a specific client. A trainer may
 * edit and resubmit (via `updateExpense`) only while `status` is "rejected"
 * — a "pending" or "approved" expense is locked.
 */
export interface Expense {
  id: string;
  trainerId: string;
  projectId?: string;
  date: string; // "YYYY-MM-DD"
  category: ExpenseCategory;
  amount: number;
  description: string;
  status: ExpenseStatus;
  rejectionReason?: string;
  createdAt: string; // ISO 8601
  reviewedAt?: string; // ISO 8601
  reviewedByAdminId?: string;
  /** Reserved for a future receipt-upload feature — unused and unpopulated for now, so that feature won't need a schema migration. */
  receiptUrl?: string;
}

export type UnavailabilityType = "one_time" | "recurring";

/**
 * A trainer-declared block of time they're unavailable — informational
 * only. Admin scheduling shows it as a soft warning on overlap, never a
 * hard restriction like the double-booking conflict check. "one_time"
 * covers a specific day or date range (`endDate` defaults to `startDate`
 * when omitted); "recurring" repeats weekly on `recurringDayOfWeek` for
 * every date within [startDate, endDate] (`endDate` omitted means the
 * recurrence runs indefinitely). `startTime`/`endTime` are omitted
 * together to block the entire day.
 */
export interface UnavailabilityBlock {
  id: string;
  trainerId: string;
  type: UnavailabilityType;
  startDate: string; // "YYYY-MM-DD"
  endDate?: string; // "YYYY-MM-DD"
  startTime?: string; // "HH:mm", 24-hour
  endTime?: string; // "HH:mm", 24-hour
  /** 0 (Sunday) – 6 (Saturday). Set only when `type` is "recurring". */
  recurringDayOfWeek?: number;
  reason?: string;
  createdAt: string; // ISO 8601
}

/** Admin-configurable thresholds that drive flag detection — a single global config, not per-trainer. */
export interface FlagThresholds {
  /** Days without a Task Tracker entry before flagging "unsubmitted task tracker". Default 3. */
  unsubmittedTaskTrackerDays: number;
  /** Hours before a pending booking's start time to flag it as unanswered. Default 48. */
  pendingBookingUnansweredHours: number;
  /** Days of total inactivity (no clock events and no task entries) before flagging an active trainer. Default 5. */
  inactiveTrainerDays: number;
}

export type NotificationType =
  | "flag"
  | "submission"
  | "timesheet_submission"
  | "cancellation_request"
  | "clock_correction"
  | "manual_session"
  | "booking_created"
  | "submission_decision"
  | "timesheet_submission_decision"
  | "cancellation_decision"
  | "clock_correction_decision"
  | "manual_session_decision"
  | "expense_submitted"
  | "expense_decision"
  | "booking_cancelled"
  | "booking_rescheduled";

/**
 * An alert generated as a side effect of a workflow event — e.g. a flag
 * becoming active, a trainer submitting a week, a submission being
 * approved/rejected, or a booking/correction/cancellation being decided.
 * `recipientRole` decides which sidebar bell shows it: "admin" notifications
 * are org-wide (visible to every admin); "trainer" notifications are
 * personal (visible only to the trainer named in `relatedTrainerId`, who is
 * also always this notification's subject in that case). `message` is
 * already a fully-formed, human-readable string — no further enrichment
 * needed to display it.
 */
export interface Notification {
  id: string;
  type: NotificationType;
  recipientRole: Role;
  message: string;
  relatedTrainerId?: string;
  /** e.g. a flag id, a WeeklySubmission id, or a Booking id — whichever the type's `message`/link refers to. */
  relatedEntityId?: string;
  read: boolean;
  createdAt: string; // ISO 8601
}
