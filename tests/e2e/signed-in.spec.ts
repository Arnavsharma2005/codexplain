import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/user.json" });

test.describe.serial("signed in", () => {
  test("streams an analysis with clickable line references", async ({ page }) => {
    await page.goto("/r/acme/widgets?path=src%2Findex.ts");
    await page.getByRole("button", { name: "Generate overview" }).click();

    const panel = page.locator(".prose-analysis");
    await expect(panel.getByRole("heading", { name: "Summary" })).toBeVisible();
    await expect(panel).toContainText("renameWidget");
    await expect(panel).not.toContainText("SECRET THOUGHT");
    await expect(page.getByText("New", { exact: true })).toBeVisible();
    await expect(page.getByText("4 left today")).toBeVisible();

    await panel.getByRole("link", { name: "L6-L9" }).click();
    await expect(page).toHaveURL(/#L6-L9$/);
    await expect(page.locator(".code-view #L7")).toHaveClass(/highlighted/);
  });

  test("serves the same file version from cache without spending quota", async ({ page }) => {
    await page.goto("/r/acme/widgets?path=src%2Findex.ts");
    await expect(page.getByText("Cached", { exact: true })).toBeVisible();
    await expect(page.locator(".prose-analysis")).toContainText("createWidget");
    await page.goto("/dashboard");
    await expect(page.getByText("Analyses left today")).toBeVisible();
    await expect(page.locator("text=4").first()).toBeVisible();
  });

  test("lists history, shares and revokes a public link", async ({ page, browser }) => {
    await page.goto("/dashboard");
    const item = page.getByRole("link", { name: /acme\/widgets\/src\/index\.ts/ });
    await expect(item).toBeVisible();

    await page.getByRole("button", { name: "More actions" }).first().click();
    await page.getByRole("menuitem", { name: "Create share link" }).click();
    await expect(page.getByText("Shared", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "More actions" }).first().click();
    const href = await page.getByRole("menuitem", { name: "Open shared page" }).getAttribute("href");
    expect(href).toMatch(/^\/a\/[A-Za-z0-9_-]{20,}$/);
    await page.keyboard.press("Escape");

    const anon = await browser.newContext();
    const shared = await anon.newPage();
    await shared.goto(href!);
    await expect(shared.getByRole("heading", { name: "src/index.ts" })).toBeVisible();
    await expect(shared.locator(".prose-analysis")).toContainText("renameWidget");

    await page.getByRole("button", { name: "More actions" }).first().click();
    await page.getByRole("menuitem", { name: "Revoke share link" }).click();
    await expect(page.getByText("Share link revoked")).toBeVisible();
    const gone = await shared.goto(href!);
    expect(gone?.status()).toBe(404);
    await anon.close();
  });

  test("saves a repository to the dashboard", async ({ page }) => {
    await page.goto("/r/acme/widgets");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Saved" }).locator("..")).toContainText("widgets");
  });

  test("enforces the daily quota", async ({ page }) => {
    await page.goto("/r/acme/widgets?path=src%2Findex.ts");
    for (const mode of ["Deep dive", "Code review"]) {
      await page.getByRole("tab", { name: mode }).click();
      await page.getByRole("button", { name: new RegExp(`Generate ${mode}`, "i") }).click();
      await expect(page.locator(".prose-analysis")).toContainText("renameWidget");
    }
    // 3 used of 5: regenerate twice more, then the next one is refused.
    await page.getByRole("button", { name: "Regenerate analysis" }).click();
    await expect(page.getByText("New", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Regenerate analysis" }).click();
    await expect(page.getByText("0 left today")).toBeVisible();
    await page.getByRole("button", { name: "Regenerate analysis" }).click();
    await expect(page.getByText("Daily limit reached")).toBeVisible();
  });
});
