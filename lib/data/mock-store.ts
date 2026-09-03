import { hashPasswordSync } from "@/lib/auth/password";
import type {
  User,
  PublicUser,
  Project,
  Task,
  TaskStatus,
  Booking,
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
} from "@/lib/types";
import { STANDARD_TASKS } from "@/lib/domain/tasks";
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
import { formatCurrency, formatDateRange, formatDateTime, toLocalDateString } from "@/lib/format";

/** Internal bookkeeping alongside the public {@link Flag} shape — `key` identifies one recurring situation, `signature` captures how bad it currently is (see lib/domain/flags.ts). */
type FlagRecord = Flag & { key: string; signature: string };

function toFlag(record: FlagRecord): Flag {
  const { key: _key, signature: _signature, ...flag } = record;
  return flag;
}

const DEFAULT_FLAG_THRESHOLDS: FlagThresholds = {
  unsubmittedTaskTrackerDays: 3,
  pendingBookingUnansweredHours: 48,
  inactiveTrainerDays: 5,
};

const SEVERITY_RANK: Record<Flag["severity"], number> = { warning: 0, info: 1 };

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

function seedUsers(): User[] {
  return [
    {
      id: "user-admin",
      role: "admin",
      username: "admin",
      passwordHash: hashPasswordSync("admin123"),
      name: "Admin",
      email: "admin@planetdds.com",
      active: true,
    },
    {
      id: "user-jsmith",
      role: "trainer",
      username: "jsmith",
      passwordHash: hashPasswordSync("trainer123"),
      name: "Jordan Smith",
      email: "jordan.smith@example.com",
      active: true,
    },
    {
      id: "user-rlee",
      role: "trainer",
      username: "rlee",
      passwordHash: hashPasswordSync("trainer123"),
      name: "Riley Lee",
      email: "riley.lee@example.com",
      active: true,
    },
  ];
}

function seedProjects(): Project[] {
  return [
    {
      id: "proj-1",
      name: "Project #1",
      productLine: "cloud9",
      color: "#0F6CBD",
      status: "active",
      projectId: "PROJ-001",
      bccEmail: "test1@example.com",
      notes: "Client prefers morning sessions; primary contact is the office manager.",
    },
    {
      id: "proj-2",
      name: "Project #2",
      productLine: "denticon",
      color: "#2E9E5B",
      status: "active",
      projectId: "PROJ-002",
      bccEmail: "test2@example.com",
    },
    {
      id: "proj-3",
      name: "Project #3",
      productLine: "denticon",
      color: "#D97706",
      status: "active",
      projectId: "PROJ-003",
      bccEmail: "test3@example.com",
    },
    {
      id: "proj-4",
      name: "Project #4",
      productLine: "cloud9",
      color: "#DB2777",
      status: "active",
      projectId: "PROJ-004",
      bccEmail: "test4@example.com",
    },
  ];
}

/** The standard 5-task checklist, all `not_started`, for one project/trainer pair. */
function seedChecklistTasks(
  projectId: string,
  trainerId: string,
  idPrefix: string
): Task[] {
  return STANDARD_TASKS.map((template, i) => ({
    id: `${idPrefix}-${i + 1}`,
    projectId,
    trainerId,
    title: template.title,
    billable: template.billable,
    status: "not_started" as TaskStatus,
  }));
}

function seedTasks(): Task[] {
  const projectIds = ["proj-1", "proj-2", "proj-3", "proj-4"];
  const trainerIds = ["user-jsmith", "user-rlee"];

  return projectIds.flatMap((projectId, projectIndex) =>
    trainerIds.flatMap((trainerId, trainerIndex) =>
      seedChecklistTasks(
        projectId,
        trainerId,
        `task-p${projectIndex + 1}-t${trainerIndex + 1}`
      )
    )
  );
}

function seedBookings(): Booking[] {
  return [
    {
      id: "booking-1",
      trainerId: "user-jsmith",
      projectId: "proj-1",
      officeId: "office-1a",
      title: "Project #1 Onboarding — Smile Dental",
      startTime: "2026-08-03T14:00:00.000Z",
      endTime: "2026-08-03T18:00:00.000Z",
      location: "on_site",
      billable: "billable",
      billableSetByAdmin: true,
      status: "pending",
      statusChangedAt: "2026-07-25T12:00:00.000Z",
    },
    {
      id: "booking-2",
      trainerId: "user-jsmith",
      projectId: "proj-2",
      officeId: "office-2a",
      title: "Project #2 Imaging Module Training",
      startTime: "2026-08-05T15:00:00.000Z",
      endTime: "2026-08-05T17:00:00.000Z",
      location: "remote",
      billable: "billable",
      billableSetByAdmin: true,
      status: "accepted",
      statusChangedAt: "2026-07-25T12:00:00.000Z",
    },
    {
      id: "booking-3",
      trainerId: "user-rlee",
      projectId: "proj-3",
      officeId: "office-3a",
      title: "Project #3 System Refresher",
      startTime: "2026-08-04T16:00:00.000Z",
      endTime: "2026-08-04T17:30:00.000Z",
      location: "remote",
      billable: "non_billable",
      billableSetByAdmin: true,
      status: "pending",
      statusChangedAt: "2026-07-25T12:00:00.000Z",
    },
  ];
}

function seedOffices(): Office[] {
  return [
    { id: "office-1a", projectId: "proj-1", name: "Denver", active: true },
    { id: "office-1b", projectId: "proj-1", name: "Chicago", active: true },
    { id: "office-2a", projectId: "proj-2", name: "Atlanta", active: true },
    { id: "office-3a", projectId: "proj-3", name: "Remote", active: true },
    { id: "office-4a", projectId: "proj-4", name: "Remote", active: true },
  ];
}

function seedTaskEntries(): TaskEntry[] {
  // task IDs: task-p{projectIndex+1}-t{trainerIndex+1}-{taskIndex+1}
  // proj-1 (cloud9), proj-2 (denticon), proj-3 (denticon), proj-4 (cloud9)
  // jsmith = t1, rlee = t2
  return [
    // Jordan Smith — Project #1 (cloud9), Denver office
    {
      id: "te-1",
      trainerId: "user-jsmith",
      date: "2026-08-25",
      projectId: "proj-1",
      office: "office-1a",
      taskId: "task-p1-t1-1",
      note: "Initial onboarding session, covered scheduling module.",
      hours: 4,
      location: "Denver Main Office",
      createdAt: "2026-08-25T16:00:00.000Z",
    },
    {
      id: "te-2",
      trainerId: "user-jsmith",
      date: "2026-08-26",
      projectId: "proj-1",
      office: "office-1a",
      taskId: "task-p1-t1-5",
      note: "Virtual follow-up on appointment types setup.",
      hours: 2,
      location: "Denver Main Office",
      createdAt: "2026-08-26T15:00:00.000Z",
    },
    {
      id: "te-3",
      trainerId: "user-jsmith",
      date: "2026-08-27",
      projectId: "proj-2",
      office: "office-2a",
      taskId: "task-p2-t1-1",
      note: "On-site training for imaging module — all staff attended.",
      hours: 6,
      location: "Atlanta Peachtree Location",
      createdAt: "2026-08-27T17:00:00.000Z",
    },
    {
      id: "te-4",
      trainerId: "user-jsmith",
      date: "2026-08-28",
      projectId: "proj-2",
      office: "office-2a",
      taskId: "task-p2-t1-3",
      note: "Addressed billing workflow questions from front desk.",
      hours: 3,
      location: "Atlanta Peachtree Location",
      createdAt: "2026-08-28T15:00:00.000Z",
    },
    {
      id: "te-5",
      trainerId: "user-jsmith",
      date: "2026-09-01",
      projectId: "proj-1",
      office: "office-1b",
      taskId: "task-p1-t1-3",
      note: "Chicago location kickoff — walked through provider setup.",
      hours: 5,
      location: "Chicago Lincoln Park Office",
      createdAt: "2026-09-01T18:00:00.000Z",
    },
    // Riley Lee — Project #2 (denticon), Atlanta office
    {
      id: "te-6",
      trainerId: "user-rlee",
      date: "2026-08-25",
      projectId: "proj-2",
      office: "office-2a",
      taskId: "task-p2-t2-1",
      note: "Day 1 on-site training, covered patient check-in flow.",
      hours: 7,
      location: "Atlanta Buckhead Clinic",
      createdAt: "2026-08-25T17:30:00.000Z",
    },
    {
      id: "te-7",
      trainerId: "user-rlee",
      date: "2026-08-26",
      projectId: "proj-2",
      office: "office-2a",
      taskId: "task-p2-t2-2",
      note: "Virtual support call — helped with appointment reminders config.",
      hours: 1.5,
      location: "Atlanta Buckhead Clinic",
      createdAt: "2026-08-26T14:00:00.000Z",
    },
    {
      id: "te-8",
      trainerId: "user-rlee",
      date: "2026-08-28",
      projectId: "proj-3",
      office: "office-3a",
      taskId: "task-p3-t2-1",
      note: "Remote refresher session — walkthrough of ledger corrections.",
      hours: 2,
      location: "Remote — Zoom",
      createdAt: "2026-08-28T16:00:00.000Z",
    },
    {
      id: "te-9",
      trainerId: "user-rlee",
      date: "2026-09-02",
      projectId: "proj-2",
      office: "office-2a",
      taskId: "task-p2-t2-3",
      note: "On-site support for end-of-month close procedures.",
      hours: 4,
      location: "Atlanta Buckhead Clinic",
      createdAt: "2026-09-02T17:00:00.000Z",
    },
    {
      id: "te-10",
      trainerId: "user-rlee",
      date: "2026-09-03",
      projectId: "proj-4",
      office: "office-4a",
      taskId: "task-p4-t2-5",
      note: "Virtual training session on treatment plan presentation.",
      hours: 1.5,
      location: "Remote — Teams",
      createdAt: "2026-09-03T15:00:00.000Z",
    },
    // Non-billable entries
    {
      id: "te-11",
      trainerId: "user-jsmith",
      date: "2026-08-26",
      projectId: "proj-1",
      office: "office-1a",
      taskId: "task-p1-t1-2", // Virtual Customer Support (Non Billable)
      note: "Follow-up support call, no charge to client.",
      hours: 1,
      location: "Denver Main Office",
      createdAt: "2026-08-26T16:00:00.000Z",
    },
    {
      id: "te-12",
      trainerId: "user-jsmith",
      date: "2026-08-27",
      projectId: "proj-2",
      office: "office-2a",
      taskId: "task-p2-t1-4", // On-Site Customer Support (Non Billable)
      note: "Courtesy on-site visit to address post-training questions.",
      hours: 2,
      location: "Atlanta Peachtree Location",
      createdAt: "2026-08-27T18:00:00.000Z",
    },
    {
      id: "te-13",
      trainerId: "user-rlee",
      date: "2026-08-29",
      projectId: "proj-2",
      office: "office-2a",
      taskId: "task-p2-t2-4", // On-Site Customer Support (Non Billable)
      note: "Non-billable on-site check-in after go-live.",
      hours: 1.5,
      location: "Atlanta Buckhead Clinic",
      createdAt: "2026-08-29T14:00:00.000Z",
    },
  ];
}

