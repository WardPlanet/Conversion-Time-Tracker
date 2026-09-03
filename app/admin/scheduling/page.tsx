"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import type {
  Booking,
  Office,
  Project,
  PublicUser,
  UnavailabilityBlock,
} from "@/lib/types";
import {
  BillableTag,
  BookingStatusTag,
  LocationTag,
  ProjectDot,
} from "@/components/trainer/badges";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { CalendarNav } from "@/components/calendar/CalendarNav";
import { BookingChip } from "@/components/calendar/BookingChip";
import { UnavailabilityChip } from "@/components/calendar/UnavailabilityChip";
import {
  WeekTimeGrid,
  type WeekAllDayItem,
  type WeekTimedItem,
} from "@/components/calendar/WeekTimeGrid";
import { WeekBookingBlock } from "@/components/calendar/WeekBookingBlock";
import {
  getHourRangeForBookings,
  getMonthGridWeeks,
  getWeekGridWeeks,
  groupByLocalDate,
} from "@/lib/domain/calendar-grid";
import { Modal } from "@/components/Modal";
import { BookTrainerForm } from "@/components/admin/BookTrainerForm";
import { CancellationRequestsSection } from "@/components/admin/CancellationRequestsSection";
import { CancelBookingModal } from "@/components/admin/CancelBookingModal";
import {
  RescheduleBookingForm,
  type RescheduleUpdates,
} from "@/components/admin/RescheduleBookingForm";
import {
  formatDateRange,
  formatFullDate,
  parseLocalDateString,
  toLocalDateString,
} from "@/lib/format";
import {
  blocksForDate,
  formatHHMM,
  isFullDayBlock,
} from "@/lib/domain/unavailability";

type EnrichedBooking = Booking & {
  project: Project | null;
  trainer: PublicUser | null;
  office: Office | null;
};

type DayItem =
  | { kind: "booking"; key: string; booking: EnrichedBooking }
  | {
      kind: "unavailability";
      key: string;
      block: UnavailabilityBlock;
      dateStr: string;
    };

const MAX_CHIPS_PER_DAY = 3;

