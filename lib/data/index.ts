import { MockDataStore } from "@/lib/data/mock-store";
import { PostgresDataStore } from "@/lib/data/postgres-store";
import type { DataStore } from "@/lib/data/store";

/**
 * Single entry point for all data access. Every other module must import
 * `store` (and the shared contract types) from here — never from
 * `mock-store.ts` or `postgres-store.ts` directly.
 */
const globalForStore = globalThis as unknown as { store?: DataStore };

function createStore(): DataStore {
  if (process.env.POSTGRES_URL) {
    return new PostgresDataStore();
  }
  return new MockDataStore();
}

export const store: DataStore = globalForStore.store ?? createStore();

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
