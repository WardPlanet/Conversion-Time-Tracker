import type {
  User,
  PublicUser,
  Project,
  Task,
  TaskStatus,
  Booking,
  BookingLocation,
  TimeClockEvent,
  Office,
  TaskEntry,
  FavoriteTask,
  Flag,
  FlagThresholds,
  WeeklySubmission,
  TimesheetSubmission,
  Expense,
  UnavailabilityBlock,
  Notification,
  NotificationType,
  ClockCorrectionRequest,
  ManualSessionRequest,
  ManualSessionBreakInput,
  Role,
  BillableStatus,
  BookingStatus,
  TimeClockEventType,
} from "@/lib/types";

export interface Actor {
  id: string;
  role: Role;
}

/** Thrown when an actor attempts an action their role does not permit. */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Identifies a ForbiddenError by name rather than `instanceof`. Next.js
 * compiles each route handler as a separate bundle in dev, which can give
 * the store's error class a distinct identity per bundle and make
 * `instanceof` checks fail even though the error is a real ForbiddenError.
 */
export function isForbiddenError(err: unknown): err is ForbiddenError {
  return err instanceof Error && err.name === "ForbiddenError";
}

/** Thrown when a new/updated booking would overlap another active booking for the same trainer. */
export class BookingConflictError extends Error {
  constructor(
    message: string,
    public readonly conflictingBooking: Booking
  ) {
    super(message);
    this.name = "BookingConflictError";
  }
}

/** Same rationale as {@link isForbiddenError} — check by name, not `instanceof`. */
export function isBookingConflictError(
  err: unknown
): err is BookingConflictError {
  return err instanceof Error && err.name === "BookingConflictError";
}

export interface CreateTrainerInput {
  username: string;
  passwordHash: string;
  name: string;
  email: string;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  billable: boolean;
  /** Required when the actor is an admin (who is authoring the checklist item for a specific trainer); ignored for a trainer actor, who can only ever create tasks for themselves. */
  trainerId?: string;
}

export interface CreateProjectInput {
  name: string;
  productLine: Project["productLine"];
  color: string;
  projectId: string;
  bccEmail: string;
  notes?: string;
}

export interface UpdateProjectInput {
  name: string;
  productLine: Project["productLine"];
  color: string;
  projectId: string;
  bccEmail: string;
  notes?: string;
}

export interface CreateOfficeInput {
  projectId: string;
  name: string;
}

export interface UpdateBookingDetailsInput {
  startTime: string;
  endTime: string;
  location: BookingLocation;
}

export interface CreateBookingInput {
  trainerId: string;
  projectId: string;
  officeId: string;
  title: string;
  startTime: string;
  endTime: string;
  location: BookingLocation;
  billable: BillableStatus;
  notes?: string;
}

export interface CreateTaskEntryInput {
  date: string;
  projectId: string;
  office: string;
  taskId: string;
  note: string;
  hours: number;
  /** Required when the project is a customer project (denticon/cloud9). */
  location?: string;
  bookingId?: string;
}

/** Date is deliberately excluded — editing corrects the details of an already-logged day, not its date. */
export interface UpdateTaskEntryInput {
  projectId: string;
  office: string;
  taskId: string;
  note: string;
  hours: number;
  /** Required when the project is a customer project (denticon/cloud9). */
  location?: string;
}

export interface DismissFlagInput {
  note?: string;
}

export interface CreateNotificationInput {
  type: NotificationType;
  message: string;
  relatedTrainerId?: string;
  relatedEntityId?: string;
  /** Who this notification is for — "admin" (org-wide) or "trainer" (personal, requires `relatedTrainerId`). Defaults to "admin" if omitted, matching every existing call site. */
  recipientRole?: Role;
}

export interface CreateManualSessionInput {
  date: string;
  clockIn: string;
  clockOut: string;
  breaks: ManualSessionBreakInput[];
  reason: string;
}

export interface CreateExpenseInput {
  projectId?: string;
  date: string;
  category: Expense["category"];
  amount: number;
  description: string;
}

export interface UpdateExpenseInput {
  projectId?: string;
  date: string;
  category: Expense["category"];
  amount: number;
  description: string;
}

export interface CreateUnavailabilityBlockInput {
  type: UnavailabilityBlock["type"];
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  recurringDayOfWeek?: number;
  reason?: string;
}