function seedExpenses(): Expense[] {
  return [
    {
      id: "exp-1",
      trainerId: "user-jsmith",
      projectId: "proj-1",
      date: "2026-08-25",
      category: "Travel",
      amount: 312.50,
      description: "Round-trip flight DEN→DEN for Project #1 Denver kickoff.",
      status: "approved",
      createdAt: "2026-08-25T20:00:00.000Z",
      reviewedAt: "2026-08-26T09:00:00.000Z",
      reviewedByAdminId: "user-admin",
    },
    {
      id: "exp-2",
      trainerId: "user-jsmith",
      projectId: "proj-2",
      date: "2026-08-27",
      category: "Meals",
      amount: 54.80,
      description: "Team lunch with client staff during on-site training day.",
      status: "pending",
      createdAt: "2026-08-27T19:00:00.000Z",
    },
    {
      id: "exp-3",
      trainerId: "user-jsmith",
      projectId: "proj-1",
      date: "2026-09-01",
      category: "Travel",
      amount: 189.00,
      description: "Amtrak to Chicago for Project #1 second location training.",
      status: "pending",
      createdAt: "2026-09-01T20:00:00.000Z",
    },
    {
      id: "exp-4",
      trainerId: "user-rlee",
      projectId: "proj-2",
      date: "2026-08-25",
      category: "Mileage",
      amount: 67.20,
      description: "160 miles driven to Atlanta Buckhead clinic @ $0.42/mi.",
      status: "approved",
      createdAt: "2026-08-25T21:00:00.000Z",
      reviewedAt: "2026-08-26T10:00:00.000Z",
      reviewedByAdminId: "user-admin",
    },
    {
      id: "exp-5",
      trainerId: "user-rlee",
      projectId: "proj-2",
      date: "2026-09-02",
      category: "Supplies",
      amount: 28.45,
      description: "Printed training handouts for end-of-month session.",
      status: "pending",
      createdAt: "2026-09-02T18:00:00.000Z",
    },
  ];
}

function seedTimesheetSubmissions(): TimesheetSubmission[] {
  return [
    // Jordan Smith — week of 2026-08-24 (Mon): submitted and approved
    {
      id: "ts-1",
      trainerId: "user-jsmith",
      weekStartDate: "2026-08-24",
      status: "approved",
      submittedAt: "2026-08-28T17:00:00.000Z",
      reviewedAt: "2026-08-29T09:00:00.000Z",
      reviewedByAdminId: "user-admin",
    },
    // Riley Lee — week of 2026-08-24: submitted, pending review
    {
      id: "ts-2",
      trainerId: "user-rlee",
      weekStartDate: "2026-08-24",
      status: "submitted",
      submittedAt: "2026-08-28T18:30:00.000Z",
    },
    // Jordan Smith — week of 2026-08-31: draft (not yet submitted)
    {
      id: "ts-3",
      trainerId: "user-jsmith",
      weekStartDate: "2026-08-31",
      status: "draft",
    },
  ];
}

function seedTimeClockEvents(): TimeClockEvent[] {
  return [
    // Jordan Smith — Mon 2026-08-25
    { id: "tce-1", trainerId: "user-jsmith", type: "clock_in",    timestamp: "2026-08-25T08:00:00.000Z" },
    { id: "tce-2", trainerId: "user-jsmith", type: "break_start", timestamp: "2026-08-25T12:00:00.000Z" },
    { id: "tce-3", trainerId: "user-jsmith", type: "break_end",   timestamp: "2026-08-25T12:30:00.000Z" },
    { id: "tce-4", trainerId: "user-jsmith", type: "clock_out",   timestamp: "2026-08-25T17:00:00.000Z" },
    // Jordan Smith — Tue 2026-08-26
    { id: "tce-5", trainerId: "user-jsmith", type: "clock_in",    timestamp: "2026-08-26T08:15:00.000Z" },
    { id: "tce-6", trainerId: "user-jsmith", type: "clock_out",   timestamp: "2026-08-26T14:30:00.000Z" },
    // Riley Lee — Mon 2026-08-25
    { id: "tce-7",  trainerId: "user-rlee", type: "clock_in",    timestamp: "2026-08-25T07:45:00.000Z" },
    { id: "tce-8",  trainerId: "user-rlee", type: "break_start", timestamp: "2026-08-25T12:00:00.000Z" },
    { id: "tce-9",  trainerId: "user-rlee", type: "break_end",   timestamp: "2026-08-25T13:00:00.000Z" },
    { id: "tce-10", trainerId: "user-rlee", type: "clock_out",   timestamp: "2026-08-25T17:30:00.000Z" },
    // Riley Lee — Thu 2026-08-28
    { id: "tce-11", trainerId: "user-rlee", type: "clock_in",    timestamp: "2026-08-28T09:00:00.000Z" },
    { id: "tce-12", trainerId: "user-rlee", type: "clock_out",   timestamp: "2026-08-28T13:00:00.000Z" },
  ];
}

/**
 * Reference implementation of {@link DataStore} backed by in-memory arrays.
 * Data resets whenever the server process restarts — expected until a real
 * database lands. All role enforcement lives here so a future DB-backed
 * implementation must satisfy the same rules to pass this contract.
 */
export class MockDataStore implements DataStore {
  private users: User[] = seedUsers();
  private projects: Project[] = seedProjects();
  private tasks: Task[] = seedTasks();
  private bookings: Booking[] = seedBookings();
  private timeClockEvents: TimeClockEvent[] = seedTimeClockEvents();
  private offices: Office[] = seedOffices();
  private taskEntries: TaskEntry[] = seedTaskEntries();
  private favoriteTasks: FavoriteTask[] = [];
  private flagThresholds: FlagThresholds = { ...DEFAULT_FLAG_THRESHOLDS };
  private flagRecords: FlagRecord[] = [];
  private weeklySubmissions: WeeklySubmission[] = [];
  private timesheetSubmissions: TimesheetSubmission[] = seedTimesheetSubmissions();
  private notifications: Notification[] = [];
  private clockCorrectionRequests: ClockCorrectionRequest[] = [];
  private manualSessionRequests: ManualSessionRequest[] = [];
  private expenses: Expense[] = seedExpenses();
  private unavailabilityBlocks: UnavailabilityBlock[] = [];
  private nextId = 1;

  private generateId(prefix: string): string {
    return `${prefix}-${this.nextId++}`;
  }

