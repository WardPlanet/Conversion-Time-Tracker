import type { Notification } from "@/lib/types";

export function countUnread(notifications: Notification[]): number {
  return notifications.filter((n) => !n.read).length;
}

/**
 * Where clicking a notification should navigate — each type's own
 * admin-side home for that kind of event. Falls back to Scheduling (the
 * cancellation request queue) for anything not explicitly one of the
 * other types.
 */
export function notificationHref(notification: Notification): string {
  if (notification.type === "flag") {
    return notification.relatedTrainerId
      ? `/admin/trainers/${notification.relatedTrainerId}/flags`
      : "/admin";
  }
  if (notification.type === "submission") {
    return notification.relatedTrainerId
      ? `/admin/trainers/${notification.relatedTrainerId}/task-log`
      : "/admin/submissions";
  }
  if (notification.type === "timesheet_submission") {
    return notification.relatedTrainerId
      ? `/admin/trainers/${notification.relatedTrainerId}/timesheet`
      : "/admin/submissions";
  }
  if (
    notification.type === "clock_correction" ||
    notification.type === "manual_session"
  ) {
    return "/admin/submissions";
  }
  if (notification.type === "expense_submitted") {
    return "/admin/submissions";
  }
  return "/admin/scheduling";
}

/**
 * Where clicking a trainer's own notification should navigate — each
 * type's trainer-side home for that kind of decision. Falls back to the
 * trainer Dashboard for anything not explicitly one of the other types.
 */
export function trainerNotificationHref(notification: Notification): string {
  if (
    notification.type === "booking_created" ||
    notification.type === "cancellation_decision" ||
    notification.type === "booking_cancelled" ||
    notification.type === "booking_rescheduled"
  ) {
    return "/trainer/calendar";
  }
  if (notification.type === "submission_decision") {
    return "/trainer/task-tracker";
  }
  if (
    notification.type === "timesheet_submission_decision" ||
    notification.type === "clock_correction_decision" ||
    notification.type === "manual_session_decision"
  ) {
    return "/trainer/time-clock";
  }
  if (notification.type === "expense_decision") {
    return "/trainer/expenses";
  }
  return "/trainer";
}
