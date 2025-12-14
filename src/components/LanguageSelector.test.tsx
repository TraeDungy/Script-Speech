/**
 * Tests for LanguageSelector Component
 * F006: Multi-language support - Spanish
 * F007: Multi-language support - French
 */

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageIndicator, LanguageSelector } from "./LanguageSelector";

describe("LanguageSelector", () => {
  describe("Basic rendering", () => {
    it("should render with default props", () => {
      render(<LanguageSelector />);

      // Should show English (US) as default
      expect(screen.getByText(/English \(US\)/)).toBeInTheDocument();
    });

    it("should render with selected language", () => {
      render(<LanguageSelector value="es-ES" />);

      // Should show Spanish
      expect(screen.getByText(/Spanish \(Spain\)/)).toBeInTheDocument();
    });

    it("should render with custom className", () => {
      const { container } = render(<LanguageSelector className="custom-class" />);

      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });

    it("should render different sizes", () => {
      const { container: smallContainer } = render(<LanguageSelector size="small" />);
      expect(smallContainer.innerHTML).toContain("text-xs");

      const { container: mediumContainer } = render(<LanguageSelector size="medium" />);
      expect(mediumContainer.innerHTML).toContain("text-sm");

      const { container: largeContainer } = render(<LanguageSelector size="large" />);
      expect(largeContainer.innerHTML).toContain("text-base");
    });

    it("should show name only when showNameOnly is true", () => {
      const { container } = render(<LanguageSelector value="es-ES" showNameOnly />);

      // Should show only "Spanish (Spain)" without code
      const button = container.querySelector("button");
      expect(button?.textContent).toContain("Spanish (Spain)");
      expect(button?.textContent).not.toContain("es-ES");
    });
  });

  describe("Dropdown interaction", () => {
    it("should open dropdown on click", async () => {
      render(<LanguageSelector />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      // Should show all language options in listbox
      await waitFor(() => {
        const listbox = screen.getByRole("listbox");
        expect(within(listbox).getByText(/Spanish \(Spain\)/)).toBeInTheDocument();
        expect(within(listbox).getByText(/French/)).toBeInTheDocument();
        expect(within(listbox).getByText(/German/)).toBeInTheDocument();
      });
    });

    it("should close dropdown when clicking button again", async () => {
      render(<LanguageSelector />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });

      // Open
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Close
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("should close dropdown on blur", async () => {
      render(<LanguageSelector />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      fireEvent.blur(button);

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });
  });

  describe("Language selection", () => {
    it("should call onChange when selecting a language", async () => {
      const handleChange = vi.fn();
      render(<LanguageSelector value="en-US" onChange={handleChange} />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      // Click Spanish
      const options = screen.getAllByRole("option");
      const spanishOption = options.find((opt) => opt.textContent?.includes("Spanish (Spain)"));
      fireEvent.click(spanishOption!);

      expect(handleChange).toHaveBeenCalledWith("es-ES");
    });

    it("should handle keyboard navigation (Enter)", async () => {
      const handleChange = vi.fn();
      render(<LanguageSelector value="en-US" onChange={handleChange} />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      const options = screen.getAllByRole("option");
      const spanishOption = options.find((opt) => opt.textContent?.includes("Spanish (Spain)"));
      fireEvent.keyDown(spanishOption!, { key: "Enter" });

      expect(handleChange).toHaveBeenCalledWith("es-ES");
    });

    it("should handle keyboard navigation (Space)", async () => {
      const handleChange = vi.fn();
      render(<LanguageSelector value="en-US" onChange={handleChange} />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      const options = screen.getAllByRole("option");
      const frenchOption = options.find((opt) => opt.textContent?.includes("French"));
      fireEvent.keyDown(frenchOption!, { key: " " });

      expect(handleChange).toHaveBeenCalledWith("fr-FR");
    });

    it("should show selected indicator on current language", async () => {
      render(<LanguageSelector value="es-ES" />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        const options = screen.getAllByRole("option");
        const spanishOption = options.find((opt) => opt.textContent?.includes("Spanish (Spain)"));
        expect(spanishOption).toHaveAttribute("aria-selected", "true");
      });
    });
  });

  describe("Disabled state", () => {
    it("should not open when disabled", () => {
      render(<LanguageSelector disabled />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("should have disabled styling", () => {
      const { container } = render(<LanguageSelector disabled />);

      const button = container.querySelector("button");
      expect(button).toBeDisabled();
      expect(button?.className).toContain("disabled:opacity-50");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      render(<LanguageSelector value="en-US" />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });

      expect(button).toHaveAttribute("aria-label", "Select transcription language");
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveAttribute("aria-haspopup", "listbox");
    });

    it("should update aria-expanded when opened", async () => {
      render(<LanguageSelector />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute("aria-expanded", "true");
      });
    });

    it("should have listbox role for dropdown", async () => {
      render(<LanguageSelector />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        const listbox = screen.getByRole("listbox");
        expect(listbox).toHaveAttribute("aria-label", "Language options");
      });
    });

    it("should have option role for each language", async () => {
      render(<LanguageSelector />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        const options = screen.getAllByRole("option");
        expect(options.length).toBeGreaterThan(10); // Should have 14 languages
        options.forEach((option) => {
          expect(option).toHaveAttribute("aria-selected");
        });
      });
    });
  });

  describe("Spanish language support (F006)", () => {
    it("should include Spanish (Spain) in language list", async () => {
      render(<LanguageSelector />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        const options = screen.getAllByRole("option");
        const spanishOption = options.find((opt) => opt.textContent?.includes("Spanish (Spain)"));
        expect(spanishOption).toBeTruthy();
      });
    });

    it("should include Spanish (Mexico) in language list", async () => {
      render(<LanguageSelector />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        const options = screen.getAllByRole("option");
        const spanishMxOption = options.find((opt) => opt.textContent?.includes("Spanish (Mexico)"));
        expect(spanishMxOption).toBeTruthy();
      });
    });

    it("should allow selecting Spanish", async () => {
      const handleChange = vi.fn();
      render(<LanguageSelector onChange={handleChange} />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      const options = await screen.findAllByRole("option");
      const spanishOption = options.find((opt) => opt.textContent?.includes("Spanish (Spain)"));
      fireEvent.click(spanishOption!);

      expect(handleChange).toHaveBeenCalledWith("es-ES");
    });

    it("should display selected Spanish language", () => {
      render(<LanguageSelector value="es-ES" />);
      expect(screen.getByText(/Spanish \(Spain\)/)).toBeInTheDocument();
    });
  });

  describe("French language support (F007)", () => {
    it("should include French in language list", async () => {
      render(<LanguageSelector />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        const options = screen.getAllByRole("option");
        const frenchOption = options.find((opt) => opt.textContent?.includes("French"));
        expect(frenchOption).toBeTruthy();
      });
    });

    it("should allow selecting French", async () => {
      const handleChange = vi.fn();
      render(<LanguageSelector onChange={handleChange} />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        const options = screen.getAllByRole("option");
        const frenchOption = options.find((opt) => opt.textContent?.includes("French"));
        fireEvent.click(frenchOption!);
      });

      expect(handleChange).toHaveBeenCalledWith("fr-FR");
    });

    it("should display selected French language", () => {
      render(<LanguageSelector value="fr-FR" />);
      expect(screen.getByText(/French/)).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("should handle invalid language code gracefully", () => {
      render(<LanguageSelector value="invalid-code" />);

      // Should fallback to default (English US)
      expect(screen.getByText(/English \(US\)/)).toBeInTheDocument();
    });

    it("should handle onChange being undefined", async () => {
      render(<LanguageSelector />);

      const button = screen.getByRole("button", { name: /Select transcription language/ });
      fireEvent.click(button);

      await waitFor(() => {
        const spanishOption = screen.getByRole("option", { name: /Spanish \(Spain\)/ });
        // Should not crash
        fireEvent.click(spanishOption);
      });

      expect(true).toBe(true); // No crash
    });
  });
});

describe("LanguageIndicator", () => {
  it("should render language code", () => {
    render(<LanguageIndicator languageCode="es-ES" />);
    expect(screen.getByText("es-ES")).toBeInTheDocument();
  });

  it("should have language name in title", () => {
    const { container } = render(<LanguageIndicator languageCode="fr-FR" />);
    const indicator = container.querySelector("span");
    expect(indicator).toHaveAttribute("title", "French");
  });

  it("should render with custom className", () => {
    const { container } = render(<LanguageIndicator languageCode="en-US" className="custom-class" />);
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("should return null for invalid language code", () => {
    const { container } = render(<LanguageIndicator languageCode="invalid" />);
    expect(container.firstChild).toBeNull();
  });

  it("should render icon", () => {
    const { container } = render(<LanguageIndicator languageCode="de-DE" />);
    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });
});
