import { sql } from "@vercel/postgres";
import crypto from "crypto";
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
  ClockCorrectionRequest,
  ManualSessionRequest,
  BillableStatus,
  BookingStatus,
  TimeClockEventType,
  Role,
  ProductLine,
  ProjectStatus,
} from "@/lib/types";
import type {
  Actor,
  CreateTaskInput,
  CreateTrainerInput,
  CreateProjectInput,
  CreateOfficeInput,
  CreateTaskEntryInput,
  UpdateTaskEntryInput,
  UpdateBookingDetailsInput,
  UpdateProjectInput,
  DismissFlagInput,
  CreateBookingInput,
  CreateNotificationInput,
  CreateManualSessionInput,
  CreateExpenseInput,
  UpdateExpenseInput,
  CreateUnavailabilityBlockInput,
  DataStore,
} from "@/lib/data/store";
import { ForbiddenError, BookingConflictError } from "@/lib/data/store";
import {
  computeClockStatus,
  nextAllowedEventTypes,
  TIME_CLOCK_EVENT_LABELS,
} from "@/lib/domain/clock-status";
import { findConflictingBooking } from "@/lib/domain/booking-conflicts";
import { getBusinessWeekDays, isDateInWeek } from "@/lib/domain/task-entry-grid";
import { isWithinUndoWindow } from "@/lib/domain/trainer-stats";
import { computeFlagCandidates } from "@/lib/domain/flags";
import {
  computeWeekLockState,
  formatWeekLabel,
  weekStartDateFor,
} from "@/lib/domain/weekly-submissions";
import { EXPENSE_CATEGORIES } from "@/lib/domain/expenses";
import {
  formatCurrency,
  formatDateRange,
  formatDateTime,
  toLocalDateString,
} from "@/lib/format";

type FlagRecord = Flag & { key: string; signature: string };

function genId(): string {
  return crypto.randomUUID();
}

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _, ...pub } = user;
  return pub;
}

// ── Row → domain type mappers ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function rowToUser(r: Row): User {
  return {
    id: r.id,
    role: r.role as Role,
    username: r.username,
    passwordHash: r.password_hash,
    name: r.name,
    email: r.email,
    active: r.active,
  };
}

function rowToProject(r: Row): Project {
  return {
    id: r.id,
    name: r.name,
    productLine: r.product_line as ProductLine,
    color: r.color,
    status: r.status as ProjectStatus,
    projectId: r.project_id,
    bccEmail: r.bcc_email,
    notes: r.notes ?? undefined,
  };
}

function rowToTask(r: Row): Task {
  return {
    id: r.id,
    projectId: r.project_id,
    trainerId: r.trainer_id,
    title: r.title,
    billable: r.billable,
    status: r.status as TaskStatus,
  };
}

function rowToOffice(r: Row): Office {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    active: r.active,
    completed: r.completed ?? undefined,
  };
}

function rowToBooking(r: Row): Booking {
  return {
    id: r.id,
    trainerId: r.trainer_id,
    projectId: r.project_id,
    officeId: r.office_id,
    title: r.title,
    startTime: r.start_time,
    endTime: r.end_time,
    location: r.location as BookingLocation,
    billable: r.billable as BillableStatus,
    billableSetByAdmin: r.billable_set_by_admin,
    status: r.status as BookingStatus,
    notes: r.notes ?? undefined,
    statusChangedAt: r.status_changed_at,
    rejectionReason: r.rejection_reason ?? undefined,
    cancellationReason: r.cancellation_reason ?? undefined,
  };
}

function rowToTimeClockEvent(r: Row): TimeClockEvent {
  return {
    id: r.id,
    trainerId: r.trainer_id,
    type: r.type as TimeClockEventType,
    timestamp: r.timestamp,
    manuallyLogged: r.manually_logged ?? undefined,
  };
}

function rowToTaskEntry(r: Row): TaskEntry {
  return {
    id: r.id,
    trainerId: r.trainer_id,
    date: r.date,
    projectId: r.project_id,
    office: r.office,
    taskId: r.task_id,
    note: r.note,
    hours: Number(r.hours),
    location: r.location ?? undefined,
    bookingId: r.booking_id ?? undefined,
    createdAt: r.created_at,
  };
}

function rowToFavoriteTask(r: Row): FavoriteTask {
  return {
    id: r.id,
    trainerId: r.trainer_id,
    taskName: r.task_name,
    createdAt: r.created_at,
  };
}

function rowToFlagRecord(r: Row): FlagRecord {
  return {
    id: r.id,
    key: r.key,
    signature: r.signature,
    trainerId: r.trainer_id,
    type: r.type,
    message: r.message,
    relatedBookingId: r.related_booking_id ?? undefined,
    relatedProjectId: r.related_project_id ?? undefined,
    severity: r.severity,
    status: r.status,
    createdAt: r.created_at,
    dismissedAt: r.dismissed_at ?? undefined,
    dismissedByNote: r.dismissed_by_note ?? undefined,
  };
}

function toFlag(record: FlagRecord): Flag {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key: _k, signature: _s, ...flag } = record;
  return flag;
}

function rowToWeeklySubmission(r: Row): WeeklySubmission {
  return {
    id: r.id,
    trainerId: r.trainer_id,
    weekStartDate: r.week_start_date,
    status: r.status,
    submittedAt: r.submitted_at ?? undefined,
    reviewedAt: r.reviewed_at ?? undefined,
    reviewedByAdminId: r.reviewed_by_admin_id ?? undefined,
    rejectionReason: r.rejection_reason ?? undefined,
  };
}

function rowToTimesheetSubmission(r: Row): TimesheetSubmission {
  return {
    id: r.id,
    trainerId: r.trainer_id,
    weekStartDate: r.week_start_date,
    status: r.status,
    submittedAt: r.submitted_at ?? undefined,
    reviewedAt: r.reviewed_at ?? undefined,
    reviewedByAdminId: r.reviewed_by_admin_id ?? undefined,
    rejectionReason: r.rejection_reason ?? undefined,
  };
}

function rowToNotification(r: Row): Notification {
  return {
    id: r.id,
    type: r.type,
    recipientRole: r.recipient_role as Role,
    message: r.message,
    relatedTrainerId: r.related_trainer_id ?? undefined,
    relatedEntityId: r.related_entity_id ?? undefined,
    read: r.read,
    createdAt: r.created_at,
  };
}

function rowToClockCorrectionRequest(r: Row): ClockCorrectionRequest {
  return {
    id: r.id,
    trainerId: r.trainer_id,
    originalEventId: r.original_event_id,
    originalTimestamp: r.original_timestamp,
    requestedTimestamp: r.requested_timestamp,
    reason: r.reason,
    status: r.status,
    adminNote: r.admin_note ?? undefined,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at ?? undefined,
  };
}

function rowToManualSessionRequest(r: Row): ManualSessionRequest {
  return {
    id: r.id,
    trainerId: r.trainer_id,
    date: r.date,
    clockIn: r.clock_in,
    clockOut: r.clock_out,
    breaks: r.breaks ?? [],
    reason: r.reason,
    status: r.status,
    adminNote: r.admin_note ?? undefined,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at ?? undefined,
    createdEventIds: r.created_event_ids ?? undefined,
  };
}

function rowToExpense(r: Row): Expense {
  return {
    id: r.id,
    trainerId: r.trainer_id,
    projectId: r.project_id ?? undefined,
    date: r.date,
    category: r.category,
    amount: Number(r.amount),
    description: r.description,
    status: r.status,
    rejectionReason: r.rejection_reason ?? undefined,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at ?? undefined,
    reviewedByAdminId: r.reviewed_by_admin_id ?? undefined,
    receiptUrl: r.receipt_url ?? undefined,
  };
}

function rowToUnavailabilityBlock(r: Row): UnavailabilityBlock {
  return {
    id: r.id,
    trainerId: r.trainer_id,
    type: r.type,
    startDate: r.start_date,
    endDate: r.end_date ?? undefined,
    startTime: r.start_time ?? undefined,
    endTime: r.end_time ?? undefined,
    recurringDayOfWeek: r.recurring_day_of_week ?? undefined,
    reason: r.reason ?? undefined,
    createdAt: r.created_at,
  };
}

const SEVERITY_RANK: Record<Flag["severity"], number> = { warning: 0, info: 1 };

export class PostgresDataStore implements DataStore {
  private requireAdmin(actor: Actor, action: string): void {
    if (actor.role !== "admin") {
      throw new ForbiddenError(`Only admins can ${action}.`);
    }
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await sql`SELECT * FROM users WHERE username = ${username} LIMIT 1`;
    return result.rows.length ? rowToUser(result.rows[0]) : null;
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
    return result.rows.length ? rowToUser(result.rows[0]) : null;
  }

  async listTrainers(): Promise<PublicUser[]> {
    const result = await sql`SELECT * FROM users WHERE role = 'trainer' ORDER BY name`;
    return result.rows.map((r) => toPublicUser(rowToUser(r)));
  }

  async createTrainer(input: CreateTrainerInput, actor: Actor): Promise<PublicUser> {
    this.requireAdmin(actor, "create trainer accounts");

    const existing = await sql`SELECT id FROM users WHERE username = ${input.username} LIMIT 1`;
    if (existing.rows.length) {
      throw new Error(`Username "${input.username}" is already taken.`);
    }

    const id = genId();
    await sql`
      INSERT INTO users (id, role, username, password_hash, name, email, active)
      VALUES (${id}, 'trainer', ${input.username}, ${input.passwordHash}, ${input.name}, ${input.email}, true)
    `;
    const result = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
    return toPublicUser(rowToUser(result.rows[0]));
  }

  async setTrainerActive(trainerId: string, active: boolean, actor: Actor): Promise<PublicUser> {
    this.requireAdmin(actor, "deactivate or reactivate trainer accounts");

    const check = await sql`SELECT id FROM users WHERE id = ${trainerId} AND role = 'trainer' LIMIT 1`;
    if (!check.rows.length) throw new Error(`Trainer "${trainerId}" not found.`);

    await sql`UPDATE users SET active = ${active} WHERE id = ${trainerId}`;
    const result = await sql`SELECT * FROM users WHERE id = ${trainerId} LIMIT 1`;
    return toPublicUser(rowToUser(result.rows[0]));
  }

