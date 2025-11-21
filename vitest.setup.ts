import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

const defaultAuth = {
  getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
};

const defaultClient = {
  auth: defaultAuth,
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => defaultClient),
}));
