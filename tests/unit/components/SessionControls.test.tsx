import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionControls } from "@/components/SessionControls";
import { getSupabaseBrowserClient, isBrowserSupabaseConfigured, syncSessionCookie } from "@/lib/auth/client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth/client", () => ({
  getSupabaseBrowserClient: vi.fn(),
  isBrowserSupabaseConfigured: vi.fn(),
  syncSessionCookie: vi.fn(),
}));

describe("SessionControls", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when Supabase is not configured", () => {
    (isBrowserSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { container } = render(<SessionControls />);
    expect(container.firstChild).toBeNull();
  });

  it("allows requesting a magic link when Supabase is configured", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const supabaseClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signInWithOtp,
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
      },
    };

    (isBrowserSupabaseConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getSupabaseBrowserClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(supabaseClient);

    render(<SessionControls />);

    await waitFor(() => expect(screen.getByText(/offline/i)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("name@studio.com"), {
      target: { value: "demo@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /email me access/i }));

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "demo@example.com",
      options: { emailRedirectTo: expect.stringContaining("/auth/callback") },
    });
    expect(syncSessionCookie).toHaveBeenCalled();
  });
});