/**
 * Swappable data access contract. Every operation that mutates trainer
 * accounts or a booking's billable status takes an `Actor` so the
 * implementation can enforce role rules itself, not just the UI.
 */
export interface DataStore {
  // Users
  getUserByUsername(username: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  listTrainers(): Promise<PublicUser[]>;
  createTrainer(input: CreateTrainerInput, actor: Actor): Promise<PublicUser>;
  setTrainerActive(
    trainerId: string,
    active: boolean,
    actor: Actor
  ): Promise<PublicUser>;
  /** Self-service: a trainer actor may only pass their own id — an admin actor may pass any. */
  updateUserPassword(
    userId: string,
    passwordHash: string,
    actor: Actor
  ): Promise<PublicUser>;

  // Projects
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(input: CreateProjectInput, actor: Actor): Promise<Project>;
  setProjectStatus(
    projectId: string,
    status: Project["status"],
    actor: Actor
  ): Promise<Project>;
  /** Admin-only. Full edit of a project's identity/contact fields — trainers only ever view these, never edit them. */
  updateProjectDetails(
    projectId: string,
    updates: UpdateProjectInput,
    actor: Actor
  ): Promise<Project>;

  // Tasks
  listTasksForTrainer(trainerId: string): Promise<Task[]>;
  listAllTasks(): Promise<Task[]>;
  /**
   * A trainer creates a task only for themselves. An admin authors a
   * checklist item for a specific trainer — `input.trainerId` is required
   * in that case.
   */
  createTask(input: CreateTaskInput, actor: Actor): Promise<Task>;
  /** Trainers may only update the status of their own tasks. */
  updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    actor: Actor
  ): Promise<Task>;
  /** Admin-only. Trainers can never delete a checklist item, only check/uncheck it. */
  deleteTask(taskId: string, actor: Actor): Promise<void>;

