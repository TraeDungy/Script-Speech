import { expect, test } from "@playwright/test";

test.describe("Access request", () => {
  test("submits the form successfully", async ({ page }) => {
    await page.route("**/api/request-access", async (route) => {
      const body = await route.request().postDataJSON();
      expect(body.email).toBe("producer@example.com");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Thanks!" }),
      });
    });

    await page.goto("/");
    await page.getByLabel("Email").fill("producer@example.com");
    await page.getByLabel("Project focus").fill("Feature");
    await page.getByRole("button", { name: "Request access" }).click();
    await expect(page.getByText("Thanks!")).toBeVisible();
  });
});