  private requireAdmin(actor: Actor, action: string): void {
    if (actor.role !== "admin") {
      throw new ForbiddenError(`Only admins can ${action}.`);
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.users.find((u) => u.username === username) ?? null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async listTrainers(): Promise<PublicUser[]> {
    return this.users.filter((u) => u.role === "trainer").map(toPublicUser);
  }

  async createTrainer(
    input: CreateTrainerInput,
    actor: Actor
  ): Promise<PublicUser> {
    this.requireAdmin(actor, "create trainer accounts");

    if (this.users.some((u) => u.username === input.username)) {
      throw new Error(`Username "${input.username}" is already taken.`);
    }

    const trainer: User = {
      id: this.generateId("user"),
      role: "trainer",
      username: input.username,
      passwordHash: input.passwordHash,
      name: input.name,
      email: input.email,
      active: true,
    };
    this.users.push(trainer);
    return toPublicUser(trainer);
  }

  async setTrainerActive(
    trainerId: string,
    active: boolean,
    actor: Actor
  ): Promise<PublicUser> {
    this.requireAdmin(actor, "deactivate or reactivate trainer accounts");

    const trainer = this.users.find(
      (u) => u.id === trainerId && u.role === "trainer"
    );
    if (!trainer) {
      throw new Error(`Trainer "${trainerId}" not found.`);
    }
    trainer.active = active;
    return toPublicUser(trainer);
  }

  async updateUserPassword(
    userId: string,
    passwordHash: string,
    actor: Actor
  ): Promise<PublicUser> {
    if (actor.role === "trainer" && actor.id !== userId) {
      throw new ForbiddenError("Trainers can only change their own password.");
    }

    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error(`User "${userId}" not found.`);
    }
    user.passwordHash = passwordHash;
    return toPublicUser(user);
  }

  async listProjects(): Promise<Project[]> {
    return this.projects;
  }

  async getProject(id: string): Promise<Project | null> {
    return this.projects.find((p) => p.id === id) ?? null;
  }

  async createProject(
    input: CreateProjectInput,
    actor: Actor
  ): Promise<Project> {
    this.requireAdmin(actor, "create projects");

    const project: Project = {
      id: this.generateId("proj"),
      name: input.name,
      productLine: input.productLine,
      color: input.color,
      status: "active",
      projectId: input.projectId,
      bccEmail: input.bccEmail,
      notes: input.notes,
    };
    this.projects.push(project);
    return project;
  }

  async setProjectStatus(
    projectId: string,
    status: Project["status"],
    actor: Actor
  ): Promise<Project> {
    this.requireAdmin(actor, "change a project's status");

    const project = this.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found.`);
    }
    project.status = status;
    return project;
  }

  async updateProjectDetails(
    projectId: string,
    updates: UpdateProjectInput,
    actor: Actor
  ): Promise<Project> {
    this.requireAdmin(actor, "edit a project's details");

    const project = this.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found.`);
    }