  // Bookings
  listBookingsForTrainer(trainerId: string): Promise<Booking[]>;
  listAllBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | null>;
  /**
   * Admin-only. Always created with status "pending" — this sends a
   * request to the trainer, it never auto-confirms. Throws
   * {@link BookingConflictError} if the trainer already has an active
   * (pending/accepted) booking overlapping the requested window.
   */
  createBooking(input: CreateBookingInput, actor: Actor): Promise<Booking>;
  /**
   * Trainers may only move their own bookings between pending/accepted/rejected.
   * Moving back to "pending" is a trainer's own undo of a recent accept/reject —
   * only legal within the undo window (see `UNDO_WINDOW_HOURS` in
   * lib/domain/trainer-stats.ts) of that change. `reason` is saved (and shown
   * later) only for a "rejected" status.
   */
  updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    actor: Actor,
    reason?: string
  ): Promise<Booking>;
  /** Admin-only. Trainers can never set or change a booking's billable status. */
  setBookingBillable(
    bookingId: string,
    billable: BillableStatus,
    actor: Actor
  ): Promise<Booking>;
  /** Admin-only. Reschedules or relocates a booking; trainers cannot edit these fields. */
  updateBookingDetails(
    bookingId: string,
    updates: UpdateBookingDetailsInput,
    actor: Actor
  ): Promise<Booking>;
  /**
   * Trainer-only. Only an already-`"accepted"` booking can have its
   * cancellation requested — this is a separate path from the
   * pending/accept/reject flow, not a replacement for it. Sets status to
   * `"cancellation_requested"`; the booking stays active (and still blocks
   * the trainer's calendar) until an admin resolves it. `reason` is required.
   */
  requestBookingCancellation(
    bookingId: string,
    reason: string,
    actor: Actor
  ): Promise<Booking>;
  /** Admin-only. Moves a `"cancellation_requested"` booking to the terminal `"cancelled"` status. */
  approveBookingCancellation(bookingId: string, actor: Actor): Promise<Booking>;
  /** Admin-only. Reverts a `"cancellation_requested"` booking back to `"accepted"`, clearing the reason. */
  denyBookingCancellation(bookingId: string, actor: Actor): Promise<Booking>;
  /**
   * Admin-only. Immediately cancels a booking regardless of its current
   * status (pending, accepted, etc.) — no approval step, unlike the
   * trainer-initiated request/approve/deny flow above. `reason` is optional.
   */
  adminCancelBooking(
    bookingId: string,
    actor: Actor,
    reason?: string
  ): Promise<Booking>;
  /**
   * Admin-only. Reschedules a booking's date/time/location (and billable
   * status, if given) and resets its status to `"pending"` so the trainer
   * re-confirms the new time through the same accept/reject flow as a fresh
   * booking. `reason` is optional. Internally reuses
   * {@link DataStore.updateBookingDetails} and
   * {@link DataStore.setBookingBillable} rather than re-implementing their
   * validation.
   */
  adminRescheduleBooking(
    bookingId: string,
    updates: UpdateBookingDetailsInput,
    actor: Actor,
    billable?: BillableStatus,
    reason?: string
  ): Promise<Booking>;

  // Time clock
  listTimeClockEvents(trainerId: string): Promise<TimeClockEvent[]>;
  listAllTimeClockEvents(): Promise<TimeClockEvent[]>;
  addTimeClockEvent(
    trainerId: string,
    type: TimeClockEventType,
    actor: Actor
  ): Promise<TimeClockEvent>;

  // Offices (scoped to a project — a project's physical locations)
  listOfficesForProject(projectId: string): Promise<Office[]>;
  createOffice(input: CreateOfficeInput, actor: Actor): Promise<Office>;
  setOfficeActive(
    officeId: string,
    active: boolean,
    actor: Actor
  ): Promise<Office>;
  setOfficeCompleted(
    officeId: string,
    completed: boolean,
    actor: Actor
  ): Promise<Office>;

  // Task entries (daily work log)
  listTaskEntriesForTrainer(trainerId: string): Promise<TaskEntry[]>;
  listAllTaskEntries(): Promise<TaskEntry[]>;
  /** The entry's trainer is always the acting trainer — trainers can only log entries for themselves. */
  createTaskEntry(
    input: CreateTaskEntryInput,
    actor: Actor
  ): Promise<TaskEntry>;
  /**
   * Trainers may only edit their own entries, and only while the entry's
   * date still falls within the current Monday–Friday business week —
   * enforced here, not just hidden in the UI.
   */
  updateTaskEntry(
    entryId: string,
    updates: UpdateTaskEntryInput,
    actor: Actor
  ): Promise<TaskEntry>;
  /** Same editability rule as {@link updateTaskEntry} — trainers may only delete their own, current-week, unlocked entries. */
  deleteTaskEntry(entryId: string, actor: Actor): Promise<void>;

  // Favorite tasks (a trainer's personal shortcut list of task names)
  listFavoriteTasksForTrainer(trainerId: string): Promise<FavoriteTask[]>;
  /** The favorite's trainer is always the acting trainer. Adding a name that's already favorited is idempotent — returns the existing favorite. */
  addFavoriteTask(taskName: string, actor: Actor): Promise<FavoriteTask>;
  /** Trainers may only remove their own favorites. */
  removeFavoriteTask(favoriteId: string, actor: Actor): Promise<void>;

  // Flags (computed from current data against configurable thresholds — see lib/domain/flags.ts)
  getFlagThresholds(): Promise<FlagThresholds>;
  /** Admin-only. */
  updateFlagThresholds(
    input: FlagThresholds,
    actor: Actor
  ): Promise<FlagThresholds>;
  /**
   * Admin-only. Re-runs detection against current data, most severe/urgent
   * first. A previously dismissed flag stays hidden as long as its
   * situation is unchanged; it resurfaces once that situation gets worse,
   * or resolves and later recurs.
   */
  listActiveFlags(actor: Actor): Promise<Flag[]>;
  /** Admin-only. Same detection as {@link listActiveFlags}, scoped to one trainer. */
  listActiveFlagsForTrainer(trainerId: string, actor: Actor): Promise<Flag[]>;
  /** Admin-only. */
  dismissFlag(
    flagId: string,
    input: DismissFlagInput,
    actor: Actor
  ): Promise<Flag>;
  /** Admin-only. Dismisses every currently active flag at once (org-wide) — the Dashboard's bulk "Dismiss all" action. No note (unlike a single dismiss). */
  dismissAllFlags(actor: Actor): Promise<Flag[]>;

  // Weekly submissions (Task Tracker review workflow — at most one record per trainer/week)
  /** A trainer's own weekly submissions, or an admin viewing a specific trainer's. */
  listWeeklySubmissionsForTrainer(
    trainerId: string,
    actor: Actor
  ): Promise<WeeklySubmission[]>;
  /** Admin-only. Every trainer's currently "submitted" (pending review) weeks. */
  listPendingWeeklySubmissions(actor: Actor): Promise<WeeklySubmission[]>;
  /**
   * The trainer's own action — always acts on the calling trainer's record
   * for `weekStartDate`. Creates it (status "submitted") if none exists
   * yet, or moves an existing "rejected" record back to "submitted",
   * clearing its prior review. Throws if that week is already "submitted"
   * or "approved".
   */
  submitWeek(weekStartDate: string, actor: Actor): Promise<WeeklySubmission>;
  /** Admin-only. Moves a "submitted" week to "approved". */
  approveWeeklySubmission(
    submissionId: string,
    actor: Actor
  ): Promise<WeeklySubmission>;
  /** Admin-only. Moves a "submitted" week to "rejected" with a required reason, shown to the trainer. */
  rejectWeeklySubmission(
    submissionId: string,
    reason: string,
    actor: Actor
  ): Promise<WeeklySubmission>;

  // Timesheet submissions (Time Clock review workflow — parallel to weekly
  // submissions above, but locks TimeClockEvents for a business week
  // instead of TaskEntries. At most one record per trainer/week.)
  /** A trainer's own timesheet submissions, or an admin viewing a specific trainer's. */
  listTimesheetSubmissionsForTrainer(
    trainerId: string,
    actor: Actor
  ): Promise<TimesheetSubmission[]>;
  /** Admin-only. Every trainer's currently "submitted" (pending review) timesheet weeks. */
  listPendingTimesheetSubmissions(
    actor: Actor
  ): Promise<TimesheetSubmission[]>;
  /**
   * The trainer's own action — always acts on the calling trainer's record
   * for `weekStartDate`. Creates it (status "submitted") if none exists
   * yet, or moves an existing "rejected" record back to "submitted",
   * clearing its prior review. Throws if that week is already "submitted"
   * or "approved".
   */
  submitTimesheetWeek(
    weekStartDate: string,
    actor: Actor
  ): Promise<TimesheetSubmission>;
  /** Admin-only. Moves a "submitted" timesheet week to "approved". */
  approveTimesheetSubmission(
    submissionId: string,
    actor: Actor
  ): Promise<TimesheetSubmission>;
  /** Admin-only. Moves a "submitted" timesheet week to "rejected" with a required reason, shown to the trainer. */
  rejectTimesheetSubmission(
    submissionId: string,
    reason: string,
    actor: Actor
  ): Promise<TimesheetSubmission>;

  // Notifications (system-generated as a side effect of the events above;
  // recipient-specific — an admin actor sees every "admin" notification,
  // org-wide, while a trainer actor sees only their own "trainer"
  // notifications)
  /** Every notification visible to `actor`'s role, most recent first — every admin notification for an admin actor, or only this trainer's own for a trainer actor. */
  listNotifications(actor: Actor): Promise<Notification[]>;
  /** Not actor-gated — called internally by the store itself as a side effect of the events above, never directly from a route. `input.recipientRole` defaults to "admin". */
  createNotification(input: CreateNotificationInput): Promise<Notification>;
  /** An actor may only mark a notification visible to their own role (and, for a trainer, their own `relatedTrainerId`) as read. */
  markNotificationRead(
    notificationId: string,
    actor: Actor
  ): Promise<Notification>;

  // Clock correction requests (a trainer disputing a past TimeClockEvent's
  // timestamp — the only path through which a TimeClockEvent is ever
  // modified after creation, and only on admin approval)
  /** A trainer's own requests, or an admin viewing a specific trainer's. */
  listClockCorrectionRequestsForTrainer(
    trainerId: string,
    actor: Actor
  ): Promise<ClockCorrectionRequest[]>;
  /** Admin-only. Every trainer's currently "pending" requests. */
  listPendingClockCorrectionRequests(
    actor: Actor
  ): Promise<ClockCorrectionRequest[]>;
  /**
   * Trainer-only. `eventId` must be one of the trainer's own TimeClockEvents.
   * Throws if that event already has a pending request. `reason` is required.
   */
  requestClockCorrection(
    eventId: string,
    requestedTimestamp: string,
    reason: string,
    actor: Actor
  ): Promise<ClockCorrectionRequest>;
  /** Admin-only. Applies `requestedTimestamp` to the underlying TimeClockEvent and marks the request "approved". */
  approveClockCorrection(
    requestId: string,
    actor: Actor
  ): Promise<ClockCorrectionRequest>;
  /** Admin-only. Marks the request "denied", leaving the TimeClockEvent unchanged. `adminNote` is optional. */
  denyClockCorrection(
    requestId: string,
    adminNote: string | undefined,
    actor: Actor
  ): Promise<ClockCorrectionRequest>;

  // Manual session requests (a trainer logging a full past day they forgot
  // to clock in/out for entirely — goes through the same admin approval
  // queue as clock corrections; no TimeClockEvents exist until approved)
  /** A trainer's own requests, or an admin viewing a specific trainer's. */
  listManualSessionRequestsForTrainer(
    trainerId: string,
    actor: Actor
  ): Promise<ManualSessionRequest[]>;
  /** Admin-only. Every trainer's currently "pending" requests. */
  listPendingManualSessionRequests(
    actor: Actor
  ): Promise<ManualSessionRequest[]>;
  /**
   * Trainer-only. `reason` is required; throws if the trainer already has a
   * pending request for `input.date`, or if the proposed times don't make
   * sense (clock-out before clock-in, a break outside that window, or
   * overlapping breaks).
   */
  requestManualSession(
    input: CreateManualSessionInput,
    actor: Actor
  ): Promise<ManualSessionRequest>;
  /** Admin-only. Creates the clock_in/clock_out/break events (each flagged `manuallyLogged`) and marks the request "approved". */
  approveManualSession(
    requestId: string,
    actor: Actor
  ): Promise<ManualSessionRequest>;
  /** Admin-only. Marks the request "denied" — no TimeClockEvents are created. `adminNote` is optional. */
  denyManualSession(
    requestId: string,
    adminNote: string | undefined,
    actor: Actor
  ): Promise<ManualSessionRequest>;

  // Expenses (a trainer's out-of-pocket cost submitted for reimbursement —
  // same submission/approval shape as weekly/timesheet submissions, but per
  // individual expense rather than per business week)
  /** A trainer's own expenses, or an admin viewing a specific trainer's, most recent first. */
  listExpensesForTrainer(trainerId: string, actor: Actor): Promise<Expense[]>;
  /** Admin-only. Every trainer's currently "pending" expenses. */
  listPendingExpenses(actor: Actor): Promise<Expense[]>;
  /** Trainer-only. Always created for the acting trainer, with status "pending". */
  createExpense(input: CreateExpenseInput, actor: Actor): Promise<Expense>;
  /** Trainer-only, and only while `status` is "rejected" — edits the expense and resubmits it (back to "pending", clearing the prior review). */
  updateExpense(
    expenseId: string,
    updates: UpdateExpenseInput,
    actor: Actor
  ): Promise<Expense>;
  /** Admin-only. Moves a "pending" expense to "approved". */
  approveExpense(expenseId: string, actor: Actor): Promise<Expense>;
  /** Admin-only. Moves a "pending" expense to "rejected" with a required reason, shown to the trainer. */
  rejectExpense(
    expenseId: string,
    reason: string,
    actor: Actor
  ): Promise<Expense>;

  // Unavailability blocks (a trainer's self-declared "don't schedule me"
  // windows — informational only; admin scheduling shows a soft warning on
  // overlap, never a hard restriction like the booking conflict check)
  /** A trainer's own blocks, or an admin viewing a specific trainer's — e.g. for the Scheduling calendar's soft-warning check. */
  listUnavailabilityBlocksForTrainer(
    trainerId: string,
    actor: Actor
  ): Promise<UnavailabilityBlock[]>;
  /** Trainer-only. Always created for the acting trainer. */
  createUnavailabilityBlock(
    input: CreateUnavailabilityBlockInput,
    actor: Actor
  ): Promise<UnavailabilityBlock>;
  /** Trainer-only — trainers may delete their own blocks freely, no approval needed. */
  deleteUnavailabilityBlock(blockId: string, actor: Actor): Promise<void>;
}
