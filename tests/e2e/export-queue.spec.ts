import { expect, test } from "@playwright/test";

test.describe("Export queue", () => {
  test("queues an export and polls for updates", async ({ page }) => {
    await page.route("**/api/projects/demo-project/export", async (route) => {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          id: "job-99",
          projectId: "demo-project",
          format: "pdf",
          status: "queued",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    let pollCount = 0;
    await page.route("**/api/exports/job-99", async (route) => {
      pollCount += 1;
      const status = pollCount > 1 ? "completed" : "processing";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "job-99",
          projectId: "demo-project",
          format: "pdf",
          status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/studio");
    await page.getByRole("textbox", { name: "Email delivery (optional)" }).fill("director@example.com");
    await page.getByRole("button", { name: "Queue PDF" }).click();
    await expect(page.getByText("Export queued", { exact: false })).toBeVisible();
    await expect(page.getByText("completed", { exact: false })).toBeVisible();
  });
});
