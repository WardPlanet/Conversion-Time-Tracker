import type {
  BillableStatus,
  BookingLocation,
  BookingStatus,
  ClockCorrectionStatus,
  ExpenseStatus,
  ManualSessionRequestStatus,
  Project,
  ProjectStatus,
  TaskStatus,
  TimesheetSubmissionStatus,
  WeeklySubmissionStatus,
} from "@/lib/types";

export function Tag({
  children,
  className = "bg-brand-blueWater text-brand-darkBlue",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function ProjectDot({
  color,
  className = "h-2.5 w-2.5",
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}

export function ProjectBadge({
  project,
}: {
  project: Pick<Project, "name" | "color"> | null;
}) {
  if (!project) {
    return <span className="text-sm text-brand-darkBlue/50">Unknown project</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-brand-darkBlue/80">
      <ProjectDot color={project.color} />
      {project.name}
    </span>
  );
}

export function LocationTag({ location }: { location: BookingLocation }) {
  return (
    <Tag className="bg-brand-blue/10 text-brand-blue">
      {location === "on_site" ? "On-site" : "Remote"}
    </Tag>
  );
}

export function OfficeTag({ office }: { office: string }) {
  return (
    <Tag className="bg-brand-blueWater text-brand-darkBlue/70">{office}</Tag>
  );
}

export function BillableTag({ billable }: { billable: BillableStatus }) {
  return billable === "billable" ? (
    <Tag className="bg-brand-orange/10 text-brand-orange">Billable</Tag>
  ) : (
    <Tag className="bg-brand-blueWater text-brand-darkBlue/70">Non-billable</Tag>
  );
}

const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-brand-orange/10 text-brand-orange",
  accepted: "bg-brand-green/10 text-brand-green",
  rejected: "bg-red-50 text-red-700",
  reassigned: "bg-brand-blueWater text-brand-darkBlue",
  rebooked: "bg-brand-blue/10 text-brand-blue",
  cancellation_requested: "bg-brand-orange/10 text-brand-orange",
  cancelled: "bg-red-50 text-red-700",
};

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  reassigned: "Reassigned",
  rebooked: "Rebooked",
  cancellation_requested: "Cancellation pending",
  cancelled: "Cancelled",
};

export function BookingStatusTag({ status }: { status: BookingStatus }) {
  return (
    <Tag className={BOOKING_STATUS_STYLES[status]}>
      {BOOKING_STATUS_LABELS[status]}
    </Tag>
  );
}

const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  not_started: "bg-brand-blueWater text-brand-darkBlue/70",
  in_progress: "bg-brand-blue/10 text-brand-blue",
  completed: "bg-brand-green/10 text-brand-green",
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export function TaskStatusTag({ status }: { status: TaskStatus }) {
  return (
    <Tag className={TASK_STATUS_STYLES[status]}>
      {TASK_STATUS_LABELS[status]}
    </Tag>
  );
}

const WEEKLY_SUBMISSION_STATUS_STYLES: Record<WeeklySubmissionStatus, string> = {
  draft: "bg-brand-blueWater text-brand-darkBlue/70",
  submitted: "bg-brand-orange/10 text-brand-orange",
  approved: "bg-brand-green/10 text-brand-green",
  rejected: "bg-red-50 text-red-700",
};

const WEEKLY_SUBMISSION_STATUS_LABELS: Record<WeeklySubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export function WeeklySubmissionStatusTag({
  status,
}: {
  status: WeeklySubmissionStatus;
}) {
  return (
    <Tag className={WEEKLY_SUBMISSION_STATUS_STYLES[status]}>
      {WEEKLY_SUBMISSION_STATUS_LABELS[status]}
    </Tag>
  );
}

const TIMESHEET_SUBMISSION_STATUS_STYLES: Record<TimesheetSubmissionStatus, string> = {
  draft: "bg-brand-blueWater text-brand-darkBlue/70",
  submitted: "bg-brand-orange/10 text-brand-orange",
  approved: "bg-brand-green/10 text-brand-green",
  rejected: "bg-red-50 text-red-700",
};

const TIMESHEET_SUBMISSION_STATUS_LABELS: Record<TimesheetSubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export function TimesheetSubmissionStatusTag({
  status,
}: {
  status: TimesheetSubmissionStatus;
}) {
  return (
    <Tag className={TIMESHEET_SUBMISSION_STATUS_STYLES[status]}>
      {TIMESHEET_SUBMISSION_STATUS_LABELS[status]}
    </Tag>
  );
}

const CLOCK_CORRECTION_STATUS_STYLES: Record<ClockCorrectionStatus, string> = {
  pending: "bg-brand-orange/10 text-brand-orange",
  approved: "bg-brand-green/10 text-brand-green",
  denied: "bg-red-50 text-red-700",
};

const CLOCK_CORRECTION_STATUS_LABELS: Record<ClockCorrectionStatus, string> = {
  pending: "Correction pending",
  approved: "Corrected",
  denied: "Correction denied",
};

export function ClockCorrectionStatusTag({
  status,
}: {
  status: ClockCorrectionStatus;
}) {
  return (
    <Tag className={CLOCK_CORRECTION_STATUS_STYLES[status]}>
      {CLOCK_CORRECTION_STATUS_LABELS[status]}
    </Tag>
  );
}

const MANUAL_SESSION_STATUS_STYLES: Record<ManualSessionRequestStatus, string> = {
  pending: "bg-brand-orange/10 text-brand-orange",
  approved: "bg-brand-green/10 text-brand-green",
  denied: "bg-red-50 text-red-700",
};

const MANUAL_SESSION_STATUS_LABELS: Record<ManualSessionRequestStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  denied: "Denied",
};

export function ManualSessionStatusTag({
  status,
}: {
  status: ManualSessionRequestStatus;
}) {
  return (
    <Tag className={MANUAL_SESSION_STATUS_STYLES[status]}>
      {MANUAL_SESSION_STATUS_LABELS[status]}
    </Tag>
  );
}

const EXPENSE_STATUS_STYLES: Record<ExpenseStatus, string> = {
  pending: "bg-brand-orange/10 text-brand-orange",
  approved: "bg-brand-green/10 text-brand-green",
  rejected: "bg-red-50 text-red-700",
};

const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function ExpenseStatusTag({ status }: { status: ExpenseStatus }) {
  return (
    <Tag className={EXPENSE_STATUS_STYLES[status]}>
      {EXPENSE_STATUS_LABELS[status]}
    </Tag>
  );
}

const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  active: "bg-brand-green/10 text-brand-green",
  on_hold: "bg-brand-orange/10 text-brand-orange",
  completed: "bg-brand-blueWater text-brand-darkBlue/70",
  deactivated: "bg-brand-darkBlue/10 text-brand-darkBlue/50",
};

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  deactivated: "Deactivated",
};

export function ProjectStatusTag({ status }: { status: ProjectStatus }) {
  return (
    <Tag className={PROJECT_STATUS_STYLES[status]}>
      {PROJECT_STATUS_LABELS[status]}
    </Tag>
  );
}

/** Marks a TimeClockEvent as having been created via an approved manual "missed day" request, rather than a live clock-in/out — shown wherever admins view time clock data so the two are never confused. */
export function ManuallyLoggedTag() {
  return (
    <Tag className="bg-brand-blueWater text-brand-darkBlue/70">
      Manually logged
    </Tag>
  );
}