  async updateUserPassword(userId: string, passwordHash: string, actor: Actor): Promise<PublicUser> {
    if (actor.role === "trainer" && actor.id !== userId) {
      throw new ForbiddenError("Trainers can only change their own password.");
    }

    const check = await sql`SELECT id FROM users WHERE id = ${userId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`User "${userId}" not found.`);

    await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
    const result = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
    return toPublicUser(rowToUser(result.rows[0]));
  }

  // ── Projects ───────────────────────────────────────────────────────────────

  async listProjects(): Promise<Project[]> {
    const result = await sql`SELECT * FROM projects ORDER BY name`;
    return result.rows.map(rowToProject);
  }

  async getProject(id: string): Promise<Project | null> {
    const result = await sql`SELECT * FROM projects WHERE id = ${id} LIMIT 1`;
    return result.rows.length ? rowToProject(result.rows[0]) : null;
  }

  async createProject(input: CreateProjectInput, actor: Actor): Promise<Project> {
    this.requireAdmin(actor, "create projects");

    const id = genId();
    await sql`
      INSERT INTO projects (id, name, product_line, color, status, project_id, bcc_email, notes)
      VALUES (${id}, ${input.name}, ${input.productLine}, ${input.color}, 'active',
              ${input.projectId}, ${input.bccEmail}, ${input.notes ?? null})
    `;
    const result = await sql`SELECT * FROM projects WHERE id = ${id} LIMIT 1`;
    return rowToProject(result.rows[0]);
  }

  async setProjectStatus(projectId: string, status: Project["status"], actor: Actor): Promise<Project> {
    this.requireAdmin(actor, "change a project's status");

    const check = await sql`SELECT id FROM projects WHERE id = ${projectId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Project "${projectId}" not found.`);

    await sql`UPDATE projects SET status = ${status} WHERE id = ${projectId}`;
    const result = await sql`SELECT * FROM projects WHERE id = ${projectId} LIMIT 1`;
    return rowToProject(result.rows[0]);
  }

  async updateProjectDetails(projectId: string, updates: UpdateProjectInput, actor: Actor): Promise<Project> {
    this.requireAdmin(actor, "edit a project's details");

    const check = await sql`SELECT id FROM projects WHERE id = ${projectId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Project "${projectId}" not found.`);

    const notes = updates.notes?.trim() || null;
    await sql`
      UPDATE projects
      SET name = ${updates.name}, product_line = ${updates.productLine}, color = ${updates.color},
          project_id = ${updates.projectId}, bcc_email = ${updates.bccEmail}, notes = ${notes}
      WHERE id = ${projectId}
    `;
    const result = await sql`SELECT * FROM projects WHERE id = ${projectId} LIMIT 1`;
    return rowToProject(result.rows[0]);
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async listTasksForTrainer(trainerId: string): Promise<Task[]> {
    const result = await sql`SELECT * FROM tasks WHERE trainer_id = ${trainerId}`;
    return result.rows.map(rowToTask);
  }

  async listAllTasks(): Promise<Task[]> {
    const result = await sql`SELECT * FROM tasks`;
    return result.rows.map(rowToTask);
  }

  async createTask(input: CreateTaskInput, actor: Actor): Promise<Task> {
    const projCheck = await sql`SELECT id FROM projects WHERE id = ${input.projectId} LIMIT 1`;
    if (!projCheck.rows.length) throw new Error(`Project "${input.projectId}" not found.`);

    let trainerId: string;
    if (actor.role === "trainer") {
      trainerId = actor.id;
    } else {
      this.requireAdmin(actor, "create a checklist task for a trainer");
      if (!input.trainerId) throw new Error("trainerId is required when an admin creates a task.");
      const trainerCheck = await sql`SELECT id FROM users WHERE id = ${input.trainerId} AND role = 'trainer' LIMIT 1`;
      if (!trainerCheck.rows.length) throw new Error(`Trainer "${input.trainerId}" not found.`);
      trainerId = input.trainerId;
    }

    const id = genId();
    await sql`
      INSERT INTO tasks (id, project_id, trainer_id, title, billable, status)
      VALUES (${id}, ${input.projectId}, ${trainerId}, ${input.title}, ${input.billable}, 'not_started')
    `;
    const result = await sql`SELECT * FROM tasks WHERE id = ${id} LIMIT 1`;
    return rowToTask(result.rows[0]);
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, actor: Actor): Promise<Task> {
    const check = await sql`SELECT * FROM tasks WHERE id = ${taskId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Task "${taskId}" not found.`);

    const task = rowToTask(check.rows[0]);
    if (actor.role === "trainer" && task.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only update their own tasks.");
    }

    await sql`UPDATE tasks SET status = ${status} WHERE id = ${taskId}`;
    return { ...task, status };
  }

  async deleteTask(taskId: string, actor: Actor): Promise<void> {
    this.requireAdmin(actor, "delete tasks");

    const check = await sql`SELECT id FROM tasks WHERE id = ${taskId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Task "${taskId}" not found.`);

    await sql`DELETE FROM tasks WHERE id = ${taskId}`;
  }

  // ── Bookings ───────────────────────────────────────────────────────────────

  async listBookingsForTrainer(trainerId: string): Promise<Booking[]> {
    const result = await sql`SELECT * FROM bookings WHERE trainer_id = ${trainerId}`;
    return result.rows.map(rowToBooking);
  }

  async listAllBookings(): Promise<Booking[]> {
    const result = await sql`SELECT * FROM bookings`;
    return result.rows.map(rowToBooking);
  }

  async getBooking(id: string): Promise<Booking | null> {
    const result = await sql`SELECT * FROM bookings WHERE id = ${id} LIMIT 1`;
    return result.rows.length ? rowToBooking(result.rows[0]) : null;
  }

  async createBooking(input: CreateBookingInput, actor: Actor): Promise<Booking> {
    this.requireAdmin(actor, "create bookings");

    const projCheck = await sql`SELECT id FROM projects WHERE id = ${input.projectId} LIMIT 1`;
    if (!projCheck.rows.length) throw new Error(`Project "${input.projectId}" not found.`);

    const trainerCheck = await sql`SELECT * FROM users WHERE id = ${input.trainerId} AND role = 'trainer' LIMIT 1`;
    if (!trainerCheck.rows.length) throw new Error(`Trainer "${input.trainerId}" not found.`);

    const officeCheck = await sql`SELECT * FROM offices WHERE id = ${input.officeId} LIMIT 1`;
    if (!officeCheck.rows.length) throw new Error(`Office "${input.officeId}" not found.`);
    if (officeCheck.rows[0].project_id !== input.projectId) {
      throw new Error(`Office "${input.officeId}" does not belong to project "${input.projectId}".`);
    }

    if (new Date(input.endTime) <= new Date(input.startTime)) {
      throw new Error("End time must be after start time.");
    }

    const existingBookings = await this.listBookingsForTrainer(input.trainerId);
    const conflict = findConflictingBooking(existingBookings, input.trainerId, {
      startTime: input.startTime,
      endTime: input.endTime,
    });
    if (conflict) {
      const trainerName = rowToUser(trainerCheck.rows[0]).name;
      throw new BookingConflictError(
        `${trainerName} already has a booking that overlaps this time.`,
        conflict
      );
    }

    const id = genId();
    const statusChangedAt = new Date().toISOString();
    await sql`
      INSERT INTO bookings
        (id, trainer_id, project_id, office_id, title, start_time, end_time,
         location, billable, billable_set_by_admin, status, notes, status_changed_at)
      VALUES
        (${id}, ${input.trainerId}, ${input.projectId}, ${input.officeId},
         ${input.title}, ${input.startTime}, ${input.endTime},
         ${input.location}, ${input.billable}, true, 'pending',
         ${input.notes ?? null}, ${statusChangedAt})
    `;

    const result = await sql`SELECT * FROM bookings WHERE id = ${id} LIMIT 1`;
    const booking = rowToBooking(result.rows[0]);

    await this.createNotification({
      type: "booking_created",
      recipientRole: "trainer",
      message: `New booking request: "${booking.title}" (${formatDateRange(booking.startTime, booking.endTime)}).`,
      relatedTrainerId: booking.trainerId,
      relatedEntityId: booking.id,
    });

    return booking;
  }

  async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    actor: Actor,
    reason?: string
  ): Promise<Booking> {
    const check = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Booking "${bookingId}" not found.`);

    const booking = rowToBooking(check.rows[0]);

    if (actor.role === "trainer") {
      if (booking.trainerId !== actor.id) {
        throw new ForbiddenError("Trainers can only update their own bookings.");
      }
      if (status === "pending") {
        if (booking.status !== "accepted" && booking.status !== "rejected") {
          throw new ForbiddenError("Only an accepted or rejected booking can be reverted to pending.");
        }
        if (!isWithinUndoWindow(booking.statusChangedAt)) {
          throw new ForbiddenError("The undo window for this booking has expired.");
        }
      } else if (status !== "accepted" && status !== "rejected") {
        throw new ForbiddenError("Trainers can only accept, reject, or undo a recent status change.");
      }
    }

    const statusChangedAt = new Date().toISOString();
    const rejectionReason = status === "rejected" ? (reason?.trim() || null) : null;
    await sql`
      UPDATE bookings
      SET status = ${status}, status_changed_at = ${statusChangedAt}, rejection_reason = ${rejectionReason}
      WHERE id = ${bookingId}
    `;

    const result = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    return rowToBooking(result.rows[0]);
  }

  async setBookingBillable(bookingId: string, billable: BillableStatus, actor: Actor): Promise<Booking> {
    this.requireAdmin(actor, "set or change a booking's billable status");

    const check = await sql`SELECT id FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Booking "${bookingId}" not found.`);

    await sql`UPDATE bookings SET billable = ${billable}, billable_set_by_admin = true WHERE id = ${bookingId}`;
    const result = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    return rowToBooking(result.rows[0]);
  }

  async updateBookingDetails(bookingId: string, updates: UpdateBookingDetailsInput, actor: Actor): Promise<Booking> {
    this.requireAdmin(actor, "edit a booking's time or location");

    const check = await sql`SELECT id FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Booking "${bookingId}" not found.`);

    if (new Date(updates.endTime) <= new Date(updates.startTime)) {
      throw new Error("End time must be after start time.");
    }

    await sql`
      UPDATE bookings SET start_time = ${updates.startTime}, end_time = ${updates.endTime}, location = ${updates.location}
      WHERE id = ${bookingId}
    `;
    const result = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    return rowToBooking(result.rows[0]);
  }

  async requestBookingCancellation(bookingId: string, reason: string, actor: Actor): Promise<Booking> {
    const check = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Booking "${bookingId}" not found.`);

    const booking = rowToBooking(check.rows[0]);
    if (actor.role !== "trainer" || booking.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only request cancellation of their own bookings.");
    }
    if (booking.status !== "accepted") {
      throw new ForbiddenError("Only an accepted booking can have its cancellation requested.");
    }

    const trimmed = reason.trim();
    if (!trimmed) throw new Error("A cancellation reason is required.");

    const statusChangedAt = new Date().toISOString();
    await sql`
      UPDATE bookings
      SET status = 'cancellation_requested', cancellation_reason = ${trimmed}, status_changed_at = ${statusChangedAt}
      WHERE id = ${bookingId}
    `;

    const trainerResult = await sql`SELECT name FROM users WHERE id = ${booking.trainerId} LIMIT 1`;
    const trainerName = trainerResult.rows[0]?.name ?? "A trainer";

    await this.createNotification({
      type: "cancellation_request",
      message: `${trainerName} requested to cancel "${booking.title}" (${formatDateRange(booking.startTime, booking.endTime)}).`,
      relatedTrainerId: booking.trainerId,
      relatedEntityId: booking.id,
    });

    const result = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    return rowToBooking(result.rows[0]);
  }

  async approveBookingCancellation(bookingId: string, actor: Actor): Promise<Booking> {
    this.requireAdmin(actor, "approve a booking cancellation");

    const check = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Booking "${bookingId}" not found.`);

    const booking = rowToBooking(check.rows[0]);
    if (booking.status !== "cancellation_requested") {
      throw new Error("Only a booking with a pending cancellation request can be approved.");
    }

    const statusChangedAt = new Date().toISOString();
    await sql`UPDATE bookings SET status = 'cancelled', status_changed_at = ${statusChangedAt} WHERE id = ${bookingId}`;

    await this.createNotification({
      type: "cancellation_decision",
      recipientRole: "trainer",
      message: `Your cancellation request for "${booking.title}" was approved — the booking is cancelled.`,
      relatedTrainerId: booking.trainerId,
      relatedEntityId: booking.id,
    });

    const result = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    return rowToBooking(result.rows[0]);
  }

