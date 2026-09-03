import { HOURS_PRESETS } from "@/lib/domain/hours-input";
import { displayTaskTitle } from "@/lib/domain/tasks";
import type { Office, Project, Task } from "@/lib/types";

export interface TaskEntryFieldValues {
  projectId: string;
  office: string;
  taskId: string;
  hours: string;
  note: string;
  location: string;
}

/**
 * The fields shared by both the "Log a task entry" create form and the
 * entry edit form — project/office/task/hours/note, with office and task
 * cascading off the selected project. Not a `<form>` itself so callers can
 * wrap it with whatever else they need (date, booking, mark-complete).
 */
export function TaskEntryFields({
  projects,
  offices,
  tasks,
  value,
  onChange,
  disabled,
  hideProject,
}: {
  projects: Project[];
  offices: Office[];
  tasks: Task[];
  value: TaskEntryFieldValues;
  onChange: (patch: Partial<TaskEntryFieldValues>) => void;
  disabled?: boolean;
  /** Omits the Project select — for contexts (like a per-row quick-add popover) where the project is already fixed by the caller. */
  hideProject?: boolean;
}) {
  const officesForSelectedProject = offices.filter(
    (o) => o.projectId === value.projectId
  );
  const tasksForSelectedProject = tasks.filter(
    (t) => t.projectId === value.projectId
  );
  const selectedProject = projects.find((p) => p.id === value.projectId);
  const requiresLocation = selectedProject?.productLine !== "internal_admin" && Boolean(selectedProject);

  return (
    <>
      {!hideProject && (
        <label className="block">
          <span className="block text-sm font-medium text-brand-darkBlue/80">
            Project
          </span>
          <select
            required
            disabled={disabled}
            value={value.projectId}
            onChange={(e) =>
              onChange({ projectId: e.target.value, office: "", taskId: "", location: "" })
            }
            className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-brand-blueWater/50 disabled:text-brand-darkBlue/40"
          >
            <option value="">Select a project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">Office</span>
        <select
          required
          disabled={disabled || !value.projectId}
          value={value.office}
          onChange={(e) => onChange({ office: e.target.value })}
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-brand-blueWater/50 disabled:text-brand-darkBlue/40"
        >
          <option value="">
            {value.projectId ? "Select an office" : "Select a project first"}
          </option>
          {officesForSelectedProject.map((o) => (
            <option key={o.id} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">Task</span>
        <select
          required
          disabled={
            disabled || !value.projectId || tasksForSelectedProject.length === 0
          }
          value={value.taskId}
          onChange={(e) => onChange({ taskId: e.target.value })}
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-brand-blueWater/50 disabled:text-brand-darkBlue/40"
        >
          <option value="">
            {!value.projectId ? "Select a project first" : "Select a task"}
          </option>
          {tasksForSelectedProject.map((t) => (
            <option key={t.id} value={t.id}>
              {displayTaskTitle(t)}
            </option>
          ))}
        </select>
        {value.projectId && tasksForSelectedProject.length === 0 && (
          <p className="mt-1 text-xs text-brand-darkBlue/60">
            No tasks defined for this project yet — add one from the Projects
            tab first.
          </p>
        )}
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-brand-darkBlue/80">Hours</span>
        <input
          type="text"
          inputMode="text"
          required
          disabled={disabled}
          value={value.hours}
          onChange={(e) => onChange({ hours: e.target.value })}
          placeholder="e.g. 2h, 45m, 1h 30m, or 2.5"
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-brand-blueWater/50 disabled:text-brand-darkBlue/40"
        />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {HOURS_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ hours: preset })}
              className="rounded-full border border-brand-darkBlue/20 px-2.5 py-0.5 text-xs text-brand-darkBlue/70 hover:bg-brand-blueWater disabled:opacity-50"
            >
              {preset}
            </button>
          ))}
        </div>
      </label>

      <label className="block sm:col-span-2">
        <span className="block text-sm font-medium text-brand-darkBlue/80">Note</span>
        <textarea
          required
          rows={3}
          disabled={disabled}
          value={value.note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="What did you work on for this task today?"
          className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-brand-blueWater/50 disabled:text-brand-darkBlue/40"
        />
      </label>

      {requiresLocation && (
        <label className="block sm:col-span-2">
          <span className="block text-sm font-medium text-brand-darkBlue/80">
            Location
          </span>
          <input
            type="text"
            required
            disabled={disabled}
            value={value.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="e.g. OID 12345, East Side Dental, all locations"
            className="mt-1 block w-full rounded-md border border-brand-darkBlue/20 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-brand-blueWater/50 disabled:text-brand-darkBlue/40"
          />
          <p className="mt-1 text-xs text-brand-darkBlue/50">
            Required for billing. Use OIDs for Denticon, location names for Cloud 9, or describe multiple locations.
          </p>
        </label>
      )}
    </>
  );
}
