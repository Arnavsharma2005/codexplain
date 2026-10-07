import { expect, test } from "@playwright/test";

test.describe("signed out", () => {
  test("landing page validates input and opens a repository", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Understand any GitHub repository");

    const input = page.getByLabel("GitHub repository URL").first();
    await input.fill("not a repo");
    await input.press("Enter");
    await expect(page.getByRole("alert").first()).toContainText("doesn't look like a GitHub repository");

    await input.fill("https://github.com/acme/widgets");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/r\/acme\/widgets$/);
    await expect(page.getByText("Where to start")).toBeVisible();
  });

  test("deep links to a file and line from a GitHub blob URL", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel("GitHub repository URL").first();
    await input.fill("github.com/acme/widgets/blob/main/src/index.ts#L6-L9");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/r\/acme\/widgets\?ref=main&path=src%2Findex\.ts#L6-L9$/);
    await expect(page.locator(".code-view #L6")).toHaveClass(/highlighted/);
    await expect(page.locator(".code-view #L9")).toHaveClass(/highlighted/);
    await expect(page.locator(".code-view #L10")).not.toHaveClass(/highlighted/);
  });

  test("browses the tree, filters files and shows code", async ({ page }) => {
    await page.goto("/r/acme/widgets");
    const tree = page.getByRole("tree", { name: "Repository files" });
    await tree.getByRole("treeitem", { name: "src" }).getByRole("button").click();
    await tree.getByRole("treeitem", { name: "index.ts" }).click();
    await expect(page).toHaveURL(/path=src%2Findex\.ts/);
    await expect(page.locator(".code-view .line")).toHaveCount(13);
    await expect(page.locator(".code-view")).toContainText("export function createWidget");

    await page.keyboard.press("/");
    await page.keyboard.type("slug");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/path=src%2Futils%2Fslugify\.ts/);
    await expect(page.locator(".code-view")).toContainText("export const slugify");

    await page.goBack();
    await expect(page.locator(".code-view")).toContainText("createWidget");
  });

  test("binary files show a friendly notice", async ({ page }) => {
    await page.goto("/r/acme/widgets?path=assets%2Flogo.png");
    await expect(page.getByText("This is a binary file")).toBeVisible();
    await expect(page.getByText("This file can't be analyzed")).toBeVisible();
  });

  test("asks visitors to sign in before analyzing", async ({ page }) => {
    await page.goto("/r/acme/widgets?path=src%2Findex.ts");
    await expect(page.getByRole("button", { name: "Sign in to analyze" })).toBeVisible();
  });

  test("private and missing repositories show an error page", async ({ page }) => {
    await page.goto("/r/acme/private");
    await expect(page.getByRole("heading", { name: "Repository not found" })).toBeVisible();
    await page.goto("/r/acme/does-not-exist");
    await expect(page.getByRole("heading", { name: "Repository not found" })).toBeVisible();
  });

  test("dashboard requires sign in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?callbackUrl=(%2F|\/)dashboard$/);
    await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
  });

  test("unknown routes render the 404 page", async ({ page }) => {
    const res = await page.goto("/this/does/not/exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("This page doesn't exist")).toBeVisible();
  });
});

test.describe("API hardening", () => {
  test("sends security headers", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });

  test("rejects invalid input, traversal, unauthenticated and cross-site writes", async ({ request }) => {
    expect((await request.get("/api/github/file?owner=acme&repo=widgets&ref=main&path=../secrets")).status()).toBe(400);
    expect((await request.get("/api/github/tree?owner=-bad&repo=x&ref=main")).status()).toBe(400);
    expect((await request.post("/api/analyze", { data: {} })).status()).toBe(401);
    const cross = await request.post("/api/analyze", { data: {}, headers: { origin: "https://evil.example" } });
    expect(cross.status()).toBe(403);
    expect((await request.get("/api/analyses")).status()).toBe(401);
  });
});