    project.name = updates.name;
    project.productLine = updates.productLine;
    project.color = updates.color;
    project.projectId = updates.projectId;
    project.bccEmail = updates.bccEmail;
    project.notes = updates.notes?.trim() || undefined;
    return project;
  }

  async listTasksForTrainer(trainerId: string): Promise<Task[]> {
    return this.tasks.filter((t) => t.trainerId === trainerId);
  }

  async listAllTasks(): Promise<Task[]> {
    return this.tasks;
  }

  async createTask(input: CreateTaskInput, actor: Actor): Promise<Task> {
    const project = this.projects.find((p) => p.id === input.projectId);
    if (!project) {
      throw new Error(`Project "${input.projectId}" not found.`);
    }

    let trainerId: string;
    if (actor.role === "trainer") {
      trainerId = actor.id;
    } else {
      this.requireAdmin(actor, "create a checklist task for a trainer");
      if (!input.trainerId) {
        throw new Error("trainerId is required when an admin creates a task.");
      }
      const trainer = this.users.find(
        (u) => u.id === input.trainerId && u.role === "trainer"
      );
      if (!trainer) {
        throw new Error(`Trainer "${input.trainerId}" not found.`);
      }
      trainerId = input.trainerId;
    }

    const task: Task = {
      id: this.generateId("task"),
      projectId: input.projectId,
      trainerId,
      title: input.title,
      billable: input.billable,
      status: "not_started",
    };
    this.tasks.push(task);
    return task;
  }

  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    actor: Actor
  ): Promise<Task> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(`Task "${taskId}" not found.`);
    }

    if (actor.role === "trainer" && task.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only update their own tasks.");
    }

    task.status = status;
    return task;
  }

  async deleteTask(taskId: string, actor: Actor): Promise<void> {
    this.requireAdmin(actor, "delete tasks");

    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(`Task "${taskId}" not found.`);
    }

    this.tasks = this.tasks.filter((t) => t.id !== taskId);
  }

  async listBookingsForTrainer(trainerId: string): Promise<Booking[]> {
    return this.bookings.filter((b) => b.trainerId === trainerId);
  }

  async listAllBookings(): Promise<Booking[]> {
    return this.bookings;
  }

  async getBooking(id: string): Promise<Booking | null> {
    return this.bookings.find((b) => b.id === id) ?? null;
  }

  async createBooking(
    input: CreateBookingInput,
    actor: Actor
  ): Promise<Booking> {
    this.requireAdmin(actor, "create bookings");

    const project = this.projects.find((p) => p.id === input.projectId);
    if (!project) {
      throw new Error(`Project "${input.projectId}" not found.`);
    }

    const trainer = this.users.find(
      (u) => u.id === input.trainerId && u.role === "trainer"
    );
    if (!trainer) {
      throw new Error(`Trainer "${input.trainerId}" not found.`);
    }

    const office = this.offices.find((o) => o.id === input.officeId);
    if (!office) {
      throw new Error(`Office "${input.officeId}" not found.`);
    }
    if (office.projectId !== input.projectId) {
      throw new Error(
        `Office "${input.officeId}" does not belong to project "${input.projectId}".`
      );
    }

    if (new Date(input.endTime) <= new Date(input.startTime)) {
      throw new Error("End time must be after start time.");
    }

    const conflict = findConflictingBooking(this.bookings, input.trainerId, {
      startTime: input.startTime,
      endTime: input.endTime,
    });
    if (conflict) {
      throw new BookingConflictError(
        `${trainer.name} already has a booking that overlaps this time.`,
        conflict
      );
    }

    const booking: Booking = {
      id: this.generateId("booking"),
      trainerId: input.trainerId,
      projectId: input.projectId,
      officeId: input.officeId,
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location,
      billable: input.billable,
      billableSetByAdmin: true,
      status: "pending",
      notes: input.notes,
      statusChangedAt: new Date().toISOString(),
    };
    this.bookings.push(booking);

    await this.createNotification({
      type: "booking_created",
      recipientRole: "trainer",
      message: `New booking request: "${booking.title}" (${formatDateRange(
        booking.startTime,
        booking.endTime
      )}).`,
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
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error(`Booking "${bookingId}" not found.`);
    }

    if (actor.role === "trainer") {
      if (booking.trainerId !== actor.id) {
        throw new ForbiddenError("Trainers can only update their own bookings.");
      }
      if (status === "pending") {
        // The only path back to "pending" is a trainer's own undo of their
        // recent accept/reject — never a fresh booking, and never once the
        // undo window has lapsed.
        if (booking.status !== "accepted" && booking.status !== "rejected") {
          throw new ForbiddenError(
            "Only an accepted or rejected booking can be reverted to pending."
          );
        }
        if (!isWithinUndoWindow(booking.statusChangedAt)) {
          throw new ForbiddenError(
            "The undo window for this booking has expired."
          );
        }
      } else if (status !== "accepted" && status !== "rejected") {
        throw new ForbiddenError(
          "Trainers can only accept, reject, or undo a recent status change."
        );
      }
    }

    booking.status = status;
    booking.statusChangedAt = new Date().toISOString();
    booking.rejectionReason = status === "rejected" ? reason?.trim() || undefined : undefined;
    return booking;
  }

  async setBookingBillable(
    bookingId: string,
    billable: BillableStatus,
    actor: Actor
  ): Promise<Booking> {
    this.requireAdmin(actor, "set or change a booking's billable status");

    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error(`Booking "${bookingId}" not found.`);
    }

    booking.billable = billable;
    booking.billableSetByAdmin = true;
    return booking;
  }

  async updateBookingDetails(
    bookingId: string,
    updates: UpdateBookingDetailsInput,
    actor: Actor
  ): Promise<Booking> {
    this.requireAdmin(actor, "edit a booking's time or location");

    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error(`Booking "${bookingId}" not found.`);
    }

    if (new Date(updates.endTime) <= new Date(updates.startTime)) {
      throw new Error("End time must be after start time.");
    }

    booking.startTime = updates.startTime;
    booking.endTime = updates.endTime;
    booking.location = updates.location;
    return booking;
  }

  async requestBookingCancellation(
    bookingId: string,
    reason: string,
    actor: Actor
  ): Promise<Booking> {
    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error(`Booking "${bookingId}" not found.`);
    }
    if (actor.role !== "trainer" || booking.trainerId !== actor.id) {
      throw new ForbiddenError(
        "Trainers can only request cancellation of their own bookings."
      );
    }
    if (booking.status !== "accepted") {
      throw new ForbiddenError(
        "Only an accepted booking can have its cancellation requested."
      );
    }

    const trimmed = reason.trim();
    if (!trimmed) {
      throw new Error("A cancellation reason is required.");
    }

    booking.status = "cancellation_requested";
    booking.cancellationReason = trimmed;
    booking.statusChangedAt = new Date().toISOString();

    const trainer = this.users.find((u) => u.id === booking.trainerId);
    await this.createNotification({
      type: "cancellation_request",
      message: `${trainer?.name ?? "A trainer"} requested to cancel "${
        booking.title
      }" (${formatDateRange(booking.startTime, booking.endTime)}).`,
      relatedTrainerId: booking.trainerId,
      relatedEntityId: booking.id,
    });

    return booking;
  }

  async approveBookingCancellation(
    bookingId: string,
    actor: Actor
  ): Promise<Booking> {
    this.requireAdmin(actor, "approve a booking cancellation");

    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error(`Booking "${bookingId}" not found.`);
    }
    if (booking.status !== "cancellation_requested") {
      throw new Error(
        "Only a booking with a pending cancellation request can be approved."
      );
    }

    booking.status = "cancelled";
    booking.statusChangedAt = new Date().toISOString();

    await this.createNotification({
      type: "cancellation_decision",
      recipientRole: "trainer",
      message: `Your cancellation request for "${booking.title}" was approved — the booking is cancelled.`,
      relatedTrainerId: booking.trainerId,
      relatedEntityId: booking.id,
    });

    return booking;
  }

  async denyBookingCancellation(
    bookingId: string,
    actor: Actor
  ): Promise<Booking> {
    this.requireAdmin(actor, "deny a booking cancellation");

    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error(`Booking "${bookingId}" not found.`);
    }
    if (booking.status !== "cancellation_requested") {
      throw new Error(
        "Only a booking with a pending cancellation request can be denied."
      );
    }

    booking.status = "accepted";
    booking.cancellationReason = undefined;
    booking.statusChangedAt = new Date().toISOString();

    await this.createNotification({
      type: "cancellation_decision",
      recipientRole: "trainer",
      message: `Your cancellation request for "${booking.title}" was denied.`,
      relatedTrainerId: booking.trainerId,
      relatedEntityId: booking.id,
    });

    return booking;
  }

  async adminCancelBooking(
    bookingId: string,
    actor: Actor,
    reason?: string
  ): Promise<Booking> {
    this.requireAdmin(actor, "cancel a booking");

    const booking = this.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error(`Booking "${bookingId}" not found.`);
    }
    if (booking.status === "cancelled") {
      throw new Error("This booking is already cancelled.");
    }

    const trimmedReason = reason?.trim() || undefined;
    booking.status = "cancelled";
    booking.cancellationReason = trimmedReason;
    booking.statusChangedAt = new Date().toISOString();

    await this.createNotification({
      type: "booking_cancelled",
      recipientRole: "trainer",
      message: trimmedReason
        ? `Your booking "${booking.title}" (${formatDateRange(
            booking.startTime,
            booking.endTime
          )}) was cancelled by an admin: "${trimmedReason}"`
        : `Your booking "${booking.title}" (${formatDateRange(
            booking.startTime,
            booking.endTime
          )}) was cancelled by an admin.`,
      relatedTrainerId: booking.trainerId,
      relatedEntityId: booking.id,
    });

    return booking;
  }

  async adminRescheduleBooking(
    bookingId: string,
    updates: UpdateBookingDetailsInput,
    actor: Actor,
    billable?: BillableStatus,
    reason?: string
  ): Promise<Booking> {
    this.requireAdmin(actor, "reschedule a booking");

    let booking = await this.updateBookingDetails(bookingId, updates, actor);
    if (billable !== undefined) {
      booking = await this.setBookingBillable(bookingId, billable, actor);
    }

    booking.status = "pending";
    booking.cancellationReason = undefined;
    booking.rejectionReason = undefined;
    booking.statusChangedAt = new Date().toISOString();

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

  async listTimeClockEvents(trainerId: string): Promise<TimeClockEvent[]> {
    return this.timeClockEvents.filter((e) => e.trainerId === trainerId);
  }

  async listAllTimeClockEvents(): Promise<TimeClockEvent[]> {
    return this.timeClockEvents;
  }

  async addTimeClockEvent(
    trainerId: string,
    type: TimeClockEventType,
    actor: Actor
  ): Promise<TimeClockEvent> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError(
        "Trainers can only log time clock events for themselves."
      );
    }

    const weekStart = weekStartDateFor(toLocalDateString(new Date()));
    const timesheetSubmission = this.findTimesheetSubmission(
      trainerId,
      weekStart
    );
    if (computeWeekLockState(timesheetSubmission ?? null) === "locked") {
      throw new ForbiddenError(
        "This week's timesheet has been submitted for review and is locked."
      );
    }

    const existingEvents = this.timeClockEvents.filter(
      (e) => e.trainerId === trainerId
    );
    const currentStatus = computeClockStatus(existingEvents);
    const allowedTypes = nextAllowedEventTypes(currentStatus);
    if (!allowedTypes.includes(type)) {
      throw new Error(
        `Cannot log "${type}" while ${currentStatus.replace("_", " ")}.`
      );
    }

    const event: TimeClockEvent = {
      id: this.generateId("clock"),
      trainerId,
      type,
      timestamp: new Date().toISOString(),
    };
    this.timeClockEvents.push(event);
    return event;
  }

  async listOfficesForProject(projectId: string): Promise<Office[]> {
    return this.offices.filter((o) => o.projectId === projectId);
  }

  async createOffice(input: CreateOfficeInput, actor: Actor): Promise<Office> {
    this.requireAdmin(actor, "manage a project's office list");

    const project = this.projects.find((p) => p.id === input.projectId);
    if (!project) {
      throw new Error(`Project "${input.projectId}" not found.`);
    }

    const office: Office = {
      id: this.generateId("office"),
      projectId: input.projectId,
      name: input.name,
      active: true,
    };
    this.offices.push(office);
    return office;
  }

  async setOfficeActive(
    officeId: string,
    active: boolean,
    actor: Actor
  ): Promise<Office> {
    this.requireAdmin(actor, "manage the office list");

    const office = this.offices.find((o) => o.id === officeId);
    if (!office) {
      throw new Error(`Office "${officeId}" not found.`);
    }
    office.active = active;
    return office;
  }

  async listTaskEntriesForTrainer(trainerId: string): Promise<TaskEntry[]> {
    return this.taskEntries.filter((e) => e.trainerId === trainerId);
  }

  async listAllTaskEntries(): Promise<TaskEntry[]> {
    return this.taskEntries;
  }

  async createTaskEntry(
    input: CreateTaskEntryInput,
    actor: Actor
  ): Promise<TaskEntry> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can log their own task entries.");
    }

    const weekStart = weekStartDateFor(input.date);
    const submission = this.findWeeklySubmission(actor.id, weekStart);
    if (computeWeekLockState(submission ?? null) === "locked") {
      throw new ForbiddenError(
        "This week has been submitted for review and is locked."
      );
    }

    const project = this.projects.find((p) => p.id === input.projectId);
    if (!project) {
      throw new Error(`Project "${input.projectId}" not found.`);
    }

    if (
      !this.offices.some(
        (o) => o.projectId === input.projectId && o.name === input.office
      )
    ) {
      throw new Error(
        `Office "${input.office}" is not one of this project's offices.`
      );
    }

    const task = this.tasks.find((t) => t.id === input.taskId);
    if (!task) {
      throw new Error(`Task "${input.taskId}" not found.`);
    }
    if (task.trainerId !== actor.id) {
      throw new ForbiddenError(
        "Trainers can only log entries against their own tasks."
      );
    }
    if (task.projectId !== input.projectId) {
      throw new Error(
        `Task "${input.taskId}" does not belong to project "${input.projectId}".`
      );
    }

    if (input.bookingId) {
      const booking = this.bookings.find((b) => b.id === input.bookingId);
      if (!booking) {
        throw new Error(`Booking "${input.bookingId}" not found.`);
      }
      if (booking.trainerId !== actor.id) {
        throw new ForbiddenError(
          "Trainers can only link task entries to their own bookings."
        );
      }
    }

    if (!input.note.trim()) {
      throw new Error("A note is required.");
    }

    if (!(input.hours > 0)) {
      throw new Error("Hours must be a positive number.");
    }

    const entry: TaskEntry = {
      id: this.generateId("entry"),
      trainerId: actor.id,
      date: input.date,
      projectId: input.projectId,
      office: input.office,
      taskId: input.taskId,
      note: input.note,
      hours: input.hours,
      location: input.location,
      bookingId: input.bookingId,
      createdAt: new Date().toISOString(),
    };
    this.taskEntries.push(entry);
    return entry;
  }

  async updateTaskEntry(
    entryId: string,
    updates: UpdateTaskEntryInput,
    actor: Actor
  ): Promise<TaskEntry> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can edit their own task entries.");
    }

    const entry = this.taskEntries.find((e) => e.id === entryId);
    if (!entry) {
      throw new Error(`Task entry "${entryId}" not found.`);
    }
    if (entry.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only edit their own entries.");
    }

    const weekStart = weekStartDateFor(entry.date);
    const submission = this.findWeeklySubmission(entry.trainerId, weekStart);
    const lockState = computeWeekLockState(submission ?? null);

    if (lockState === "locked") {
      throw new ForbiddenError(
        "This week has been submitted for review and is locked."
      );
    }

    if (lockState !== "unlocked_by_rejection") {
      const currentWeek = getBusinessWeekDays(new Date());
      if (!isDateInWeek(entry.date, currentWeek)) {
        throw new ForbiddenError(
          "Past weeks are locked — only entries from the current week can be edited."
        );
      }
    }

    const project = this.projects.find((p) => p.id === updates.projectId);
    if (!project) {
      throw new Error(`Project "${updates.projectId}" not found.`);
    }

    if (
      !this.offices.some(
        (o) => o.projectId === updates.projectId && o.name === updates.office
      )
    ) {
      throw new Error(
        `Office "${updates.office}" is not one of this project's offices.`
      );
    }

    const task = this.tasks.find((t) => t.id === updates.taskId);
    if (!task) {
      throw new Error(`Task "${updates.taskId}" not found.`);
    }
    if (task.trainerId !== actor.id) {
      throw new ForbiddenError(
        "Trainers can only log entries against their own tasks."
      );
    }
    if (task.projectId !== updates.projectId) {
      throw new Error(
        `Task "${updates.taskId}" does not belong to project "${updates.projectId}".`
      );
    }

    if (!updates.note.trim()) {
      throw new Error("A note is required.");
    }

    if (!(updates.hours > 0)) {
      throw new Error("Hours must be a positive number.");
    }

    entry.projectId = updates.projectId;
    entry.office = updates.office;
    entry.taskId = updates.taskId;
    entry.note = updates.note;
    entry.hours = updates.hours;
    entry.location = updates.location;
    return entry;
  }

  async deleteTaskEntry(entryId: string, actor: Actor): Promise<void> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can delete their own task entries.");
    }

    const entry = this.taskEntries.find((e) => e.id === entryId);
    if (!entry) {
      throw new Error(`Task entry "${entryId}" not found.`);
    }
    if (entry.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only delete their own entries.");
    }

    const weekStart = weekStartDateFor(entry.date);
    const submission = this.findWeeklySubmission(entry.trainerId, weekStart);
    const lockState = computeWeekLockState(submission ?? null);

    if (lockState === "locked") {
      throw new ForbiddenError(
        "This week has been submitted for review and is locked."
      );
    }

    if (lockState !== "unlocked_by_rejection") {
      const currentWeek = getBusinessWeekDays(new Date());
      if (!isDateInWeek(entry.date, currentWeek)) {
        throw new ForbiddenError(
          "Past weeks are locked — only entries from the current week can be edited."
        );
      }
    }

    this.taskEntries = this.taskEntries.filter((e) => e.id !== entryId);
  }

  async listFavoriteTasksForTrainer(
    trainerId: string
  ): Promise<FavoriteTask[]> {
    return this.favoriteTasks.filter((f) => f.trainerId === trainerId);
  }

  async addFavoriteTask(
    taskName: string,
    actor: Actor
  ): Promise<FavoriteTask> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can manage their own favorites.");
    }

    const trimmed = taskName.trim();
    if (!trimmed) {
      throw new Error("A task name is required.");
    }

    const existing = this.favoriteTasks.find(
      (f) =>
        f.trainerId === actor.id &&
        f.taskName.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      return existing;
    }

    const favorite: FavoriteTask = {
      id: this.generateId("favorite"),
      trainerId: actor.id,
      taskName: trimmed,
      createdAt: new Date().toISOString(),
    };
    this.favoriteTasks.push(favorite);
    return favorite;
  }

  async removeFavoriteTask(favoriteId: string, actor: Actor): Promise<void> {
    const favorite = this.favoriteTasks.find((f) => f.id === favoriteId);
    if (!favorite) {
      throw new Error(`Favorite "${favoriteId}" not found.`);
    }
    if (favorite.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only remove their own favorites.");
    }
    this.favoriteTasks = this.favoriteTasks.filter(
      (f) => f.id !== favoriteId
    );
  }

  async getFlagThresholds(): Promise<FlagThresholds> {
    return this.flagThresholds;
  }

  async updateFlagThresholds(
    input: FlagThresholds,
    actor: Actor
  ): Promise<FlagThresholds> {
    this.requireAdmin(actor, "configure flag thresholds");

    if (
      !(input.unsubmittedTaskTrackerDays > 0) ||
      !(input.pendingBookingUnansweredHours > 0) ||
      !(input.inactiveTrainerDays > 0)
    ) {
      throw new Error("Every threshold must be a positive number.");
    }

    this.flagThresholds = { ...input };
    return this.flagThresholds;
  }

  /**
   * Re-detects every flag situation and reconciles it against
   * `this.flagRecords`: a resolved situation's record is dropped (so a
   * future recurrence starts fresh); a new situation gets a new record; a
   * dismissed record resurfaces only if its signature (how bad the
   * situation is) no longer matches what was dismissed.
   *
   * When `trainerId` is given, every fetch and the detection pass itself
   * are scoped to that one trainer (via the same per-trainer store methods
   * a real DB-backed implementation would turn into indexed lookups,
   * instead of the org-wide `listAll*` scans) — visiting one trainer's
   * Flags tab shouldn't do org-wide work. Reconciling `flagRecords` is
   * scoped the same way, so a single-trainer pass never touches (or
   * accidentally drops) another trainer's dismissal state.
   */
  private async reconcileFlags(trainerId?: string): Promise<FlagRecord[]> {
    const [allTrainers, bookings, taskEntries, timeClockEvents, projects] =
      await Promise.all([
        this.listTrainers(),
        trainerId ? this.listBookingsForTrainer(trainerId) : this.listAllBookings(),
        trainerId
          ? this.listTaskEntriesForTrainer(trainerId)
          : this.listAllTaskEntries(),
        trainerId
          ? this.listTimeClockEvents(trainerId)
          : this.listAllTimeClockEvents(),
        this.listProjects(),
      ]);

    const trainers = trainerId
      ? allTrainers.filter((t) => t.id === trainerId)
      : allTrainers;

    const candidates = computeFlagCandidates({
      trainers,
      bookings,
      taskEntries,
      timeClockEvents,
      projects,
      thresholds: this.flagThresholds,
      now: new Date(),
    });

    const candidateKeys = new Set(candidates.map((c) => c.key));
    this.flagRecords = this.flagRecords.filter(
      (r) =>
        (trainerId !== undefined && r.trainerId !== trainerId) ||
        candidateKeys.has(r.key)
    );

    for (const candidate of candidates) {
      const existing = this.flagRecords.find((r) => r.key === candidate.key);
      if (!existing) {
        const flagId = this.generateId("flag");
        this.flagRecords.push({
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
          createdAt: new Date().toISOString(),
        });
        // Cancellation requests already get their own notification, created
        // immediately in requestBookingCancellation — this generic
        // new-flag hook would otherwise double it up.
        if (candidate.type !== "cancellation_requested") {
          await this.createNotification({
            type: "flag",
            message: candidate.message,
            relatedTrainerId: candidate.trainerId,
            relatedEntityId: flagId,
          });
        }
        continue;
      }

      existing.message = candidate.message;
      existing.severity = candidate.severity;
      existing.relatedBookingId = candidate.relatedBookingId;
      existing.relatedProjectId = candidate.relatedProjectId;
      if (existing.status === "dismissed" && existing.signature !== candidate.signature) {
        existing.status = "active";
        existing.dismissedAt = undefined;
        existing.dismissedByNote = undefined;
      }
      existing.signature = candidate.signature;
    }

    return trainerId
      ? this.flagRecords.filter((r) => r.trainerId === trainerId)
      : this.flagRecords;
  }

  /** Warning before info; most-recently-created first within each severity. */
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

  async listActiveFlagsForTrainer(
    trainerId: string,
    actor: Actor
  ): Promise<Flag[]> {
    this.requireAdmin(actor, "view flags");

    const records = await this.reconcileFlags(trainerId);
    return this.toSortedActiveFlags(records);
  }

  async dismissFlag(
    flagId: string,
    input: DismissFlagInput,
    actor: Actor
  ): Promise<Flag> {
    this.requireAdmin(actor, "dismiss flags");

    const record = this.flagRecords.find((r) => r.id === flagId);
    if (!record) {
      throw new Error(`Flag "${flagId}" not found.`);
    }

    record.status = "dismissed";
    record.dismissedAt = new Date().toISOString();
    record.dismissedByNote = input.note?.trim() || undefined;
    return toFlag(record);
  }

  async dismissAllFlags(actor: Actor): Promise<Flag[]> {
    this.requireAdmin(actor, "dismiss flags");

    const now = new Date().toISOString();
    const dismissed: Flag[] = [];
    for (const record of this.flagRecords) {
      if (record.status !== "active") continue;
      record.status = "dismissed";
      record.dismissedAt = now;
      dismissed.push(toFlag(record));
    }
    return dismissed;
  }

  private findWeeklySubmission(
    trainerId: string,
    weekStartDate: string
  ): WeeklySubmission | undefined {
    return this.weeklySubmissions.find(
      (s) => s.trainerId === trainerId && s.weekStartDate === weekStartDate
    );
  }

  async listWeeklySubmissionsForTrainer(
    trainerId: string,
    actor: Actor
  ): Promise<WeeklySubmission[]> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError(
        "Trainers can only view their own weekly submissions."
      );
    }
    return this.weeklySubmissions.filter((s) => s.trainerId === trainerId);
  }

  async listPendingWeeklySubmissions(actor: Actor): Promise<WeeklySubmission[]> {
    this.requireAdmin(actor, "review weekly submissions");

    return this.weeklySubmissions
      .filter((s) => s.status === "submitted")
      .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  }

  async submitWeek(
    weekStartDate: string,
    actor: Actor
  ): Promise<WeeklySubmission> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can submit their own weeks.");
    }

    const existing = this.findWeeklySubmission(actor.id, weekStartDate);
    if (existing && (existing.status === "submitted" || existing.status === "approved")) {
      throw new Error("This week has already been submitted.");
    }

    let submission: WeeklySubmission;
    if (existing) {
      existing.status = "submitted";
      existing.submittedAt = new Date().toISOString();
      existing.reviewedAt = undefined;
      existing.reviewedByAdminId = undefined;
      existing.rejectionReason = undefined;
      submission = existing;
    } else {
      submission = {
        id: this.generateId("submission"),
        trainerId: actor.id,
        weekStartDate,
        status: "submitted",
        submittedAt: new Date().toISOString(),
      };
      this.weeklySubmissions.push(submission);
    }

    const trainer = this.users.find((u) => u.id === actor.id);
    await this.createNotification({
      type: "submission",
      message: `${
        trainer?.name ?? "A trainer"
      } submitted their week of ${formatWeekLabel(weekStartDate)} for review.`,
      relatedTrainerId: actor.id,
      relatedEntityId: submission.id,
    });

    return submission;
  }

  async approveWeeklySubmission(
    submissionId: string,
    actor: Actor
  ): Promise<WeeklySubmission> {
    this.requireAdmin(actor, "approve weekly submissions");

    const submission = this.weeklySubmissions.find((s) => s.id === submissionId);
    if (!submission) {
      throw new Error(`Weekly submission "${submissionId}" not found.`);
    }
    if (submission.status !== "submitted") {
      throw new Error("Only a submitted week can be approved.");
    }

    submission.status = "approved";
    submission.reviewedAt = new Date().toISOString();
    submission.reviewedByAdminId = actor.id;
    submission.rejectionReason = undefined;

    await this.createNotification({
      type: "submission_decision",
      recipientRole: "trainer",
      message: `Your Task Tracker week of ${formatWeekLabel(
        submission.weekStartDate
      )} was approved.`,
      relatedTrainerId: submission.trainerId,
      relatedEntityId: submission.id,
    });

    return submission;
  }

  async rejectWeeklySubmission(
    submissionId: string,
    reason: string,
    actor: Actor
  ): Promise<WeeklySubmission> {
    this.requireAdmin(actor, "reject weekly submissions");

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error("A rejection reason is required.");
    }

    const submission = this.weeklySubmissions.find((s) => s.id === submissionId);
    if (!submission) {
      throw new Error(`Weekly submission "${submissionId}" not found.`);
    }
    if (submission.status !== "submitted") {
      throw new Error("Only a submitted week can be rejected.");
    }

    submission.status = "rejected";
    submission.reviewedAt = new Date().toISOString();
    submission.reviewedByAdminId = actor.id;
    submission.rejectionReason = trimmedReason;

    await this.createNotification({
      type: "submission_decision",
      recipientRole: "trainer",
      message: `Your Task Tracker week of ${formatWeekLabel(
        submission.weekStartDate
      )} was rejected: "${trimmedReason}"`,
      relatedTrainerId: submission.trainerId,
      relatedEntityId: submission.id,
    });

    return submission;
  }

  private findTimesheetSubmission(
    trainerId: string,
    weekStartDate: string
  ): TimesheetSubmission | undefined {
    return this.timesheetSubmissions.find(
      (s) => s.trainerId === trainerId && s.weekStartDate === weekStartDate
    );
  }

  async listTimesheetSubmissionsForTrainer(
    trainerId: string,
    actor: Actor
  ): Promise<TimesheetSubmission[]> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError(
        "Trainers can only view their own timesheet submissions."
      );
    }
    return this.timesheetSubmissions.filter((s) => s.trainerId === trainerId);
  }

  async listPendingTimesheetSubmissions(
    actor: Actor
  ): Promise<TimesheetSubmission[]> {
    this.requireAdmin(actor, "review timesheet submissions");

    return this.timesheetSubmissions
      .filter((s) => s.status === "submitted")
      .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  }

  async submitTimesheetWeek(
    weekStartDate: string,
    actor: Actor
  ): Promise<TimesheetSubmission> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can submit their own timesheet.");
    }

    const existing = this.findTimesheetSubmission(actor.id, weekStartDate);
    if (existing && (existing.status === "submitted" || existing.status === "approved")) {
      throw new Error("This week's timesheet has already been submitted.");
    }

    let submission: TimesheetSubmission;
    if (existing) {
      existing.status = "submitted";
      existing.submittedAt = new Date().toISOString();
      existing.reviewedAt = undefined;
      existing.reviewedByAdminId = undefined;
      existing.rejectionReason = undefined;
      submission = existing;
    } else {
      submission = {
        id: this.generateId("timesheet-submission"),
        trainerId: actor.id,
        weekStartDate,
        status: "submitted",
        submittedAt: new Date().toISOString(),
      };
      this.timesheetSubmissions.push(submission);
    }

    const trainer = this.users.find((u) => u.id === actor.id);
    await this.createNotification({
      type: "timesheet_submission",
      message: `${
        trainer?.name ?? "A trainer"
      } submitted their timesheet for the week of ${formatWeekLabel(
        weekStartDate
      )} for review.`,
      relatedTrainerId: actor.id,
      relatedEntityId: submission.id,
    });

    return submission;
  }

  async approveTimesheetSubmission(
    submissionId: string,
    actor: Actor
  ): Promise<TimesheetSubmission> {
    this.requireAdmin(actor, "approve timesheet submissions");

    const submission = this.timesheetSubmissions.find(
      (s) => s.id === submissionId
    );
    if (!submission) {
      throw new Error(`Timesheet submission "${submissionId}" not found.`);
    }
    if (submission.status !== "submitted") {
      throw new Error("Only a submitted timesheet can be approved.");
    }

    submission.status = "approved";
    submission.reviewedAt = new Date().toISOString();
    submission.reviewedByAdminId = actor.id;
    submission.rejectionReason = undefined;

    await this.createNotification({
      type: "timesheet_submission_decision",
      recipientRole: "trainer",
      message: `Your timesheet for the week of ${formatWeekLabel(
        submission.weekStartDate
      )} was approved.`,
      relatedTrainerId: submission.trainerId,
      relatedEntityId: submission.id,
    });

    return submission;
  }

  async rejectTimesheetSubmission(
    submissionId: string,
    reason: string,
    actor: Actor
  ): Promise<TimesheetSubmission> {
    this.requireAdmin(actor, "reject timesheet submissions");

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error("A rejection reason is required.");
    }

    const submission = this.timesheetSubmissions.find(
      (s) => s.id === submissionId
    );
    if (!submission) {
      throw new Error(`Timesheet submission "${submissionId}" not found.`);
    }
    if (submission.status !== "submitted") {
      throw new Error("Only a submitted timesheet can be rejected.");
    }

    submission.status = "rejected";
    submission.reviewedAt = new Date().toISOString();
    submission.reviewedByAdminId = actor.id;
    submission.rejectionReason = trimmedReason;

    await this.createNotification({
      type: "timesheet_submission_decision",
      recipientRole: "trainer",
      message: `Your timesheet for the week of ${formatWeekLabel(
        submission.weekStartDate
      )} was rejected: "${trimmedReason}"`,
      relatedTrainerId: submission.trainerId,
      relatedEntityId: submission.id,
    });

    return submission;
  }

  async listNotifications(actor: Actor): Promise<Notification[]> {
    const visible =
      actor.role === "admin"
        ? this.notifications.filter((n) => n.recipientRole === "admin")
        : this.notifications.filter(
            (n) =>
              n.recipientRole === "trainer" && n.relatedTrainerId === actor.id
          );

    return [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createNotification(
    input: CreateNotificationInput
  ): Promise<Notification> {
    const notification: Notification = {
      id: this.generateId("notification"),
      type: input.type,
      recipientRole: input.recipientRole ?? "admin",
      message: input.message,
      relatedTrainerId: input.relatedTrainerId,
      relatedEntityId: input.relatedEntityId,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.push(notification);
    return notification;
  }

  async markNotificationRead(
    notificationId: string,
    actor: Actor
  ): Promise<Notification> {
    const notification = this.notifications.find(
      (n) => n.id === notificationId
    );
    if (!notification) {
      throw new Error(`Notification "${notificationId}" not found.`);
    }

    if (actor.role === "admin" && notification.recipientRole !== "admin") {
      throw new ForbiddenError(
        "Admins can only mark admin notifications as read."
      );
    }
    if (
      actor.role === "trainer" &&
      (notification.recipientRole !== "trainer" ||
        notification.relatedTrainerId !== actor.id)
    ) {
      throw new ForbiddenError(
        "Trainers can only mark their own notifications as read."
      );
    }

    notification.read = true;
    return notification;
  }

  async listClockCorrectionRequestsForTrainer(
    trainerId: string,
    actor: Actor
  ): Promise<ClockCorrectionRequest[]> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError(
        "Trainers can only view their own correction requests."
      );
    }

    return this.clockCorrectionRequests
      .filter((r) => r.trainerId === trainerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listPendingClockCorrectionRequests(
    actor: Actor
  ): Promise<ClockCorrectionRequest[]> {
    this.requireAdmin(actor, "view clock correction requests");

    return this.clockCorrectionRequests
      .filter((r) => r.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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

    const event = this.timeClockEvents.find((e) => e.id === eventId);
    if (!event) {
      throw new Error(`Time clock event "${eventId}" not found.`);
    }
    if (event.trainerId !== actor.id) {
      throw new ForbiddenError(
        "Trainers can only request corrections for their own events."
      );
    }

    const hasPending = this.clockCorrectionRequests.some(
      (r) => r.originalEventId === eventId && r.status === "pending"
    );
    if (hasPending) {
      throw new Error("This event already has a pending correction request.");
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error("A reason is required.");
    }

    const request: ClockCorrectionRequest = {
      id: this.generateId("correction"),
      trainerId: actor.id,
      originalEventId: eventId,
      originalTimestamp: event.timestamp,
      requestedTimestamp,
      reason: trimmedReason,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.clockCorrectionRequests.push(request);

    const trainer = this.users.find((u) => u.id === actor.id);
    await this.createNotification({
      type: "clock_correction",
      message: `${
        trainer?.name ?? "A trainer"
      } requested a time clock correction (${
        TIME_CLOCK_EVENT_LABELS[event.type]
      }: ${formatDateTime(event.timestamp)} → ${formatDateTime(
        requestedTimestamp
      )}).`,
      relatedTrainerId: actor.id,
      relatedEntityId: request.id,
    });

    return request;
  }

  async approveClockCorrection(
    requestId: string,
    actor: Actor
  ): Promise<ClockCorrectionRequest> {
    this.requireAdmin(actor, "approve clock correction requests");

    const request = this.clockCorrectionRequests.find(
      (r) => r.id === requestId
    );
    if (!request) {
      throw new Error(`Clock correction request "${requestId}" not found.`);
    }
    if (request.status !== "pending") {
      throw new Error("Only a pending request can be approved.");
    }

    const event = this.timeClockEvents.find(
      (e) => e.id === request.originalEventId
    );
    if (!event) {
      throw new Error(
        `Time clock event "${request.originalEventId}" not found.`
      );
    }
    event.timestamp = request.requestedTimestamp;

    request.status = "approved";
    request.reviewedAt = new Date().toISOString();

    await this.createNotification({
      type: "clock_correction_decision",
      recipientRole: "trainer",
      message: `Your correction request for ${
        TIME_CLOCK_EVENT_LABELS[event.type]
      } (${formatDateTime(request.requestedTimestamp)}) was approved.`,
      relatedTrainerId: request.trainerId,
      relatedEntityId: request.id,
    });

    return request;
  }

  async denyClockCorrection(
    requestId: string,
    adminNote: string | undefined,
    actor: Actor
  ): Promise<ClockCorrectionRequest> {
    this.requireAdmin(actor, "deny clock correction requests");

    const request = this.clockCorrectionRequests.find(
      (r) => r.id === requestId
    );
    if (!request) {
      throw new Error(`Clock correction request "${requestId}" not found.`);
    }
    if (request.status !== "pending") {
      throw new Error("Only a pending request can be denied.");
    }

    request.status = "denied";
    request.reviewedAt = new Date().toISOString();
    request.adminNote = adminNote?.trim() || undefined;

    await this.createNotification({
      type: "clock_correction_decision",
      recipientRole: "trainer",
      message: `Your correction request was denied.${
        request.adminNote ? ` "${request.adminNote}"` : ""
      }`,
      relatedTrainerId: request.trainerId,
      relatedEntityId: request.id,
    });

    return request;
  }

  async listManualSessionRequestsForTrainer(
    trainerId: string,
    actor: Actor
  ): Promise<ManualSessionRequest[]> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError(
        "Trainers can only view their own manual session requests."
      );
    }

    return this.manualSessionRequests
      .filter((r) => r.trainerId === trainerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listPendingManualSessionRequests(
    actor: Actor
  ): Promise<ManualSessionRequest[]> {
    this.requireAdmin(actor, "view manual session requests");

    return this.manualSessionRequests
      .filter((r) => r.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async requestManualSession(
    input: CreateManualSessionInput,
    actor: Actor
  ): Promise<ManualSessionRequest> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can log a manual session.");
    }

    const trimmedReason = input.reason.trim();
    if (!trimmedReason) {
      throw new Error("A reason is required.");
    }

    const clockInMs = new Date(input.clockIn).getTime();
    const clockOutMs = new Date(input.clockOut).getTime();
    if (!(clockOutMs > clockInMs)) {
      throw new Error("Clock-out must be after clock-in.");
    }

    const sortedBreaks = [...input.breaks].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    let previousEndMs = clockInMs;
    for (const brk of sortedBreaks) {
      const startMs = new Date(brk.start).getTime();
      const endMs = new Date(brk.end).getTime();
      if (!(endMs > startMs)) {
        throw new Error("Each break's end must be after its start.");
      }
      if (startMs < clockInMs || endMs > clockOutMs) {
        throw new Error(
          "Breaks must fall within the clock-in/clock-out window."
        );
      }
      if (startMs < previousEndMs) {
        throw new Error("Breaks cannot overlap.");
      }
      previousEndMs = endMs;
    }

    const hasPending = this.manualSessionRequests.some(
      (r) =>
        r.trainerId === actor.id &&
        r.date === input.date &&
        r.status === "pending"
    );
    if (hasPending) {
      throw new Error("You already have a pending request for this date.");
    }

    const request: ManualSessionRequest = {
      id: this.generateId("manual-session"),
      trainerId: actor.id,
      date: input.date,
      clockIn: input.clockIn,
      clockOut: input.clockOut,
      breaks: sortedBreaks,
      reason: trimmedReason,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.manualSessionRequests.push(request);

    const trainer = this.users.find((u) => u.id === actor.id);
    await this.createNotification({
      type: "manual_session",
      message: `${
        trainer?.name ?? "A trainer"
      } logged a missed day (${formatDateTime(
        input.clockIn
      )} – ${formatDateTime(input.clockOut)}) for review.`,
      relatedTrainerId: actor.id,
      relatedEntityId: request.id,
    });

    return request;
  }

  async approveManualSession(
    requestId: string,
    actor: Actor
  ): Promise<ManualSessionRequest> {
    this.requireAdmin(actor, "approve manual session requests");

    const request = this.manualSessionRequests.find(
      (r) => r.id === requestId
    );
    if (!request) {
      throw new Error(`Manual session request "${requestId}" not found.`);
    }
    if (request.status !== "pending") {
      throw new Error("Only a pending request can be approved.");
    }

    const createdEventIds: string[] = [];

    const clockInEvent: TimeClockEvent = {
      id: this.generateId("clock"),
      trainerId: request.trainerId,
      type: "clock_in",
      timestamp: request.clockIn,
      manuallyLogged: true,
    };
    this.timeClockEvents.push(clockInEvent);
    createdEventIds.push(clockInEvent.id);

    for (const brk of request.breaks) {
      const startEvent: TimeClockEvent = {
        id: this.generateId("clock"),
        trainerId: request.trainerId,
        type: "break_start",
        timestamp: brk.start,
        manuallyLogged: true,
      };
      const endEvent: TimeClockEvent = {
        id: this.generateId("clock"),
        trainerId: request.trainerId,
        type: "break_end",
        timestamp: brk.end,
        manuallyLogged: true,
      };
      this.timeClockEvents.push(startEvent, endEvent);
      createdEventIds.push(startEvent.id, endEvent.id);
    }

    const clockOutEvent: TimeClockEvent = {
      id: this.generateId("clock"),
      trainerId: request.trainerId,
      type: "clock_out",
      timestamp: request.clockOut,
      manuallyLogged: true,
    };
    this.timeClockEvents.push(clockOutEvent);
    createdEventIds.push(clockOutEvent.id);

    request.status = "approved";
    request.reviewedAt = new Date().toISOString();
    request.createdEventIds = createdEventIds;

    await this.createNotification({
      type: "manual_session_decision",
      recipientRole: "trainer",
      message: `Your missed-day request for ${request.date} was approved.`,
      relatedTrainerId: request.trainerId,
      relatedEntityId: request.id,
    });

    return request;
  }

  async denyManualSession(
    requestId: string,
    adminNote: string | undefined,
    actor: Actor
  ): Promise<ManualSessionRequest> {
    this.requireAdmin(actor, "deny manual session requests");

    const request = this.manualSessionRequests.find(
      (r) => r.id === requestId
    );
    if (!request) {
      throw new Error(`Manual session request "${requestId}" not found.`);
    }
    if (request.status !== "pending") {
      throw new Error("Only a pending request can be denied.");
    }

    request.status = "denied";
    request.reviewedAt = new Date().toISOString();
    request.adminNote = adminNote?.trim() || undefined;

    await this.createNotification({
      type: "manual_session_decision",
      recipientRole: "trainer",
      message: `Your missed-day request for ${request.date} was denied.${
        request.adminNote ? ` "${request.adminNote}"` : ""
      }`,
      relatedTrainerId: request.trainerId,
      relatedEntityId: request.id,
    });

    return request;
  }

  private validateExpenseInput(
    input: CreateExpenseInput | UpdateExpenseInput
  ): void {
    if (input.projectId && !this.projects.some((p) => p.id === input.projectId)) {
      throw new Error(`Project "${input.projectId}" not found.`);
    }
    if (!input.date) {
      throw new Error("Date is required.");
    }
    if (!EXPENSE_CATEGORIES.includes(input.category)) {
      throw new Error(`"${input.category}" is not a valid expense category.`);
    }
    if (!(input.amount > 0)) {
      throw new Error("Amount must be a positive number.");
    }
    if (!input.description.trim()) {
      throw new Error("A description is required.");
    }
  }

  async listExpensesForTrainer(
    trainerId: string,
    actor: Actor
  ): Promise<Expense[]> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError("Trainers can only view their own expenses.");
    }
    return this.expenses
      .filter((e) => e.trainerId === trainerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listPendingExpenses(actor: Actor): Promise<Expense[]> {
    this.requireAdmin(actor, "review expenses");

    return this.expenses
      .filter((e) => e.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createExpense(
    input: CreateExpenseInput,
    actor: Actor
  ): Promise<Expense> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can submit their own expenses.");
    }
    this.validateExpenseInput(input);

    const expense: Expense = {
      id: this.generateId("expense"),
      trainerId: actor.id,
      projectId: input.projectId,
      date: input.date,
      category: input.category,
      amount: input.amount,
      description: input.description.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.expenses.push(expense);

    const trainer = this.users.find((u) => u.id === actor.id);
    await this.createNotification({
      type: "expense_submitted",
      message: `${
        trainer?.name ?? "A trainer"
      } submitted a ${input.category} expense for ${formatCurrency(
        input.amount
      )}.`,
      relatedTrainerId: actor.id,
      relatedEntityId: expense.id,
    });

    return expense;
  }

  async updateExpense(
    expenseId: string,
    updates: UpdateExpenseInput,
    actor: Actor
  ): Promise<Expense> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError("Only trainers can edit their own expenses.");
    }

    const expense = this.expenses.find((e) => e.id === expenseId);
    if (!expense) {
      throw new Error(`Expense "${expenseId}" not found.`);
    }
    if (expense.trainerId !== actor.id) {
      throw new ForbiddenError("Trainers can only edit their own expenses.");
    }
    if (expense.status !== "rejected") {
      throw new ForbiddenError(
        "Only a rejected expense can be edited and resubmitted."
      );
    }

    this.validateExpenseInput(updates);

    expense.projectId = updates.projectId;
    expense.date = updates.date;
    expense.category = updates.category;
    expense.amount = updates.amount;
    expense.description = updates.description.trim();
    expense.status = "pending";
    expense.rejectionReason = undefined;
    expense.reviewedAt = undefined;
    expense.reviewedByAdminId = undefined;

    const trainer = this.users.find((u) => u.id === actor.id);
    await this.createNotification({
      type: "expense_submitted",
      message: `${
        trainer?.name ?? "A trainer"
      } resubmitted a ${updates.category} expense for ${formatCurrency(
        updates.amount
      )}.`,
      relatedTrainerId: actor.id,
      relatedEntityId: expense.id,
    });

    return expense;
  }

  async approveExpense(expenseId: string, actor: Actor): Promise<Expense> {
    this.requireAdmin(actor, "approve expenses");

    const expense = this.expenses.find((e) => e.id === expenseId);
    if (!expense) {
      throw new Error(`Expense "${expenseId}" not found.`);
    }
    if (expense.status !== "pending") {
      throw new Error("Only a pending expense can be approved.");
    }

    expense.status = "approved";
    expense.reviewedAt = new Date().toISOString();
    expense.reviewedByAdminId = actor.id;
    expense.rejectionReason = undefined;

    await this.createNotification({
      type: "expense_decision",
      recipientRole: "trainer",
      message: `Your ${expense.category} expense for ${formatCurrency(
        expense.amount
      )} was approved.`,
      relatedTrainerId: expense.trainerId,
      relatedEntityId: expense.id,
    });

    return expense;
  }

  async rejectExpense(
    expenseId: string,
    reason: string,
    actor: Actor
  ): Promise<Expense> {
    this.requireAdmin(actor, "reject expenses");

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error("A rejection reason is required.");
    }

    const expense = this.expenses.find((e) => e.id === expenseId);
    if (!expense) {
      throw new Error(`Expense "${expenseId}" not found.`);
    }
    if (expense.status !== "pending") {
      throw new Error("Only a pending expense can be rejected.");
    }

    expense.status = "rejected";
    expense.reviewedAt = new Date().toISOString();
    expense.reviewedByAdminId = actor.id;
    expense.rejectionReason = trimmedReason;

    await this.createNotification({
      type: "expense_decision",
      recipientRole: "trainer",
      message: `Your ${expense.category} expense for ${formatCurrency(
        expense.amount
      )} was rejected: "${trimmedReason}"`,
      relatedTrainerId: expense.trainerId,
      relatedEntityId: expense.id,
    });

    return expense;
  }

  async listUnavailabilityBlocksForTrainer(
    trainerId: string,
    actor: Actor
  ): Promise<UnavailabilityBlock[]> {
    if (actor.role === "trainer" && actor.id !== trainerId) {
      throw new ForbiddenError(
        "Trainers can only view their own unavailability blocks."
      );
    }
    return this.unavailabilityBlocks
      .filter((b) => b.trainerId === trainerId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  async createUnavailabilityBlock(
    input: CreateUnavailabilityBlockInput,
    actor: Actor
  ): Promise<UnavailabilityBlock> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError(
        "Only trainers can manage their own unavailability."
      );
    }

    if (!input.startDate) {
      throw new Error("Start date is required.");
    }
    if (input.type === "recurring") {
      if (
        input.recurringDayOfWeek === undefined ||
        input.recurringDayOfWeek < 0 ||
        input.recurringDayOfWeek > 6
      ) {
        throw new Error(
          "A day of week (0–6) is required for a recurring block."
        );
      }
    }
    if (input.endDate && input.endDate < input.startDate) {
      throw new Error("End date must be on or after the start date.");
    }
    if (
      (input.startTime && !input.endTime) ||
      (!input.startTime && input.endTime)
    ) {
      throw new Error(
        "Start time and end time must be set together, or both left blank for a full-day block."
      );
    }
    if (input.startTime && input.endTime && input.endTime <= input.startTime) {
      throw new Error("End time must be after start time.");
    }

    const block: UnavailabilityBlock = {
      id: this.generateId("unavailability"),
      trainerId: actor.id,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      startTime: input.startTime,
      endTime: input.endTime,
      recurringDayOfWeek:
        input.type === "recurring" ? input.recurringDayOfWeek : undefined,
      reason: input.reason?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    this.unavailabilityBlocks.push(block);
    return block;
  }

  async deleteUnavailabilityBlock(
    blockId: string,
    actor: Actor
  ): Promise<void> {
    if (actor.role !== "trainer") {
      throw new ForbiddenError(
        "Only trainers can manage their own unavailability."
      );
    }

    const block = this.unavailabilityBlocks.find((b) => b.id === blockId);
    if (!block) {
      throw new Error(`Unavailability block "${blockId}" not found.`);
    }
    if (block.trainerId !== actor.id) {
      throw new ForbiddenError(
        "Trainers can only delete their own unavailability blocks."
      );
    }

    this.unavailabilityBlocks = this.unavailabilityBlocks.filter(
      (b) => b.id !== blockId
    );
  }
}