export default function AdminSchedulingPage() {
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [trainers, setTrainers] = useState<PublicUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [unavailabilityBlocks, setUnavailabilityBlocks] = useState<
    UnavailabilityBlock[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [visibleTrainerIds, setVisibleTrainerIds] = useState<Set<string> | null>(
    null
  );
  const [selectedBooking, setSelectedBooking] = useState<EnrichedBooking | null>(
    null
  );
  const [selectedUnavailability, setSelectedUnavailability] = useState<{
    block: UnavailabilityBlock;
    dateStr: string;
  } | null>(null);
  const [cancelTargetBooking, setCancelTargetBooking] =
    useState<EnrichedBooking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [rescheduleTargetBooking, setRescheduleTargetBooking] =
    useState<EnrichedBooking | null>(null);
  const [reschedulingBooking, setReschedulingBooking] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<Date | null>(null);
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [bookingFormDate, setBookingFormDate] = useState<string | undefined>(
    undefined
  );

  const today = useMemo(() => new Date(), []);

  async function load() {
    setLoading(true);
    const [bookingsResponse, unavailabilityResponse] = await Promise.all([
      fetch("/api/admin/bookings"),
      fetch("/api/admin/unavailability"),
    ]);
    const data = await bookingsResponse.json();
    const unavailabilityData = await unavailabilityResponse.json();
    setBookings(data.bookings ?? []);
    setTrainers(data.trainers ?? []);
    setProjects(data.projects ?? []);
    setOffices(data.offices ?? []);
    setUnavailabilityBlocks(unavailabilityData.blocks ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function isVisible(trainerId: string): boolean {
    return visibleTrainerIds === null || visibleTrainerIds.has(trainerId);
  }

  function toggleTrainer(trainerId: string) {
    setVisibleTrainerIds((prev) => {
      const current = prev ?? new Set(trainers.map((t) => t.id));
      const next = new Set(current);
      if (next.has(trainerId)) next.delete(trainerId);
      else next.add(trainerId);
      return next;
    });
  }

  const visibleBookings = bookings.filter((b) => isVisible(b.trainerId));
  const visibleUnavailabilityBlocks = unavailabilityBlocks.filter((b) =>
    isVisible(b.trainerId)
  );
  const weeks = viewMode === "month" ? getMonthGridWeeks(cursor) : [];
  const timeGridDays =
    viewMode === "day"
      ? [cursor]
      : viewMode === "week"
        ? getWeekGridWeeks(cursor)[0]
        : [];
  const bookingsByDay = useMemo(
    () => groupByLocalDate(visibleBookings, (b) => new Date(b.startTime)),
    [visibleBookings]
  );
  // Widens past the 7am–7pm default only if real data falls outside it, and
  // ignores cancelled bookings so a stray old outlier can't skew the grid.
  const hourRange = useMemo(
    () =>
      getHourRangeForBookings(bookings.filter((b) => b.status !== "cancelled")),
    [bookings]
  );
  function trainerNameFor(trainerId: string): string {
    return trainers.find((t) => t.id === trainerId)?.name ?? "Trainer";
  }

  /** Bookings and unavailability blocks for a day, combined into one ordered
   * list so they share the same chip stack and "+N more" overflow. */
  function getDayItems(day: Date): DayItem[] {
    const dateStr = toLocalDateString(day);
    const dayBookings = bookingsByDay.get(dateStr) ?? [];
    const dayBlocks = blocksForDate(visibleUnavailabilityBlocks, dateStr);
    return [
      ...dayBookings.map(
        (booking): DayItem => ({
          kind: "booking",
          key: `booking-${booking.id}`,
          booking,
        })
      ),
      ...dayBlocks.map(
        (block): DayItem => ({
          kind: "unavailability",
          key: `unavailability-${block.id}-${dateStr}`,
          block,
          dateStr,
        })
      ),
    ];
  }

  function goPrev() {
    setCursor((c) =>
      viewMode === "month"
        ? subMonths(c, 1)
        : viewMode === "week"
          ? subWeeks(c, 1)
          : subDays(c, 1)
    );
  }
  function goNext() {
    setCursor((c) =>
      viewMode === "month"
        ? addMonths(c, 1)
        : viewMode === "week"
          ? addWeeks(c, 1)
          : addDays(c, 1)
    );
  }
  function goToday() {
    setCursor(new Date());
  }

  /** Jumps to Day view for a specific date — the Month grid's day-cell click and the Week grid's day-header click both funnel through this. */
  function goToDay(day: Date) {
    setCursor(day);
    setViewMode("day");
  }

  /** Full-day unavailability blocks render as chips in the week grid's "All day" row instead of being time-positioned. */
  function getWeekAllDayItems(day: Date): WeekAllDayItem[] {
    const dateStr = toLocalDateString(day);
    return blocksForDate(visibleUnavailabilityBlocks, dateStr)
      .filter(isFullDayBlock)
      .map((block) => ({
        key: `unavailability-${block.id}-${dateStr}`,
        render: () => (
          <UnavailabilityChip
            block={block}
            trainerName={trainerNameFor(block.trainerId)}
            onClick={() => setSelectedUnavailability({ block, dateStr })}
          />
        ),
      }));
  }

  /** Bookings and timed (non-full-day) unavailability blocks for a day, positioned in the week grid by actual start/end time. */
  function getWeekTimedItems(day: Date): WeekTimedItem[] {
    const dateStr = toLocalDateString(day);
    const dayBookings = bookingsByDay.get(dateStr) ?? [];
    const timedBlocks = blocksForDate(visibleUnavailabilityBlocks, dateStr).filter(
      (block) => !isFullDayBlock(block)
    );
    return [
      ...dayBookings.map(
        (booking): WeekTimedItem => ({
          id: `booking-${booking.id}`,
          start: new Date(booking.startTime),
          end: new Date(booking.endTime),
          render: () => (
            <WeekBookingBlock
              booking={booking}
              project={booking.project}
              trainerName={booking.trainer?.name}
              onClick={() => setSelectedBooking(booking)}
            />
          ),
        })
      ),
      ...timedBlocks.map(
        (block): WeekTimedItem => ({
          id: `unavailability-${block.id}-${dateStr}`,
          start: new Date(`${dateStr}T${block.startTime}`),
          end: new Date(`${dateStr}T${block.endTime}`),
          render: () => (
            <UnavailabilityChip
              block={block}
              trainerName={trainerNameFor(block.trainerId)}
              onClick={() => setSelectedUnavailability({ block, dateStr })}
            />
          ),
        })
      ),
    ];
  }

  function openBookingForm(date?: Date) {
    setBookingFormDate(date ? toLocalDateString(date) : undefined);
    setBookingFormOpen(true);
  }

  async function submitAdminCancellation(bookingId: string, reason: string) {
    setCancellingBooking(true);
    setCancelError(null);
    try {
      const response = await fetch(
        `/api/admin/bookings/${bookingId}/cancel`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason || undefined }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setCancelError(data.error ?? "Failed to cancel booking.");
        return;
      }

      setCancelTargetBooking(null);
      load();
    } finally {
      setCancellingBooking(false);
    }
  }

  async function submitReschedule(
    bookingId: string,
    updates: RescheduleUpdates
  ) {
    setReschedulingBooking(true);
    setRescheduleError(null);
    try {
      const response = await fetch(
        `/api/admin/bookings/${bookingId}/reschedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startTime: updates.startTime,
            endTime: updates.endTime,
            location: updates.location,
            billable: updates.billable,
            reason: updates.reason || undefined,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setRescheduleError(data.error ?? "Failed to reschedule booking.");
        return;
      }

      setRescheduleTargetBooking(null);
      load();
    } finally {
      setReschedulingBooking(false);
    }
  }

  const visibleCount =
    visibleTrainerIds === null ? trainers.length : visibleTrainerIds.size;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Scheduling</h1>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        Every trainer&apos;s bookings — click one to edit its time, location, or
        billable status.
      </p>

      <CancellationRequestsSection bookings={bookings} onDecided={load} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <CalendarNav
          label={
            viewMode === "month"
              ? format(cursor, "MMMM yyyy")
              : viewMode === "week"
                ? `Week of ${format(timeGridDays[0], "MMM d, yyyy")}`
                : formatFullDate(cursor)
          }
          onPrev={goPrev}
          onNext={goNext}
          onToday={goToday}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showDayOption
        />

        <div className="flex items-center gap-3">
        <button
          onClick={() => openBookingForm(viewMode === "day" ? cursor : undefined)}
          className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue"
        >
          Book Trainer
        </button>
        <details className="relative">
          <summary className="list-none cursor-pointer rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm hover:bg-brand-blueWater">
            Filter trainers ({visibleCount}/{trainers.length})
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-56 rounded-md border border-brand-darkBlue/10 bg-white p-3 shadow-lg">
            <button
              onClick={() => setVisibleTrainerIds(null)}
              className="mb-2 text-xs text-brand-darkBlue/60 hover:text-brand-darkBlue"
            >
              Show all
            </button>
            <div className="space-y-1">
              {trainers.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isVisible(t.id)}
                    onChange={() => toggleTrainer(t.id)}
                    className="h-4 w-4 rounded border-brand-darkBlue/20"
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </div>
        </details>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-brand-darkBlue/60">Loading…</p>
        ) : viewMode === "week" || viewMode === "day" ? (
          <WeekTimeGrid
            days={timeGridDays}
            today={today}
            hourStart={hourRange.startHour}
            hourEnd={hourRange.endHour}
            getAllDayItems={getWeekAllDayItems}
            getTimedItems={getWeekTimedItems}
            onHeaderClick={viewMode === "week" ? goToDay : undefined}
          />
        ) : (
          <CalendarGrid
            weeks={weeks}
            referenceMonth={cursor}
            today={today}
            onDayClick={goToDay}
            renderDayContent={(day) => {
              const items = getDayItems(day);
              const visible = items.slice(0, MAX_CHIPS_PER_DAY);
              const overflow = items.length - visible.length;
              return (
                <>
                  {visible.map((item) =>
                    item.kind === "booking" ? (
                      <BookingChip
                        key={item.key}
                        booking={item.booking}
                        project={item.booking.project}
                        office={item.booking.office}
                        label={item.booking.trainer?.name}
                        onClick={() => setSelectedBooking(item.booking)}
                      />
                    ) : (
                      <UnavailabilityChip
                        key={item.key}
                        block={item.block}
                        trainerName={trainerNameFor(item.block.trainerId)}
                        onClick={() =>
                          setSelectedUnavailability({
                            block: item.block,
                            dateStr: item.dateStr,
                          })
                        }
                      />
                    )
                  )}
                  {overflow > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedDay(day);
                      }}
                      className="w-full rounded px-1.5 py-0.5 text-left text-[11px] text-brand-darkBlue/60 hover:bg-brand-blueWater"
                    >
                      +{overflow} more
                    </button>
                  )}
                </>
              );
            }}
          />
        )}
      </div>

      <Modal
        open={expandedDay !== null}
        onClose={() => setExpandedDay(null)}
        title={expandedDay ? format(expandedDay, "MMMM d, yyyy") : ""}
      >
        <div className="space-y-1">
          {(expandedDay ? getDayItems(expandedDay) : []).map((item) =>
            item.kind === "booking" ? (
              <BookingChip
                key={item.key}
                booking={item.booking}
                project={item.booking.project}
                office={item.booking.office}
                label={item.booking.trainer?.name}
                onClick={() => {
                  setSelectedBooking(item.booking);
                  setExpandedDay(null);
                }}
              />
            ) : (
              <UnavailabilityChip
                key={item.key}
                block={item.block}
                trainerName={trainerNameFor(item.block.trainerId)}
                onClick={() => {
                  setSelectedUnavailability({
                    block: item.block,
                    dateStr: item.dateStr,
                  });
                  setExpandedDay(null);
                }}
              />
            )
          )}
        </div>
      </Modal>

      <Modal
        open={selectedUnavailability !== null}
        onClose={() => setSelectedUnavailability(null)}
        title="Unavailable"
      >
        {selectedUnavailability && (
          <div>
            <p className="text-sm font-medium text-brand-darkBlue">
              {trainerNameFor(selectedUnavailability.block.trainerId)}
            </p>
            <p className="mt-1 text-sm text-brand-darkBlue/60">
              {formatFullDate(
                parseLocalDateString(selectedUnavailability.dateStr)
              )}
            </p>
            <p className="mt-1 text-sm text-brand-darkBlue/60">
              {isFullDayBlock(selectedUnavailability.block)
                ? "All day"
                : `${formatHHMM(
                    selectedUnavailability.block.startTime!
                  )} – ${formatHHMM(selectedUnavailability.block.endTime!)}`}
            </p>
            {selectedUnavailability.block.reason && (
              <p className="mt-3 text-sm text-brand-darkBlue/70">
                “{selectedUnavailability.block.reason}”
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={selectedBooking !== null}
        onClose={() => setSelectedBooking(null)}
        title={selectedBooking?.title ?? ""}
      >
        {selectedBooking && (
          <BookingEditor
            booking={selectedBooking}
            onSaved={() => {
              setSelectedBooking(null);
              load();
            }}
            onRequestCancel={() => {
              setSelectedBooking(null);
              setCancelTargetBooking(selectedBooking);
            }}
            onRequestReschedule={() => {
              setSelectedBooking(null);
              setRescheduleTargetBooking(selectedBooking);
            }}
          />
        )}
      </Modal>

      <CancelBookingModal
        open={cancelTargetBooking !== null}
        onClose={() => {
          setCancelTargetBooking(null);
          setCancelError(null);
        }}
        submitting={cancellingBooking}
        error={cancelError}
        onConfirm={(reason) => {
          if (cancelTargetBooking) {
            submitAdminCancellation(cancelTargetBooking.id, reason);
          }
        }}
      />

      <Modal
        open={rescheduleTargetBooking !== null}
        onClose={() => {
          setRescheduleTargetBooking(null);
          setRescheduleError(null);
        }}
        title="Reschedule booking"
      >
        {rescheduleTargetBooking && (
          <RescheduleBookingForm
            booking={rescheduleTargetBooking}
            submitting={reschedulingBooking}
            error={rescheduleError}
            onCancel={() => {
              setRescheduleTargetBooking(null);
              setRescheduleError(null);
            }}
            onSubmit={(updates) =>
              submitReschedule(rescheduleTargetBooking.id, updates)
            }
          />
        )}
      </Modal>

      <Modal
        open={bookingFormOpen}
        onClose={() => setBookingFormOpen(false)}
        title="Book a trainer"
      >
        <BookTrainerForm
          trainers={trainers}
          projects={projects}
          offices={offices}
          unavailabilityBlocks={unavailabilityBlocks}
          defaultDate={bookingFormDate}
          onCreated={() => {
            setBookingFormOpen(false);
            load();
          }}
        />
      </Modal>
    </div>
  );
}

function BookingEditor({
  booking,
  onSaved,
  onRequestCancel,
  onRequestReschedule,
}: {
  booking: EnrichedBooking;
  onSaved: () => void;
  onRequestCancel: () => void;
  onRequestReschedule: () => void;
}) {
  const [cancellationError, setCancellationError] = useState<string | null>(
    null
  );
  const [decidingCancellation, setDecidingCancellation] = useState(false);

  async function decideCancellation(action: "approve" | "deny") {
    setDecidingCancellation(true);
    setCancellationError(null);
    try {
      const response = await fetch(
        `/api/admin/bookings/${booking.id}/cancellation`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setCancellationError(data.error ?? "Failed to update booking.");
        return;
      }

      onSaved();
    } finally {
      setDecidingCancellation(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {booking.project && <ProjectDot color={booking.project.color} />}
        <span className="text-sm text-brand-darkBlue/70">
          {booking.project?.name ?? "Unknown project"}
        </span>
      </div>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        {booking.office?.name ?? "Unknown office"}
      </p>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        {booking.trainer?.name ?? "Unknown trainer"}
      </p>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        {formatDateRange(booking.startTime, booking.endTime)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <LocationTag location={booking.location} />
        <BillableTag billable={booking.billable} />
        <BookingStatusTag status={booking.status} />
      </div>

      {booking.status !== "cancelled" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onRequestReschedule}
            className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm font-medium text-brand-darkBlue hover:bg-brand-blueWater"
          >
            Reschedule
          </button>
          <button
            type="button"
            onClick={onRequestCancel}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Cancel booking
          </button>
        </div>
      )}

      {booking.status === "cancellation_requested" && (
        <div className="mt-3 rounded-md border border-brand-orange/30 bg-brand-orange/10 p-3">
          {booking.cancellationReason && (
            <p className="text-sm text-brand-darkBlue/70">
              “{booking.cancellationReason}”
            </p>
          )}
          {cancellationError && (
            <p className="mt-2 text-sm text-red-600">{cancellationError}</p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => decideCancellation("approve")}
              disabled={decidingCancellation}
              className="rounded-md bg-brand-green px-3 py-1 text-sm font-medium text-white hover:bg-brand-green/90 disabled:opacity-50"
            >
              Approve cancellation
            </button>
            <button
              type="button"
              onClick={() => decideCancellation("deny")}
              disabled={decidingCancellation}
              className="rounded-md border border-brand-darkBlue/20 px-3 py-1 text-sm hover:bg-brand-blueWater disabled:opacity-50"
            >
              Deny
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