  async denyBookingCancellation(bookingId: string, actor: Actor): Promise<Booking> {
    this.requireAdmin(actor, "deny a booking cancellation");

    const check = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Booking "${bookingId}" not found.`);

    const booking = rowToBooking(check.rows[0]);
    if (booking.status !== "cancellation_requested") {
      throw new Error("Only a booking with a pending cancellation request can be denied.");
    }

    const statusChangedAt = new Date().toISOString();
    await sql`
      UPDATE bookings
      SET status = 'accepted', cancellation_reason = null, status_changed_at = ${statusChangedAt}
      WHERE id = ${bookingId}
    `;

    await this.createNotification({
      type: "cancellation_decision",
      recipientRole: "trainer",
      message: `Your cancellation request for "${booking.title}" was denied.`,
      relatedTrainerId: booking.trainerId,
      relatedEntityId: booking.id,
    });

    const result = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    return rowToBooking(result.rows[0]);
  }

  async adminCancelBooking(bookingId: string, actor: Actor, reason?: string): Promise<Booking> {
    this.requireAdmin(actor, "cancel a booking");

    const check = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Booking "${bookingId}" not found.`);

    const booking = rowToBooking(check.rows[0]);
    if (booking.status === "cancelled") throw new Error("This booking is already cancelled.");

    const trimmedReason = reason?.trim() || null;
    const statusChangedAt = new Date().toISOString();
    await sql`
      UPDATE bookings
      SET status = 'cancelled', cancellation_reason = ${trimmedReason}, status_changed_at = ${statusChangedAt}
      WHERE id = ${bookingId}
    `;

    await this.createNotification({
      type: "booking_cancelled",
      recipientRole: "trainer",
      message: trimmedReason
        ? `Your booking "${booking.title}" (${formatDateRange(booking.startTime, booking.endTime)}) was cancelled by an admin: "${trimmedReason}"`
        : `Your booking "${booking.title}" (${formatDateRange(booking.startTime, booking.endTime)}) was cancelled by an admin.`,
      relatedTrainerId: booking.trainerId,
      relatedEntityId: booking.id,
    });

