"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, addWeeks, format, subMonths, subWeeks } from "date-fns";
import { AlertTriangle } from "lucide-react";
import type {
  Booking,
  BookingStatus,
  Office,
  Project,
  UnavailabilityBlock,
} from "@/lib/types";
import {
  BillableTag,
  BookingStatusTag,
  LocationTag,
  OfficeTag,
  ProjectDot,
} from "@/components/trainer/badges";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { CalendarNav } from "@/components/calendar/CalendarNav";
import { BookingChip } from "@/components/calendar/BookingChip";
import { UnavailabilityChip } from "@/components/calendar/UnavailabilityChip";
import {
  getMonthGridWeeks,
  getWeekGridWeeks,
  groupByLocalDate,
} from "@/lib/domain/calendar-grid";
import { Modal } from "@/components/Modal";
import {
  formatDateRange,
  formatFullDate,
  parseLocalDateString,
  toLocalDateString,
} from "@/lib/format";
import {
  requestBookingCancellation,
  respondToBooking,
} from "@/lib/domain/booking-actions";
import {
  isWithinUndoWindow,
  selectPendingBookings,
  selectRecentRejectedBookings,
} from "@/lib/domain/trainer-stats";
import { useToast } from "@/components/ToastProvider";
import { RejectReasonModal } from "@/components/trainer/RejectReasonModal";
import { RequestCancellationModal } from "@/components/trainer/RequestCancellationModal";
import { AvailabilityManager } from "@/components/trainer/AvailabilityManager";
import { blocksForDate, formatHHMM, isFullDayBlock } from "@/lib/domain/unavailability";

type EnrichedBooking = Booking & { project: Project | null; office: Office | null };

type RespondableStatus = Extract<BookingStatus, "accepted" | "rejected" | "pending">;

type DayItem =
  | { kind: "booking"; key: string; booking: EnrichedBooking }
  | {
      kind: "unavailability";
      key: string;
      block: UnavailabilityBlock;
      dateStr: string;
    };

const MAX_CHIPS_PER_DAY = 3;

/**
 * One row in the sidebar list — same accept/reject action as the grid's
 * modal (`onAccept`/`onRejectRequest`), just triggered from here instead of
 * duplicating the logic. Clicking the row (not the buttons) scrolls/
 * highlights its day in the grid via `onSelectDay`.
 */
