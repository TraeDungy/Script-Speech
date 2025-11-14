import { expect, test } from "@playwright/test";

test.describe("Marketing pages", () => {
  test("landing to FAQ navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /voice-led story studio/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /request access/i })).toBeVisible();

    await page.getByRole("link", { name: /study the system/i }).click();
    await expect(page).toHaveURL(/\/faq/);
    await expect(page.getByRole("heading", { name: /details that stay off the landing page/i })).toBeVisible();
  });
});