    const result = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    return rowToBooking(result.rows[0]);
  }

  async adminRescheduleBooking(
    bookingId: string,
    updates: UpdateBookingDetailsInput,
    actor: Actor,
    billable?: BillableStatus,
    reason?: string
  ): Promise<Booking> {
    this.requireAdmin(actor, "reschedule a booking");

    await this.updateBookingDetails(bookingId, updates, actor);
    if (billable !== undefined) {
      await this.setBookingBillable(bookingId, billable, actor);
    }

    const statusChangedAt = new Date().toISOString();
    await sql`
      UPDATE bookings
      SET status = 'pending', cancellation_reason = null, rejection_reason = null, status_changed_at = ${statusChangedAt}
      WHERE id = ${bookingId}
    `;

    const result = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    const booking = rowToBooking(result.rows[0]);

    const trimmedReason = reason?.trim() || undefined;
    const window = formatDateRange(booking.startTime, booking.endTime);
    await this.createNotification({
      type: "booking_rescheduled",
      recipientRole: "trainer",
      message: trimmedReason
        ? `Your booking "${booking.title}" was rescheduled to ${window} — please re-confirm. Reason: "${trimmedReason}"`
        : `Your booking "${booking.title}" was rescheduled to ${window} — please re-confirm.`,
      relatedTrainerId: booking.trainerId,
      relatedEntityId: booking.id,
    });

    return booking;
  }

  // ── Time Clock ─────────────────────────────────────────────────────────────

  async listTimeClockEvents(trainerId: string): Promise<TimeClockEvent[]> {
    const result = await sql`SELECT * FROM time_clock_events WHERE trainer_id = ${trainerId} ORDER BY timestamp`;
    return result.rows.map(rowToTimeClockEvent);
  }

  async listAllTimeClockEvents(): Promise<TimeClockEvent[]> {
    const result = await sql`SELECT * FROM time_clock_events ORDER BY timestamp`;
    return result.rows.map(rowToTimeClockEvent);
  }

  async addTimeClockEvent(trainerId: string, type: TimeClockEventType, actor: Actor): Promise<TimeClockEvent> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError("Trainers can only log time clock events for themselves.");
    }

    const weekStart = weekStartDateFor(toLocalDateString(new Date()));
    const tsCheck = await sql`
      SELECT * FROM timesheet_submissions WHERE trainer_id = ${trainerId} AND week_start_date = ${weekStart} LIMIT 1
    `;
    const tsSubmission = tsCheck.rows.length ? rowToTimesheetSubmission(tsCheck.rows[0]) : null;
    if (computeWeekLockState(tsSubmission) === "locked") {
      throw new ForbiddenError("This week's timesheet has been submitted for review and is locked.");
    }

    const existingEvents = await this.listTimeClockEvents(trainerId);
    const currentStatus = computeClockStatus(existingEvents);
    const allowedTypes = nextAllowedEventTypes(currentStatus);
    if (!allowedTypes.includes(type)) {
      throw new Error(`Cannot log "${type}" while ${currentStatus.replace("_", " ")}.`);
    }

    const id = genId();
    const timestamp = new Date().toISOString();
    await sql`
      INSERT INTO time_clock_events (id, trainer_id, type, timestamp, manually_logged)
      VALUES (${id}, ${trainerId}, ${type}, ${timestamp}, null)
    `;

    const result = await sql`SELECT * FROM time_clock_events WHERE id = ${id} LIMIT 1`;
    return rowToTimeClockEvent(result.rows[0]);
  }

  // ── Offices ────────────────────────────────────────────────────────────────

  async listOfficesForProject(projectId: string): Promise<Office[]> {
    const result = await sql`SELECT * FROM offices WHERE project_id = ${projectId}`;
    return result.rows.map(rowToOffice);
  }

  async createOffice(input: CreateOfficeInput, actor: Actor): Promise<Office> {
    this.requireAdmin(actor, "manage a project's office list");

    const projCheck = await sql`SELECT id FROM projects WHERE id = ${input.projectId} LIMIT 1`;
    if (!projCheck.rows.length) throw new Error(`Project "${input.projectId}" not found.`);

    const id = genId();
    await sql`
      INSERT INTO offices (id, project_id, name, active)
      VALUES (${id}, ${input.projectId}, ${input.name}, true)
    `;
    const result = await sql`SELECT * FROM offices WHERE id = ${id} LIMIT 1`;
    return rowToOffice(result.rows[0]);
  }

  async setOfficeActive(officeId: string, active: boolean, actor: Actor): Promise<Office> {
    this.requireAdmin(actor, "manage the office list");

    const check = await sql`SELECT id FROM offices WHERE id = ${officeId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Office "${officeId}" not found.`);

    await sql`UPDATE offices SET active = ${active} WHERE id = ${officeId}`;
    const result = await sql`SELECT * FROM offices WHERE id = ${officeId} LIMIT 1`;
    return rowToOffice(result.rows[0]);
  }

  async setOfficeCompleted(officeId: string, completed: boolean, actor: Actor): Promise<Office> {
    this.requireAdmin(actor, "manage the office list");

    const check = await sql`SELECT id FROM offices WHERE id = ${officeId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Office "${officeId}" not found.`);

    const active = completed ? false : true;
    await sql`UPDATE offices SET completed = ${completed}, active = ${active} WHERE id = ${officeId}`;
    const result = await sql`SELECT * FROM offices WHERE id = ${officeId} LIMIT 1`;
    return rowToOffice(result.rows[0]);
  }

  // ── Task Entries ───────────────────────────────────────────────────────────

  async listTaskEntriesForTrainer(trainerId: string): Promise<TaskEntry[]> {
    const result = await sql`SELECT * FROM task_entries WHERE trainer_id = ${trainerId}`;
    return result.rows.map(rowToTaskEntry);
  }

  async listAllTaskEntries(): Promise<TaskEntry[]> {
    const result = await sql`SELECT * FROM task_entries`;
    return result.rows.map(rowToTaskEntry);
  }

  async createTaskEntry(input: CreateTaskEntryInput, actor: Actor): Promise<TaskEntry> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can log their own task entries.");
    }

    const weekStart = weekStartDateFor(input.date);
    const wsCheck = await sql`
      SELECT * FROM weekly_submissions WHERE trainer_id = ${actor.id} AND week_start_date = ${weekStart} LIMIT 1
    `;
    const submission = wsCheck.rows.length ? rowToWeeklySubmission(wsCheck.rows[0]) : null;
    if (computeWeekLockState(submission) === "locked") {
      throw new ForbiddenError("This week has been submitted for review and is locked.");
    }

    const projCheck = await sql`SELECT id FROM projects WHERE id = ${input.projectId} LIMIT 1`;
    if (!projCheck.rows.length) throw new Error(`Project "${input.projectId}" not found.`);

    const officeCheck = await sql`
      SELECT id FROM offices WHERE project_id = ${input.projectId} AND name = ${input.office} LIMIT 1
    `;
    if (!officeCheck.rows.length) {
      throw new Error(`Office "${input.office}" is not one of this project's offices.`);
    }

    const taskCheck = await sql`SELECT * FROM tasks WHERE id = ${input.taskId} LIMIT 1`;
    if (!taskCheck.rows.length) throw new Error(`Task "${input.taskId}" not found.`);
    const task = rowToTask(taskCheck.rows[0]);
    if (task.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only log entries against their own tasks.");
    }
    if (task.projectId !== input.projectId) {
      throw new Error(`Task "${input.taskId}" does not belong to project "${input.projectId}".`);
    }

    if (input.bookingId) {
      const bkCheck = await sql`SELECT * FROM bookings WHERE id = ${input.bookingId} LIMIT 1`;
      if (!bkCheck.rows.length) throw new Error(`Booking "${input.bookingId}" not found.`);
      if (bkCheck.rows[0].trainer_id !== actor.id) {
        throw new ForbiddenError("Trainers can only link task entries to their own bookings.");
      }
    }

    if (!input.note.trim()) throw new Error("A note is required.");
    if (!(input.hours > 0)) throw new Error("Hours must be a positive number.");

    const id = genId();
    const createdAt = new Date().toISOString();
    await sql`
      INSERT INTO task_entries
        (id, trainer_id, date, project_id, office, task_id, note, hours, location, booking_id, created_at)
      VALUES
        (${id}, ${actor.id}, ${input.date}, ${input.projectId}, ${input.office},
         ${input.taskId}, ${input.note}, ${input.hours}, ${input.location ?? null},
         ${input.bookingId ?? null}, ${createdAt})
    `;

    const result = await sql`SELECT * FROM task_entries WHERE id = ${id} LIMIT 1`;
    return rowToTaskEntry(result.rows[0]);
  }

  async updateTaskEntry(entryId: string, updates: UpdateTaskEntryInput, actor: Actor): Promise<TaskEntry> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can edit their own task entries.");
    }

    const check = await sql`SELECT * FROM task_entries WHERE id = ${entryId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Task entry "${entryId}" not found.`);
    const entry = rowToTaskEntry(check.rows[0]);

    if (entry.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only edit their own entries.");
    }

    const weekStart = weekStartDateFor(entry.date);
    const wsCheck = await sql`
      SELECT * FROM weekly_submissions WHERE trainer_id = ${entry.trainerId} AND week_start_date = ${weekStart} LIMIT 1
    `;
    const submission = wsCheck.rows.length ? rowToWeeklySubmission(wsCheck.rows[0]) : null;
    const lockState = computeWeekLockState(submission);

    if (lockState === "locked") {
      throw new ForbiddenError("This week has been submitted for review and is locked.");
    }
    if (lockState !== "unlocked_by_rejection") {
      const currentWeek = getBusinessWeekDays(new Date());
      if (!isDateInWeek(entry.date, currentWeek)) {
        throw new ForbiddenError("Past weeks are locked — only entries from the current week can be edited.");
      }
    }

    const projCheck = await sql`SELECT id FROM projects WHERE id = ${updates.projectId} LIMIT 1`;
    if (!projCheck.rows.length) throw new Error(`Project "${updates.projectId}" not found.`);

    const officeCheck = await sql`
      SELECT id FROM offices WHERE project_id = ${updates.projectId} AND name = ${updates.office} LIMIT 1
    `;
    if (!officeCheck.rows.length) {
      throw new Error(`Office "${updates.office}" is not one of this project's offices.`);
    }

    const taskCheck = await sql`SELECT * FROM tasks WHERE id = ${updates.taskId} LIMIT 1`;
    if (!taskCheck.rows.length) throw new Error(`Task "${updates.taskId}" not found.`);
    const task = rowToTask(taskCheck.rows[0]);
    if (task.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only log entries against their own tasks.");
    }
    if (task.projectId !== updates.projectId) {
      throw new Error(`Task "${updates.taskId}" does not belong to project "${updates.projectId}".`);
    }

    if (!updates.note.trim()) throw new Error("A note is required.");
    if (!(updates.hours > 0)) throw new Error("Hours must be a positive number.");

    await sql`
      UPDATE task_entries
      SET project_id = ${updates.projectId}, office = ${updates.office}, task_id = ${updates.taskId},
          note = ${updates.note}, hours = ${updates.hours}, location = ${updates.location ?? null}
      WHERE id = ${entryId}
    `;

    const result = await sql`SELECT * FROM task_entries WHERE id = ${entryId} LIMIT 1`;
    return rowToTaskEntry(result.rows[0]);
  }

  async deleteTaskEntry(entryId: string, actor: Actor): Promise<void> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can delete their own task entries.");
    }

    const check = await sql`SELECT * FROM task_entries WHERE id = ${entryId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Task entry "${entryId}" not found.`);
    const entry = rowToTaskEntry(check.rows[0]);

    if (entry.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only delete their own entries.");
    }

    const weekStart = weekStartDateFor(entry.date);
    const wsCheck = await sql`
      SELECT * FROM weekly_submissions WHERE trainer_id = ${entry.trainerId} AND week_start_date = ${weekStart} LIMIT 1
    `;
    const submission = wsCheck.rows.length ? rowToWeeklySubmission(wsCheck.rows[0]) : null;
    const lockState = computeWeekLockState(submission);

    if (lockState === "locked") {
      throw new ForbiddenError("This week has been submitted for review and is locked.");
    }
    if (lockState !== "unlocked_by_rejection") {
      const currentWeek = getBusinessWeekDays(new Date());
      if (!isDateInWeek(entry.date, currentWeek)) {
        throw new ForbiddenError("Past weeks are locked — only entries from the current week can be edited.");
      }
    }

    await sql`DELETE FROM task_entries WHERE id = ${entryId}`;
  }

  // ── Favorite Tasks ─────────────────────────────────────────────────────────

  async listFavoriteTasksForTrainer(trainerId: string): Promise<FavoriteTask[]> {
    const result = await sql`SELECT * FROM favorite_tasks WHERE trainer_id = ${trainerId}`;
    return result.rows.map(rowToFavoriteTask);
  }

  async addFavoriteTask(taskName: string, actor: Actor): Promise<FavoriteTask> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can manage their own favorites.");
    }

    const trimmed = taskName.trim();
    if (!trimmed) throw new Error("A task name is required.");

    const existing = await sql`
      SELECT * FROM favorite_tasks
      WHERE trainer_id = ${actor.id} AND LOWER(task_name) = LOWER(${trimmed})
      LIMIT 1
    `;
    if (existing.rows.length) return rowToFavoriteTask(existing.rows[0]);

    const id = genId();
    const createdAt = new Date().toISOString();
    await sql`
      INSERT INTO favorite_tasks (id, trainer_id, task_name, created_at)
      VALUES (${id}, ${actor.id}, ${trimmed}, ${createdAt})
    `;
    const result = await sql`SELECT * FROM favorite_tasks WHERE id = ${id} LIMIT 1`;
    return rowToFavoriteTask(result.rows[0]);
  }

  async removeFavoriteTask(favoriteId: string, actor: Actor): Promise<void> {
    const check = await sql`SELECT * FROM favorite_tasks WHERE id = ${favoriteId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Favorite "${favoriteId}" not found.`);

    const favorite = rowToFavoriteTask(check.rows[0]);
    if (favorite.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only remove their own favorites.");
    }

    await sql`DELETE FROM favorite_tasks WHERE id = ${favoriteId}`;
  }

  // ── Flags ──────────────────────────────────────────────────────────────────

  async getFlagThresholds(): Promise<FlagThresholds> {
    const result = await sql`SELECT * FROM flag_thresholds LIMIT 1`;
    if (!result.rows.length) {
      return { unsubmittedTaskTrackerDays: 3, pendingBookingUnansweredHours: 48, inactiveTrainerDays: 5 };
    }
    const r = result.rows[0];
    return {
      unsubmittedTaskTrackerDays: Number(r.unsubmitted_task_tracker_days),
      pendingBookingUnansweredHours: Number(r.pending_booking_unanswered_hours),
      inactiveTrainerDays: Number(r.inactive_trainer_days),
    };
  }

  async updateFlagThresholds(input: FlagThresholds, actor: Actor): Promise<FlagThresholds> {
    this.requireAdmin(actor, "configure flag thresholds");

    if (
      !(input.unsubmittedTaskTrackerDays > 0) ||
      !(input.pendingBookingUnansweredHours > 0) ||
      !(input.inactiveTrainerDays > 0)
    ) {
      throw new Error("Every threshold must be a positive number.");
    }

    await sql`
      INSERT INTO flag_thresholds (id, unsubmitted_task_tracker_days, pending_booking_unanswered_hours, inactive_trainer_days)
      VALUES (1, ${input.unsubmittedTaskTrackerDays}, ${input.pendingBookingUnansweredHours}, ${input.inactiveTrainerDays})
      ON CONFLICT (id) DO UPDATE
        SET unsubmitted_task_tracker_days = EXCLUDED.unsubmitted_task_tracker_days,
            pending_booking_unanswered_hours = EXCLUDED.pending_booking_unanswered_hours,
            inactive_trainer_days = EXCLUDED.inactive_trainer_days
    `;
    return input;
  }

  private async reconcileFlags(trainerId?: string): Promise<FlagRecord[]> {
    const thresholds = await this.getFlagThresholds();

    const [allTrainers, bookings, taskEntries, timeClockEvents, projects] = await Promise.all([
      this.listTrainers(),
      trainerId ? this.listBookingsForTrainer(trainerId) : this.listAllBookings(),
      trainerId ? this.listTaskEntriesForTrainer(trainerId) : this.listAllTaskEntries(),
      trainerId ? this.listTimeClockEvents(trainerId) : this.listAllTimeClockEvents(),
      this.listProjects(),
    ]);

    const trainers = trainerId ? allTrainers.filter((t) => t.id === trainerId) : allTrainers;

    const candidates = computeFlagCandidates({
      trainers,
      bookings,
      taskEntries,
      timeClockEvents,
      projects,
      thresholds,
      now: new Date(),
    });

    const existingResult = trainerId
      ? await sql`SELECT * FROM flag_records WHERE trainer_id = ${trainerId}`
      : await sql`SELECT * FROM flag_records`;
    const existingRecords = existingResult.rows.map(rowToFlagRecord);

    const candidateKeys = new Set(candidates.map((c) => c.key));
    const existingByKey = new Map(existingRecords.map((r) => [r.key, r]));

    // Delete resolved situations
    const toDelete = existingRecords.filter((r) => !candidateKeys.has(r.key));
    for (const record of toDelete) {
      await sql`DELETE FROM flag_records WHERE id = ${record.id}`;
    }

    const now = new Date().toISOString();
    const resultRecords: FlagRecord[] = [];

    for (const candidate of candidates) {
      const existing = existingByKey.get(candidate.key);

      if (!existing) {
        const flagId = genId();
        await sql`
          INSERT INTO flag_records
            (id, key, signature, trainer_id, type, message, related_booking_id, related_project_id,
             severity, status, created_at)
          VALUES
            (${flagId}, ${candidate.key}, ${candidate.signature}, ${candidate.trainerId},
             ${candidate.type}, ${candidate.message}, ${candidate.relatedBookingId ?? null},
             ${candidate.relatedProjectId ?? null}, ${candidate.severity}, 'active', ${now})
        `;

        if (candidate.type !== "cancellation_requested") {
          await this.createNotification({
            type: "flag",
            message: candidate.message,
            relatedTrainerId: candidate.trainerId,
            relatedEntityId: flagId,
          });
        }

        resultRecords.push({
          id: flagId,
          key: candidate.key,
          signature: candidate.signature,
          trainerId: candidate.trainerId,
          type: candidate.type,
          message: candidate.message,
          relatedBookingId: candidate.relatedBookingId,
          relatedProjectId: candidate.relatedProjectId,
          severity: candidate.severity,
          status: "active",
          createdAt: now,
        });
      } else {
        let newStatus = existing.status;
        let newDismissedAt = existing.dismissedAt ?? null;
        let newDismissedByNote = existing.dismissedByNote ?? null;

        if (existing.status === "dismissed" && existing.signature !== candidate.signature) {
          newStatus = "active";
          newDismissedAt = null;
          newDismissedByNote = null;
        }

        await sql`
          UPDATE flag_records
          SET signature = ${candidate.signature}, message = ${candidate.message},
              severity = ${candidate.severity},
              related_booking_id = ${candidate.relatedBookingId ?? null},
              related_project_id = ${candidate.relatedProjectId ?? null},
              status = ${newStatus}, dismissed_at = ${newDismissedAt},
              dismissed_by_note = ${newDismissedByNote}
          WHERE id = ${existing.id}
        `;

        resultRecords.push({
          ...existing,
          signature: candidate.signature,
          message: candidate.message,
          severity: candidate.severity,
          relatedBookingId: candidate.relatedBookingId,
          relatedProjectId: candidate.relatedProjectId,
          status: newStatus as Flag["status"],
          dismissedAt: newDismissedAt ?? undefined,
          dismissedByNote: newDismissedByNote ?? undefined,
        });
      }
    }

    return resultRecords;
  }

  private toSortedActiveFlags(records: FlagRecord[]): Flag[] {
    return records
      .filter((r) => r.status === "active")
      .sort(
        (a, b) =>
          SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
          b.createdAt.localeCompare(a.createdAt)
      )
      .map(toFlag);
  }

  async listActiveFlags(actor: Actor): Promise<Flag[]> {
    this.requireAdmin(actor, "view flags");
    const records = await this.reconcileFlags();
    return this.toSortedActiveFlags(records);
  }

  async listActiveFlagsForTrainer(trainerId: string, actor: Actor): Promise<Flag[]> {
    this.requireAdmin(actor, "view flags");
    const records = await this.reconcileFlags(trainerId);
    return this.toSortedActiveFlags(records);
  }

  async dismissFlag(flagId: string, input: DismissFlagInput, actor: Actor): Promise<Flag> {
    this.requireAdmin(actor, "dismiss flags");

    const check = await sql`SELECT * FROM flag_records WHERE id = ${flagId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Flag "${flagId}" not found.`);

    const dismissedAt = new Date().toISOString();
    const note = input.note?.trim() || null;
    await sql`
      UPDATE flag_records
      SET status = 'dismissed', dismissed_at = ${dismissedAt}, dismissed_by_note = ${note}
      WHERE id = ${flagId}
    `;

    const result = await sql`SELECT * FROM flag_records WHERE id = ${flagId} LIMIT 1`;
    return toFlag(rowToFlagRecord(result.rows[0]));
  }

  async dismissAllFlags(actor: Actor): Promise<Flag[]> {
    this.requireAdmin(actor, "dismiss flags");

    const activeResult = await sql`SELECT * FROM flag_records WHERE status = 'active'`;
    if (!activeResult.rows.length) return [];

    const now = new Date().toISOString();
    await sql`UPDATE flag_records SET status = 'dismissed', dismissed_at = ${now} WHERE status = 'active'`;

    return activeResult.rows.map((r) => toFlag(rowToFlagRecord(r)));
  }

  // ── Weekly Submissions ─────────────────────────────────────────────────────

  async listWeeklySubmissionsForTrainer(trainerId: string, actor: Actor): Promise<WeeklySubmission[]> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError("Trainers can only view their own weekly submissions.");
    }
    const result = await sql`SELECT * FROM weekly_submissions WHERE trainer_id = ${trainerId}`;
    return result.rows.map(rowToWeeklySubmission);
  }

  async listPendingWeeklySubmissions(actor: Actor): Promise<WeeklySubmission[]> {
    this.requireAdmin(actor, "review weekly submissions");
    const result = await sql`
      SELECT * FROM weekly_submissions WHERE status = 'submitted' ORDER BY submitted_at
    `;
    return result.rows.map(rowToWeeklySubmission);
  }

  async submitWeek(weekStartDate: string, actor: Actor): Promise<WeeklySubmission> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can submit their own weeks.");
    }

    const existing = await sql`
      SELECT * FROM weekly_submissions WHERE trainer_id = ${actor.id} AND week_start_date = ${weekStartDate} LIMIT 1
    `;
    const current = existing.rows.length ? rowToWeeklySubmission(existing.rows[0]) : null;

    if (current && (current.status === "submitted" || current.status === "approved")) {
      throw new Error("This week has already been submitted.");
    }

    const submittedAt = new Date().toISOString();

    if (current) {
      await sql`
        UPDATE weekly_submissions
        SET status = 'submitted', submitted_at = ${submittedAt},
            reviewed_at = null, reviewed_by_admin_id = null, rejection_reason = null
        WHERE trainer_id = ${actor.id} AND week_start_date = ${weekStartDate}
      `;
    } else {
      const id = genId();
      await sql`
        INSERT INTO weekly_submissions (id, trainer_id, week_start_date, status, submitted_at)
        VALUES (${id}, ${actor.id}, ${weekStartDate}, 'submitted', ${submittedAt})
      `;
    }

    const result = await sql`
      SELECT * FROM weekly_submissions WHERE trainer_id = ${actor.id} AND week_start_date = ${weekStartDate} LIMIT 1
    `;
    const submission = rowToWeeklySubmission(result.rows[0]);

    const trainerResult = await sql`SELECT name FROM users WHERE id = ${actor.id} LIMIT 1`;
    const trainerName = trainerResult.rows[0]?.name ?? "A trainer";
    await this.createNotification({
      type: "submission",
      message: `${trainerName} submitted their week of ${formatWeekLabel(weekStartDate)} for review.`,
      relatedTrainerId: actor.id,
      relatedEntityId: submission.id,
    });

    return submission;
  }

  async approveWeeklySubmission(submissionId: string, actor: Actor): Promise<WeeklySubmission> {
    this.requireAdmin(actor, "approve weekly submissions");

    const check = await sql`SELECT * FROM weekly_submissions WHERE id = ${submissionId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Weekly submission "${submissionId}" not found.`);
    const submission = rowToWeeklySubmission(check.rows[0]);
    if (submission.status !== "submitted") throw new Error("Only a submitted week can be approved.");

    const reviewedAt = new Date().toISOString();
    await sql`
      UPDATE weekly_submissions
      SET status = 'approved', reviewed_at = ${reviewedAt}, reviewed_by_admin_id = ${actor.id}, rejection_reason = null
      WHERE id = ${submissionId}
    `;

    await this.createNotification({
      type: "submission_decision",
      recipientRole: "trainer",
      message: `Your Task Tracker week of ${formatWeekLabel(submission.weekStartDate)} was approved.`,
      relatedTrainerId: submission.trainerId,
      relatedEntityId: submission.id,
    });

    const result = await sql`SELECT * FROM weekly_submissions WHERE id = ${submissionId} LIMIT 1`;
    return rowToWeeklySubmission(result.rows[0]);
  }

  async rejectWeeklySubmission(submissionId: string, reason: string, actor: Actor): Promise<WeeklySubmission> {
    this.requireAdmin(actor, "reject weekly submissions");

    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new Error("A rejection reason is required.");

    const check = await sql`SELECT * FROM weekly_submissions WHERE id = ${submissionId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Weekly submission "${submissionId}" not found.`);
    const submission = rowToWeeklySubmission(check.rows[0]);
    if (submission.status !== "submitted") throw new Error("Only a submitted week can be rejected.");

    const reviewedAt = new Date().toISOString();
    await sql`
      UPDATE weekly_submissions
      SET status = 'rejected', reviewed_at = ${reviewedAt}, reviewed_by_admin_id = ${actor.id},
          rejection_reason = ${trimmedReason}
      WHERE id = ${submissionId}
    `;

    await this.createNotification({
      type: "submission_decision",
      recipientRole: "trainer",
      message: `Your Task Tracker week of ${formatWeekLabel(submission.weekStartDate)} was rejected: "${trimmedReason}"`,
      relatedTrainerId: submission.trainerId,
      relatedEntityId: submission.id,
    });

    const result = await sql`SELECT * FROM weekly_submissions WHERE id = ${submissionId} LIMIT 1`;
    return rowToWeeklySubmission(result.rows[0]);
  }

  // ── Timesheet Submissions ──────────────────────────────────────────────────

  async listTimesheetSubmissionsForTrainer(trainerId: string, actor: Actor): Promise<TimesheetSubmission[]> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError("Trainers can only view their own timesheet submissions.");
    }
    const result = await sql`SELECT * FROM timesheet_submissions WHERE trainer_id = ${trainerId}`;
    return result.rows.map(rowToTimesheetSubmission);
  }

  async listPendingTimesheetSubmissions(actor: Actor): Promise<TimesheetSubmission[]> {
    this.requireAdmin(actor, "review timesheet submissions");
    const result = await sql`
      SELECT * FROM timesheet_submissions WHERE status = 'submitted' ORDER BY submitted_at
    `;
    return result.rows.map(rowToTimesheetSubmission);
  }

  async submitTimesheetWeek(weekStartDate: string, actor: Actor): Promise<TimesheetSubmission> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can submit their own timesheet.");
    }

    const existing = await sql`
      SELECT * FROM timesheet_submissions WHERE trainer_id = ${actor.id} AND week_start_date = ${weekStartDate} LIMIT 1
    `;
    const current = existing.rows.length ? rowToTimesheetSubmission(existing.rows[0]) : null;

    if (current && (current.status === "submitted" || current.status === "approved")) {
      throw new Error("This week's timesheet has already been submitted.");
    }

    const submittedAt = new Date().toISOString();

    if (current) {
      await sql`
        UPDATE timesheet_submissions
        SET status = 'submitted', submitted_at = ${submittedAt},
            reviewed_at = null, reviewed_by_admin_id = null, rejection_reason = null
        WHERE trainer_id = ${actor.id} AND week_start_date = ${weekStartDate}
      `;
    } else {
      const id = genId();
      await sql`
        INSERT INTO timesheet_submissions (id, trainer_id, week_start_date, status, submitted_at)
        VALUES (${id}, ${actor.id}, ${weekStartDate}, 'submitted', ${submittedAt})
      `;
    }

    const result = await sql`
      SELECT * FROM timesheet_submissions WHERE trainer_id = ${actor.id} AND week_start_date = ${weekStartDate} LIMIT 1
    `;
    const submission = rowToTimesheetSubmission(result.rows[0]);

    const trainerResult = await sql`SELECT name FROM users WHERE id = ${actor.id} LIMIT 1`;
    const trainerName = trainerResult.rows[0]?.name ?? "A trainer";
    await this.createNotification({
      type: "timesheet_submission",
      message: `${trainerName} submitted their timesheet for the week of ${formatWeekLabel(weekStartDate)} for review.`,
      relatedTrainerId: actor.id,
      relatedEntityId: submission.id,
    });

    return submission;
  }

  async approveTimesheetSubmission(submissionId: string, actor: Actor): Promise<TimesheetSubmission> {
    this.requireAdmin(actor, "approve timesheet submissions");

    const check = await sql`SELECT * FROM timesheet_submissions WHERE id = ${submissionId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Timesheet submission "${submissionId}" not found.`);
    const submission = rowToTimesheetSubmission(check.rows[0]);
    if (submission.status !== "submitted") throw new Error("Only a submitted timesheet can be approved.");

    const reviewedAt = new Date().toISOString();
    await sql`
      UPDATE timesheet_submissions
      SET status = 'approved', reviewed_at = ${reviewedAt}, reviewed_by_admin_id = ${actor.id}, rejection_reason = null
      WHERE id = ${submissionId}
    `;

    await this.createNotification({
      type: "timesheet_submission_decision",
      recipientRole: "trainer",
      message: `Your timesheet for the week of ${formatWeekLabel(submission.weekStartDate)} was approved.`,
      relatedTrainerId: submission.trainerId,
      relatedEntityId: submission.id,
    });

    const result = await sql`SELECT * FROM timesheet_submissions WHERE id = ${submissionId} LIMIT 1`;
    return rowToTimesheetSubmission(result.rows[0]);
  }

  async rejectTimesheetSubmission(submissionId: string, reason: string, actor: Actor): Promise<TimesheetSubmission> {
    this.requireAdmin(actor, "reject timesheet submissions");

    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new Error("A rejection reason is required.");

    const check = await sql`SELECT * FROM timesheet_submissions WHERE id = ${submissionId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Timesheet submission "${submissionId}" not found.`);
    const submission = rowToTimesheetSubmission(check.rows[0]);
    if (submission.status !== "submitted") throw new Error("Only a submitted timesheet can be rejected.");

    const reviewedAt = new Date().toISOString();
    await sql`
      UPDATE timesheet_submissions
      SET status = 'rejected', reviewed_at = ${reviewedAt}, reviewed_by_admin_id = ${actor.id},
          rejection_reason = ${trimmedReason}
      WHERE id = ${submissionId}
    `;

    await this.createNotification({
      type: "timesheet_submission_decision",
      recipientRole: "trainer",
      message: `Your timesheet for the week of ${formatWeekLabel(submission.weekStartDate)} was rejected: "${trimmedReason}"`,
      relatedTrainerId: submission.trainerId,
      relatedEntityId: submission.id,
    });

    const result = await sql`SELECT * FROM timesheet_submissions WHERE id = ${submissionId} LIMIT 1`;
    return rowToTimesheetSubmission(result.rows[0]);
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  async listNotifications(actor: Actor): Promise<Notification[]> {
    const role = actor.role;
    if (role === "admin") {
      const result = await sql`
        SELECT * FROM notifications WHERE recipient_role = 'admin' ORDER BY created_at DESC
      `;
      return result.rows.map(rowToNotification);
    } else {
      const result = await sql`
        SELECT * FROM notifications
        WHERE recipient_role = 'trainer' AND related_trainer_id = ${actor.id}
        ORDER BY created_at DESC
      `;
      return result.rows.map(rowToNotification);
    }
  }

  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const id = genId();
    const createdAt = new Date().toISOString();
    const recipientRole = input.recipientRole ?? "admin";
    await sql`
      INSERT INTO notifications
        (id, type, recipient_role, message, related_trainer_id, related_entity_id, read, created_at)
      VALUES
        (${id}, ${input.type}, ${recipientRole}, ${input.message},
         ${input.relatedTrainerId ?? null}, ${input.relatedEntityId ?? null}, false, ${createdAt})
    `;
    const result = await sql`SELECT * FROM notifications WHERE id = ${id} LIMIT 1`;
    return rowToNotification(result.rows[0]);
  }

  async markNotificationRead(notificationId: string, actor: Actor): Promise<Notification> {
    const check = await sql`SELECT * FROM notifications WHERE id = ${notificationId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Notification "${notificationId}" not found.`);

    const notification = rowToNotification(check.rows[0]);
    if (actor.role === "admin" && notification.recipientRole !== "admin") {
      throw new ForbiddenError("Admins can only mark admin notifications as read.");
    }
    if (
      actor.role === "trainer" &&
      (notification.recipientRole !== "trainer" || notification.relatedTrainerId !== actor.id)
    ) {
      throw new ForbiddenError("Trainers can only mark their own notifications as read.");
    }

    await sql`UPDATE notifications SET read = true WHERE id = ${notificationId}`;
    return { ...notification, read: true };
  }

  // ── Clock Correction Requests ──────────────────────────────────────────────

  async listClockCorrectionRequestsForTrainer(trainerId: string, actor: Actor): Promise<ClockCorrectionRequest[]> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError("Trainers can only view their own correction requests.");
    }
    const result = await sql`
      SELECT * FROM clock_correction_requests WHERE trainer_id = ${trainerId} ORDER BY created_at DESC
    `;
    return result.rows.map(rowToClockCorrectionRequest);
  }

  async listPendingClockCorrectionRequests(actor: Actor): Promise<ClockCorrectionRequest[]> {
    this.requireAdmin(actor, "view clock correction requests");
    const result = await sql`
      SELECT * FROM clock_correction_requests WHERE status = 'pending' ORDER BY created_at
    `;
    return result.rows.map(rowToClockCorrectionRequest);
  }

  async requestClockCorrection(
    eventId: string,
    requestedTimestamp: string,
    reason: string,
    actor: Actor
  ): Promise<ClockCorrectionRequest> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can request a clock correction.");
    }

    const eventCheck = await sql`SELECT * FROM time_clock_events WHERE id = ${eventId} LIMIT 1`;
    if (!eventCheck.rows.length) throw new Error(`Time clock event "${eventId}" not found.`);
    const event = rowToTimeClockEvent(eventCheck.rows[0]);
    if (event.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only request corrections for their own events.");
    }

    const pendingCheck = await sql`
      SELECT id FROM clock_correction_requests
      WHERE original_event_id = ${eventId} AND status = 'pending' LIMIT 1
    `;
    if (pendingCheck.rows.length) {
      throw new Error("This event already has a pending correction request.");
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new Error("A reason is required.");

    const id = genId();
    const createdAt = new Date().toISOString();
    await sql`
      INSERT INTO clock_correction_requests
        (id, trainer_id, original_event_id, original_timestamp, requested_timestamp, reason, status, created_at)
      VALUES
        (${id}, ${actor.id}, ${eventId}, ${event.timestamp}, ${requestedTimestamp}, ${trimmedReason}, 'pending', ${createdAt})
    `;

    const trainerResult = await sql`SELECT name FROM users WHERE id = ${actor.id} LIMIT 1`;
    const trainerName = trainerResult.rows[0]?.name ?? "A trainer";
    await this.createNotification({
      type: "clock_correction",
      message: `${trainerName} requested a time clock correction (${TIME_CLOCK_EVENT_LABELS[event.type]}: ${formatDateTime(event.timestamp)} → ${formatDateTime(requestedTimestamp)}).`,
      relatedTrainerId: actor.id,
      relatedEntityId: id,
    });

    const result = await sql`SELECT * FROM clock_correction_requests WHERE id = ${id} LIMIT 1`;
    return rowToClockCorrectionRequest(result.rows[0]);
  }

  async approveClockCorrection(requestId: string, actor: Actor): Promise<ClockCorrectionRequest> {
    this.requireAdmin(actor, "approve clock correction requests");

    const check = await sql`SELECT * FROM clock_correction_requests WHERE id = ${requestId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Clock correction request "${requestId}" not found.`);
    const request = rowToClockCorrectionRequest(check.rows[0]);
    if (request.status !== "pending") throw new Error("Only a pending request can be approved.");

    const eventCheck = await sql`SELECT * FROM time_clock_events WHERE id = ${request.originalEventId} LIMIT 1`;
    if (!eventCheck.rows.length) throw new Error(`Time clock event "${request.originalEventId}" not found.`);
    const event = rowToTimeClockEvent(eventCheck.rows[0]);

    await sql`UPDATE time_clock_events SET timestamp = ${request.requestedTimestamp} WHERE id = ${request.originalEventId}`;

    const reviewedAt = new Date().toISOString();
    await sql`
      UPDATE clock_correction_requests
      SET status = 'approved', reviewed_at = ${reviewedAt}
      WHERE id = ${requestId}
    `;

    await this.createNotification({
      type: "clock_correction_decision",
      recipientRole: "trainer",
      message: `Your correction request for ${TIME_CLOCK_EVENT_LABELS[event.type]} (${formatDateTime(request.requestedTimestamp)}) was approved.`,
      relatedTrainerId: request.trainerId,
      relatedEntityId: request.id,
    });

    const result = await sql`SELECT * FROM clock_correction_requests WHERE id = ${requestId} LIMIT 1`;
    return rowToClockCorrectionRequest(result.rows[0]);
  }

  async denyClockCorrection(requestId: string, adminNote: string | undefined, actor: Actor): Promise<ClockCorrectionRequest> {
    this.requireAdmin(actor, "deny clock correction requests");

    const check = await sql`SELECT * FROM clock_correction_requests WHERE id = ${requestId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Clock correction request "${requestId}" not found.`);
    const request = rowToClockCorrectionRequest(check.rows[0]);
    if (request.status !== "pending") throw new Error("Only a pending request can be denied.");

    const trimmedNote = adminNote?.trim() || null;
    const reviewedAt = new Date().toISOString();
    await sql`
      UPDATE clock_correction_requests
      SET status = 'denied', reviewed_at = ${reviewedAt}, admin_note = ${trimmedNote}
      WHERE id = ${requestId}
    `;

    await this.createNotification({
      type: "clock_correction_decision",
      recipientRole: "trainer",
      message: `Your correction request was denied.${trimmedNote ? ` "${trimmedNote}"` : ""}`,
      relatedTrainerId: request.trainerId,
      relatedEntityId: request.id,
    });

    const result = await sql`SELECT * FROM clock_correction_requests WHERE id = ${requestId} LIMIT 1`;
    return rowToClockCorrectionRequest(result.rows[0]);
  }

  // ── Manual Session Requests ────────────────────────────────────────────────

  async listManualSessionRequestsForTrainer(trainerId: string, actor: Actor): Promise<ManualSessionRequest[]> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError("Trainers can only view their own manual session requests.");
    }
    const result = await sql`
      SELECT * FROM manual_session_requests WHERE trainer_id = ${trainerId} ORDER BY created_at DESC
    `;
    return result.rows.map(rowToManualSessionRequest);
  }

  async listPendingManualSessionRequests(actor: Actor): Promise<ManualSessionRequest[]> {
    this.requireAdmin(actor, "view manual session requests");
    const result = await sql`
      SELECT * FROM manual_session_requests WHERE status = 'pending' ORDER BY created_at
    `;
    return result.rows.map(rowToManualSessionRequest);
  }

  async requestManualSession(input: CreateManualSessionInput, actor: Actor): Promise<ManualSessionRequest> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can log a manual session.");
    }

    const trimmedReason = input.reason.trim();
    if (!trimmedReason) throw new Error("A reason is required.");

    const clockInMs = new Date(input.clockIn).getTime();
    const clockOutMs = new Date(input.clockOut).getTime();
    if (!(clockOutMs > clockInMs)) throw new Error("Clock-out must be after clock-in.");

    const sortedBreaks = [...input.breaks].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    let previousEndMs = clockInMs;
    for (const brk of sortedBreaks) {
      const startMs = new Date(brk.start).getTime();
      const endMs = new Date(brk.end).getTime();
      if (!(endMs > startMs)) throw new Error("Each break's end must be after its start.");
      if (startMs < clockInMs || endMs > clockOutMs) {
        throw new Error("Breaks must fall within the clock-in/clock-out window.");
      }
      if (startMs < previousEndMs) throw new Error("Breaks cannot overlap.");
      previousEndMs = endMs;
    }

    const pendingCheck = await sql`
      SELECT id FROM manual_session_requests
      WHERE trainer_id = ${actor.id} AND date = ${input.date} AND status = 'pending' LIMIT 1
    `;
    if (pendingCheck.rows.length) {
      throw new Error("You already have a pending request for this date.");
    }

    const id = genId();
    const createdAt = new Date().toISOString();
    const breaksJson = JSON.stringify(sortedBreaks);
    await sql`
      INSERT INTO manual_session_requests
        (id, trainer_id, date, clock_in, clock_out, breaks, reason, status, created_at)
      VALUES
        (${id}, ${actor.id}, ${input.date}, ${input.clockIn}, ${input.clockOut},
         ${breaksJson}::jsonb, ${trimmedReason}, 'pending', ${createdAt})
    `;

    const trainerResult = await sql`SELECT name FROM users WHERE id = ${actor.id} LIMIT 1`;
    const trainerName = trainerResult.rows[0]?.name ?? "A trainer";
    await this.createNotification({
      type: "manual_session",
      message: `${trainerName} logged a missed day (${formatDateTime(input.clockIn)} – ${formatDateTime(input.clockOut)}) for review.`,
      relatedTrainerId: actor.id,
      relatedEntityId: id,
    });

    const result = await sql`SELECT * FROM manual_session_requests WHERE id = ${id} LIMIT 1`;
    return rowToManualSessionRequest(result.rows[0]);
  }

  async approveManualSession(requestId: string, actor: Actor): Promise<ManualSessionRequest> {
    this.requireAdmin(actor, "approve manual session requests");

    const check = await sql`SELECT * FROM manual_session_requests WHERE id = ${requestId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Manual session request "${requestId}" not found.`);
    const request = rowToManualSessionRequest(check.rows[0]);
    if (request.status !== "pending") throw new Error("Only a pending request can be approved.");

    const createdEventIds: string[] = [];

    const insertEvent = async (trainerId: string, type: TimeClockEventType, timestamp: string) => {
      const id = genId();
      await sql`
        INSERT INTO time_clock_events (id, trainer_id, type, timestamp, manually_logged)
        VALUES (${id}, ${trainerId}, ${type}, ${timestamp}, true)
      `;
      createdEventIds.push(id);
    };

    await insertEvent(request.trainerId, "clock_in", request.clockIn);
    for (const brk of request.breaks) {
      await insertEvent(request.trainerId, "break_start", brk.start);
      await insertEvent(request.trainerId, "break_end", brk.end);
    }
    await insertEvent(request.trainerId, "clock_out", request.clockOut);

    const reviewedAt = new Date().toISOString();
    const eventIdsJson = JSON.stringify(createdEventIds);
    await sql`
      UPDATE manual_session_requests
      SET status = 'approved', reviewed_at = ${reviewedAt}, created_event_ids = ${eventIdsJson}::jsonb
      WHERE id = ${requestId}
    `;

    await this.createNotification({
      type: "manual_session_decision",
      recipientRole: "trainer",
      message: `Your missed-day request for ${request.date} was approved.`,
      relatedTrainerId: request.trainerId,
      relatedEntityId: request.id,
    });

    const result = await sql`SELECT * FROM manual_session_requests WHERE id = ${requestId} LIMIT 1`;
    return rowToManualSessionRequest(result.rows[0]);
  }

  async denyManualSession(requestId: string, adminNote: string | undefined, actor: Actor): Promise<ManualSessionRequest> {
    this.requireAdmin(actor, "deny manual session requests");

    const check = await sql`SELECT * FROM manual_session_requests WHERE id = ${requestId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Manual session request "${requestId}" not found.`);
    const request = rowToManualSessionRequest(check.rows[0]);
    if (request.status !== "pending") throw new Error("Only a pending request can be denied.");

    const trimmedNote = adminNote?.trim() || null;
    const reviewedAt = new Date().toISOString();
    await sql`
      UPDATE manual_session_requests
      SET status = 'denied', reviewed_at = ${reviewedAt}, admin_note = ${trimmedNote}
      WHERE id = ${requestId}
    `;

    await this.createNotification({
      type: "manual_session_decision",
      recipientRole: "trainer",
      message: `Your missed-day request for ${request.date} was denied.${trimmedNote ? ` "${trimmedNote}"` : ""}`,
      relatedTrainerId: request.trainerId,
      relatedEntityId: request.id,
    });

    const result = await sql`SELECT * FROM manual_session_requests WHERE id = ${requestId} LIMIT 1`;
    return rowToManualSessionRequest(result.rows[0]);
  }

  // ── Expenses ───────────────────────────────────────────────────────────────

  private async validateExpenseInput(input: CreateExpenseInput | UpdateExpenseInput): Promise<void> {
    if (input.projectId) {
      const check = await sql`SELECT id FROM projects WHERE id = ${input.projectId} LIMIT 1`;
      if (!check.rows.length) throw new Error(`Project "${input.projectId}" not found.`);
    }
    if (!input.date) throw new Error("Date is required.");
    if (!EXPENSE_CATEGORIES.includes(input.category)) {
      throw new Error(`"${input.category}" is not a valid expense category.`);
    }
    if (!(input.amount > 0)) throw new Error("Amount must be a positive number.");
    if (!input.description.trim()) throw new Error("A description is required.");
  }

  async listExpensesForTrainer(trainerId: string, actor: Actor): Promise<Expense[]> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError("Trainers can only view their own expenses.");
    }
    const result = await sql`
      SELECT * FROM expenses WHERE trainer_id = ${trainerId} ORDER BY created_at DESC
    `;
    return result.rows.map(rowToExpense);
  }

  async listPendingExpenses(actor: Actor): Promise<Expense[]> {
    this.requireAdmin(actor, "review expenses");
    const result = await sql`SELECT * FROM expenses WHERE status = 'pending' ORDER BY created_at`;
    return result.rows.map(rowToExpense);
  }

  async createExpense(input: CreateExpenseInput, actor: Actor): Promise<Expense> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can submit their own expenses.");
    }
    await this.validateExpenseInput(input);

    const id = genId();
    const createdAt = new Date().toISOString();
    await sql`
      INSERT INTO expenses
        (id, trainer_id, project_id, date, category, amount, description, status, created_at)
      VALUES
        (${id}, ${actor.id}, ${input.projectId ?? null}, ${input.date},
         ${input.category}, ${input.amount}, ${input.description.trim()}, 'pending', ${createdAt})
    `;

    const trainerResult = await sql`SELECT name FROM users WHERE id = ${actor.id} LIMIT 1`;
    const trainerName = trainerResult.rows[0]?.name ?? "A trainer";
    await this.createNotification({
      type: "expense_submitted",
      message: `${trainerName} submitted a ${input.category} expense for ${formatCurrency(input.amount)}.`,
      relatedTrainerId: actor.id,
      relatedEntityId: id,
    });

    const result = await sql`SELECT * FROM expenses WHERE id = ${id} LIMIT 1`;
    return rowToExpense(result.rows[0]);
  }

  async updateExpense(expenseId: string, updates: UpdateExpenseInput, actor: Actor): Promise<Expense> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can edit their own expenses.");
    }

    const check = await sql`SELECT * FROM expenses WHERE id = ${expenseId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Expense "${expenseId}" not found.`);
    const expense = rowToExpense(check.rows[0]);

    if (expense.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only edit their own expenses.");
    }
    if (expense.status !== "rejected") {
      throw new ForbiddenError("Only a rejected expense can be edited and resubmitted.");
    }

    await this.validateExpenseInput(updates);

    await sql`
      UPDATE expenses
      SET project_id = ${updates.projectId ?? null}, date = ${updates.date},
          category = ${updates.category}, amount = ${updates.amount},
          description = ${updates.description.trim()}, status = 'pending',
          rejection_reason = null, reviewed_at = null, reviewed_by_admin_id = null
      WHERE id = ${expenseId}
    `;

    const trainerResult = await sql`SELECT name FROM users WHERE id = ${actor.id} LIMIT 1`;
    const trainerName = trainerResult.rows[0]?.name ?? "A trainer";
    await this.createNotification({
      type: "expense_submitted",
      message: `${trainerName} resubmitted a ${updates.category} expense for ${formatCurrency(updates.amount)}.`,
      relatedTrainerId: actor.id,
      relatedEntityId: expenseId,
    });

    const result = await sql`SELECT * FROM expenses WHERE id = ${expenseId} LIMIT 1`;
    return rowToExpense(result.rows[0]);
  }

  async approveExpense(expenseId: string, actor: Actor): Promise<Expense> {
    this.requireAdmin(actor, "approve expenses");

    const check = await sql`SELECT * FROM expenses WHERE id = ${expenseId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Expense "${expenseId}" not found.`);
    const expense = rowToExpense(check.rows[0]);
    if (expense.status !== "pending") throw new Error("Only a pending expense can be approved.");

    const reviewedAt = new Date().toISOString();
    await sql`
      UPDATE expenses
      SET status = 'approved', reviewed_at = ${reviewedAt}, reviewed_by_admin_id = ${actor.id}, rejection_reason = null
      WHERE id = ${expenseId}
    `;

    await this.createNotification({
      type: "expense_decision",
      recipientRole: "trainer",
      message: `Your ${expense.category} expense for ${formatCurrency(expense.amount)} was approved.`,
      relatedTrainerId: expense.trainerId,
      relatedEntityId: expense.id,
    });

    const result = await sql`SELECT * FROM expenses WHERE id = ${expenseId} LIMIT 1`;
    return rowToExpense(result.rows[0]);
  }

  async rejectExpense(expenseId: string, reason: string, actor: Actor): Promise<Expense> {
    this.requireAdmin(actor, "reject expenses");

    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new Error("A rejection reason is required.");

    const check = await sql`SELECT * FROM expenses WHERE id = ${expenseId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Expense "${expenseId}" not found.`);
    const expense = rowToExpense(check.rows[0]);
    if (expense.status !== "pending") throw new Error("Only a pending expense can be rejected.");

    const reviewedAt = new Date().toISOString();
    await sql`
      UPDATE expenses
      SET status = 'rejected', reviewed_at = ${reviewedAt}, reviewed_by_admin_id = ${actor.id},
          rejection_reason = ${trimmedReason}
      WHERE id = ${expenseId}
    `;

    await this.createNotification({
      type: "expense_decision",
      recipientRole: "trainer",
      message: `Your ${expense.category} expense for ${formatCurrency(expense.amount)} was rejected: "${trimmedReason}"`,
      relatedTrainerId: expense.trainerId,
      relatedEntityId: expense.id,
    });

    const result = await sql`SELECT * FROM expenses WHERE id = ${expenseId} LIMIT 1`;
    return rowToExpense(result.rows[0]);
  }

  // ── Unavailability Blocks ──────────────────────────────────────────────────

  async listUnavailabilityBlocksForTrainer(trainerId: string, actor: Actor): Promise<UnavailabilityBlock[]> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError("Trainers can only view their own unavailability blocks.");
    }
    const result = await sql`
      SELECT * FROM unavailability_blocks WHERE trainer_id = ${trainerId} ORDER BY start_date
    `;
    return result.rows.map(rowToUnavailabilityBlock);
  }

  async createUnavailabilityBlock(input: CreateUnavailabilityBlockInput, actor: Actor): Promise<UnavailabilityBlock> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can manage their own unavailability.");
    }

    if (!input.startDate) throw new Error("Start date is required.");
    if (input.type === "recurring") {
      if (input.recurringDayOfWeek === undefined || input.recurringDayOfWeek < 0 || input.recurringDayOfWeek > 6) {
        throw new Error("A day of week (0–6) is required for a recurring block.");
      }
    }
    if (input.endDate && input.endDate < input.startDate) {
      throw new Error("End date must be on or after the start date.");
    }
    if ((input.startTime && !input.endTime) || (!input.startTime && input.endTime)) {
      throw new Error("Start time and end time must be set together, or both left blank for a full-day block.");
    }
    if (input.startTime && input.endTime && input.endTime <= input.startTime) {
      throw new Error("End time must be after start time.");
    }

    const id = genId();
    const createdAt = new Date().toISOString();
    const recurringDay = input.type === "recurring" ? (input.recurringDayOfWeek ?? null) : null;
    await sql`
      INSERT INTO unavailability_blocks
        (id, trainer_id, type, start_date, end_date, start_time, end_time, recurring_day_of_week, reason, created_at)
      VALUES
        (${id}, ${actor.id}, ${input.type}, ${input.startDate}, ${input.endDate ?? null},
         ${input.startTime ?? null}, ${input.endTime ?? null}, ${recurringDay},
         ${input.reason?.trim() || null}, ${createdAt})
    `;

    const result = await sql`SELECT * FROM unavailability_blocks WHERE id = ${id} LIMIT 1`;
    return rowToUnavailabilityBlock(result.rows[0]);
  }

  async deleteUnavailabilityBlock(blockId: string, actor: Actor): Promise<void> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can manage their own unavailability.");
    }

    const check = await sql`SELECT * FROM unavailability_blocks WHERE id = ${blockId} LIMIT 1`;
    if (!check.rows.length) throw new Error(`Unavailability block "${blockId}" not found.`);

    const block = rowToUnavailabilityBlock(check.rows[0]);
    if (block.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only delete their own unavailability blocks.");
    }

    await sql`DELETE FROM unavailability_blocks WHERE id = ${blockId}`;
  }
}