function BookingListItem({
  booking,
  onAccept,
  onRejectRequest,
  onCancellationRequest,
  onSelectDay,
  pendingAction,
}: {
  booking: EnrichedBooking;
  onAccept: (bookingId: string) => void;
  onRejectRequest: (bookingId: string) => void;
  onCancellationRequest: (bookingId: string) => void;
  onSelectDay: (day: Date) => void;
  pendingAction: boolean;
}) {
  return (
    <div
      onClick={() => onSelectDay(new Date(booking.startTime))}
      className="cursor-pointer rounded-md border border-brand-darkBlue/10 p-2 text-xs hover:border-brand-darkBlue/20 hover:bg-brand-blueWater"
    >
      <p className="font-medium text-brand-darkBlue/80">
        {formatDateRange(booking.startTime, booking.endTime)}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        {booking.project && <ProjectDot color={booking.project.color} />}
        <span className="truncate text-brand-darkBlue/70">
          {booking.project?.name ?? "Unknown project"}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="truncate font-medium text-brand-darkBlue">
          {booking.title}
        </p>
        {booking.status === "accepted" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancellationRequest(booking.id);
            }}
            disabled={pendingAction}
            title="Request cancellation"
            aria-label="Request cancellation"
            className="shrink-0 text-brand-orange hover:text-brand-orange/70 disabled:opacity-50"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <LocationTag location={booking.location} />
        {booking.office && <OfficeTag office={booking.office.name} />}
        <BillableTag billable={booking.billable} />
        <BookingStatusTag status={booking.status} />
      </div>
      {booking.status === "pending" && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAccept(booking.id);
            }}
            disabled={pendingAction}
            className="rounded-md bg-brand-blue px-2 py-1 text-xs font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRejectRequest(booking.id);
            }}
            disabled={pendingAction}
            className="rounded-md border border-brand-darkBlue/20 px-2 py-1 text-xs hover:bg-brand-blueWater disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default function TrainerCalendarPage() {
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [unavailabilityBlocks, setUnavailabilityBlocks] = useState<
    UnavailabilityBlock[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedBooking, setSelectedBooking] =
    useState<EnrichedBooking | null>(null);
  const [selectedUnavailability, setSelectedUnavailability] = useState<{
    block: UnavailabilityBlock;
    dateStr: string;
  } | null>(null);
  const [expandedDay, setExpandedDay] = useState<Date | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const { showToast } = useToast();

  const today = useMemo(() => new Date(), []);

  async function loadBookings() {
    setLoading(true);
    const response = await fetch("/api/trainer/bookings");
    const data = await response.json();
    setBookings(data.bookings ?? []);
    setLoading(false);
  }

  async function loadUnavailability() {
    const response = await fetch("/api/trainer/unavailability");
    const data = await response.json();
    setUnavailabilityBlocks(data.blocks ?? []);
  }

  useEffect(() => {
    loadBookings();
    loadUnavailability();
  }, []);

  const weeks =
    viewMode === "month" ? getMonthGridWeeks(cursor) : getWeekGridWeeks(cursor);
  // A cancelled booking's slot is freed, and — unlike a rejected one — it
  // drops off the active calendar entirely (it's still in the fetched data
  // for record-keeping, just not rendered on the grid/sidebar here).
  const activeBookings = useMemo(
    () => bookings.filter((b) => b.status !== "cancelled"),
    [bookings]
  );
  const bookingsByDay = useMemo(
    () => groupByLocalDate(activeBookings, (b) => new Date(b.startTime)),
    [activeBookings]
  );

  // Whichever days are actually on screen right now (the grid always pads
  // out to full weeks, so this can include a few adjacent-month days too).
  const visibleDates = useMemo(
    () => new Set(weeks.flat().map((d) => toLocalDateString(d))),
    [weeks]
  );
  const sidebarBookings = useMemo(
    () =>
      activeBookings
        .filter((b) =>
          visibleDates.has(toLocalDateString(new Date(b.startTime)))
        )
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [activeBookings, visibleDates]
  );
  const rejectedBookings = useMemo(
    () => selectRecentRejectedBookings(bookings, new Date(), 30),
    [bookings]
  );
  // Every pending booking regardless of month/view — unlike the Dashboard's
  // single-booking fast path, this page has room to list them all at once.
  const pendingBookings = useMemo(
    () => selectPendingBookings(bookings),
    [bookings]
  );

  /** Bookings and unavailability blocks for a day, combined into one ordered
   * list so they share the same chip stack and "+N more" overflow. */
  function getDayItems(day: Date): DayItem[] {
    const dateStr = toLocalDateString(day);
    const dayBookings = bookingsByDay.get(dateStr) ?? [];
    const dayBlocks = blocksForDate(unavailabilityBlocks, dateStr);
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

  function handleSidebarBookingClick(day: Date) {
    const dateStr = toLocalDateString(day);
    document
      .getElementById(`calendar-day-${dateStr}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedDate(dateStr);
    window.setTimeout(() => {
      setHighlightedDate((current) => (current === dateStr ? null : current));
    }, 1600);
  }

  function goPrev() {
    setCursor((c) => (viewMode === "month" ? subMonths(c, 1) : subWeeks(c, 1)));
  }
  function goNext() {
    setCursor((c) => (viewMode === "month" ? addMonths(c, 1) : addWeeks(c, 1)));
  }
  function goToday() {
    setCursor(new Date());
  }

  async function respond(
    bookingId: string,
    status: RespondableStatus,
    reason?: string
  ) {
    setActionError(null);
    setPendingAction(true);

    try {
      const result = await respondToBooking(bookingId, status, reason);
      if (result.error) {
        setActionError(result.error);
        return;
      }

      // Re-fetch from the DataStore rather than mutating local state, so the
      // grid always reflects what was actually persisted server-side.
      setSelectedBooking(null);
      await loadBookings();

      if (status === "accepted" || status === "rejected") {
        showToast({
          message: status === "accepted" ? "Booking accepted" : "Booking rejected",
          onUndo: () => respond(bookingId, "pending"),
        });
      }
    } finally {
      setPendingAction(false);
    }
  }

  function requestReject(bookingId: string) {
    setRejectTargetId(bookingId);
  }

  function requestCancellation(bookingId: string) {
    setCancelTargetId(bookingId);
  }

  async function submitCancellationRequest(bookingId: string, reason: string) {
    setActionError(null);
    setPendingAction(true);

    try {
      const result = await requestBookingCancellation(bookingId, reason);
      if (result.error) {
        setActionError(result.error);
        return;
      }

      setSelectedBooking(null);
      await loadBookings();
      showToast({ message: "Cancellation requested" });
    } finally {
      setPendingAction(false);
    }
  }

  const label =
    viewMode === "month"
      ? format(cursor, "MMMM yyyy")
      : `Week of ${format(getWeekGridWeeks(cursor)[0][0], "MMM d, yyyy")}`;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-blue">Calendar</h1>
      <p className="mt-1 text-sm text-brand-darkBlue/60">
        Your bookings — click one to accept or reject anything pending.
      </p>

      {pendingBookings.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Pending bookings</h2>
          {actionError && (
            <p className="mt-2 text-sm text-red-600">{actionError}</p>
          )}
          <ul className="mt-3 space-y-2">
            {pendingBookings.map((b) => (
              <li
                key={b.id}
                className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {b.project && <ProjectDot color={b.project.color} />}
                  <span className="text-sm font-medium text-brand-darkBlue">
                    {b.project?.name ?? "Unknown project"}
                  </span>
                  <span className="text-sm text-brand-darkBlue/60">
                    {formatDateRange(b.startTime, b.endTime)}
                  </span>
                  <LocationTag location={b.location} />
                  <BillableTag billable={b.billable} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => respond(b.id, "accepted")}
                    disabled={pendingAction}
                    className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => requestReject(b.id)}
                    disabled={pendingAction}
                    className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm hover:bg-brand-blueWater disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="min-w-[280px] flex-1">
          <CalendarNav
            label={label}
            onPrev={goPrev}
            onNext={goNext}
            onToday={goToday}
            viewMode={viewMode}
            onViewModeChange={(mode) => {
              if (mode !== "day") setViewMode(mode);
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => setAvailabilityModalOpen(true)}
          className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm font-medium text-brand-darkBlue hover:bg-brand-blueWater"
        >
          Manage availability
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex-1">
          {loading ? (
            <p className="text-sm text-brand-darkBlue/60">Loading…</p>
          ) : (
            <CalendarGrid
              weeks={weeks}
              referenceMonth={viewMode === "month" ? cursor : null}
              today={today}
              highlightedDate={highlightedDate}
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
                          onClick={() => setSelectedBooking(item.booking)}
                        />
                      ) : (
                        <UnavailabilityChip
                          key={item.key}
                          block={item.block}
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
                        onClick={() => setExpandedDay(day)}
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

        <aside className="w-full shrink-0 lg:w-80">
          <h2 className="text-sm font-medium text-brand-darkBlue/80">
            Bookings this {viewMode}
          </h2>
          {actionError && !selectedBooking && (
            <p className="mt-2 text-xs text-red-600">{actionError}</p>
          )}
          <div className="mt-2 max-h-[420px] space-y-2 overflow-y-auto rounded-md border border-brand-darkBlue/10 bg-brand-blueWater p-2 lg:max-h-[600px]">
            {loading ? (
              <p className="p-2 text-sm text-brand-darkBlue/60">Loading…</p>
            ) : sidebarBookings.length === 0 ? (
              <p className="p-2 text-sm text-brand-darkBlue/60">
                No bookings this {viewMode}.
              </p>
            ) : (
              sidebarBookings.map((b) => (
                <BookingListItem
                  key={b.id}
                  booking={b}
                  onAccept={(id) => respond(id, "accepted")}
                  onRejectRequest={requestReject}
                  onCancellationRequest={requestCancellation}
                  onSelectDay={handleSidebarBookingClick}
                  pendingAction={pendingAction}
                />
              ))
            )}
          </div>
        </aside>
      </div>

      {rejectedBookings.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Rejected bookings</h2>
          <p className="mt-1 text-sm text-brand-darkBlue/60">
            Rejections from the last 30 days, kept here for the record.
          </p>
          <ul className="mt-3 space-y-2">
            {rejectedBookings.map((b) => (
              <li
                key={b.id}
                className="rounded-md border border-brand-darkBlue/10 bg-white shadow-sm p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {b.project && <ProjectDot color={b.project.color} />}
                  <span className="text-sm font-medium text-brand-darkBlue">
                    {b.project?.name ?? "Unknown project"}
                  </span>
                  <span className="text-sm text-brand-darkBlue/60">
                    {formatDateRange(b.startTime, b.endTime)}
                  </span>
                </div>
                {b.rejectionReason && (
                  <p className="mt-2 text-sm text-brand-darkBlue/70">
                    “{b.rejectionReason}”
                  </p>
                )}
                {isWithinUndoWindow(b.statusChangedAt) && (
                  <button
                    onClick={() => respond(b.id, "pending")}
                    disabled={pendingAction}
                    className="mt-3 rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm hover:bg-brand-blueWater disabled:opacity-50"
                  >
                    Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
                onClick={() => {
                  setSelectedBooking(item.booking);
                  setExpandedDay(null);
                }}
              />
            ) : (
              <UnavailabilityChip
                key={item.key}
                block={item.block}
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
            <p className="text-sm text-brand-darkBlue/60">
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
          <div>
            <div className="flex items-center gap-2">
              {selectedBooking.project && (
                <ProjectDot color={selectedBooking.project.color} />
              )}
              <span className="text-sm text-brand-darkBlue/70">
                {selectedBooking.project?.name ?? "Unknown project"}
              </span>
            </div>
            <p className="mt-2 text-sm text-brand-darkBlue/60">
              {formatDateRange(
                selectedBooking.startTime,
                selectedBooking.endTime
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <LocationTag location={selectedBooking.location} />
              <BillableTag billable={selectedBooking.billable} />
              <BookingStatusTag status={selectedBooking.status} />
            </div>

            {selectedBooking.status === "cancellation_requested" &&
              selectedBooking.cancellationReason && (
                <p className="mt-3 rounded-md border border-brand-orange/30 bg-brand-orange/10 p-3 text-sm text-brand-orange">
                  Cancellation requested: “{selectedBooking.cancellationReason}
                  ” — awaiting admin review.
                </p>
              )}

            {actionError && (
              <p className="mt-3 text-sm text-red-600">{actionError}</p>
            )}

            {selectedBooking.status === "pending" && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => respond(selectedBooking.id, "accepted")}
                  disabled={pendingAction}
                  className="rounded-md bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-darkBlue disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  onClick={() => {
                    const id = selectedBooking.id;
                    setSelectedBooking(null);
                    requestReject(id);
                  }}
                  disabled={pendingAction}
                  className="rounded-md border border-brand-darkBlue/20 px-3 py-1.5 text-sm hover:bg-brand-blueWater disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}

            {selectedBooking.status === "accepted" && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    const id = selectedBooking.id;
                    setSelectedBooking(null);
                    requestCancellation(id);
                  }}
                  disabled={pendingAction}
                  className="flex items-center gap-1.5 rounded-md border border-brand-orange/30 px-3 py-1.5 text-sm font-medium text-brand-orange hover:bg-brand-orange/10 disabled:opacity-50"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Request cancellation
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <RejectReasonModal
        open={rejectTargetId !== null}
        onClose={() => setRejectTargetId(null)}
        submitting={pendingAction}
        onConfirm={(reason) => {
          const id = rejectTargetId;
          setRejectTargetId(null);
          if (id) respond(id, "rejected", reason);
        }}
      />

      <RequestCancellationModal
        open={cancelTargetId !== null}
        onClose={() => setCancelTargetId(null)}
        submitting={pendingAction}
        onConfirm={(reason) => {
          const id = cancelTargetId;
          setCancelTargetId(null);
          if (id) submitCancellationRequest(id, reason);
        }}
      />

      <Modal
        open={availabilityModalOpen}
        onClose={() => setAvailabilityModalOpen(false)}
        title="Availability"
      >
        <AvailabilityManager
          blocks={unavailabilityBlocks}
          onChanged={loadUnavailability}
        />
      </Modal>
    </div>
  );
}
