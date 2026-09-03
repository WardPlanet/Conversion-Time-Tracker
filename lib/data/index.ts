import { MockDataStore } from "@/lib/data/mock-store";
import type { DataStore } from "@/lib/data/store";

/**
 * Single entry point for all data access. Every other module must import
 * `store` (and the shared contract types) from here — never from
 * `mock-store.ts` directly. Swapping in a real database later means
 * changing only this file's `store` instantiation.
 */
const globalForStore = globalThis as unknown as { store?: DataStore };

export const store: DataStore = globalForStore.store ?? new MockDataStore();

if (process.env.NODE_ENV !== "production") {
  globalForStore.store = store;
}

export type {
  DataStore,
  Actor,
  CreateTrainerInput,
  CreateTaskInput,
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
} from "@/lib/data/store";
export {
  ForbiddenError,
  isForbiddenError,
  BookingConflictError,
  isBookingConflictError,
} from "@/lib/data/store";
