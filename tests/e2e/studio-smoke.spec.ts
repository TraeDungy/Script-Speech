import { expect, test } from "@playwright/test";

test.describe("Studio experience", () => {
  test("shows workspace details and links back home", async ({ page }) => {
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: /studio canvas/i })).toBeVisible();
    await expect(page.getByText("Outline the cold open with a single location")).toBeVisible();
    await expect(page.getByText("Preview export package")).toBeVisible();

    await page.getByRole("link", { name: /Return to the landing page/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /voice-led story studio/i })).toBeVisible();
  });
});
