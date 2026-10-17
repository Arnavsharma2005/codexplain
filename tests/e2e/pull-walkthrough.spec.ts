import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/intel.json" });

test.describe.serial("PR walkthrough", () => {
  test("is reachable from the repository bar", async ({ page }) => {
    await page.goto("/r/acme/widgets");
    const overview = page.getByRole("region", { name: "Go deeper" });
    await expect(overview.getByRole("link", { name: /Repo intelligence/ })).toHaveAttribute("href", "/r/acme/widgets/intel");

    await page.getByRole("link", { name: "Intelligence", exact: true }).click();
    await expect(page).toHaveURL(/\/r\/acme\/widgets\/intel$/);
    await expect(page.getByRole("heading", { name: "Repo intelligence" })).toBeVisible();

    await page.goto("/r/acme/widgets?ref=feature%2Flogin");
    await expect(page.getByRole("link", { name: "Intelligence", exact: true })).toHaveAttribute("href", "/r/acme/widgets/intel?ref=feature%2Flogin");

    await page.getByRole("link", { name: "Pull requests", exact: true }).click();
    await expect(page).toHaveURL(/\/pr\?repo=acme%2Fwidgets$/);
    const open = page.getByRole("region", { name: "Open pull requests in acme/widgets" });
    await expect(open.getByRole("link")).toHaveText([/#7\s*Add name checks to widgets\s*by ada/, /#9\s*Draft: dark mode\s*draft · by ada/]);
    await open.getByRole("link", { name: /Add name checks to widgets/ }).click();
    await expect(page).toHaveURL(/\/r\/acme\/widgets\/pull\/7$/);
  });

  test("opens a pull request link from the header search", async ({ page }) => {
    await page.goto("/pr");
    await expect(page.getByRole("heading", { name: "PR walkthrough" })).toBeVisible();
    const search = page.getByRole("banner").getByLabel("GitHub repository URL");
    await search.fill("https://github.com/acme/widgets/pull/7/files");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/r\/acme\/widgets\/pull\/7$/);
    await expect(page.getByRole("heading", { name: "Add name checks to widgets" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No walkthrough yet" })).toBeVisible();
  });

  test("writes the walkthrough in layers, foundations first", async ({ page }) => {
    await page.goto("/r/acme/widgets/pull/7");
    await page.getByRole("button", { name: "Write the walkthrough" }).click();

    const ledger = page.getByRole("region", { name: "Pull request" });
    await expect(ledger).toContainText(/Files\s*3\s*Layers\s*3\s*Lines\s*\+3 −2\s*Blast radius\s*0 files\s*Review risk\s*Low/);
    await expect(ledger).toContainText("Widget ids become URL-safe");
    const layers = page.getByRole("navigation", { name: "Layers" });
    await expect(layers.getByRole("link")).toHaveText([/01\s*Safer slugs/, /02\s*Validate widget names/, /03\s*Readme wording/]);

    const sheet = page.getByRole("complementary", { name: "Layer summary" });
    await expect(sheet.getByRole("heading", { name: "Safer slugs" })).toBeVisible();
    await expect(sheet).toContainText("Every widget id goes through this function.");
    await expect(sheet.getByText("Looks right")).toBeVisible();
    await expect(page.locator("#f0L1")).toContainText('replace(/[^a-z0-9]+/g, "-")');
  });

  test("moves between layers with the keyboard and follows line links", async ({ page }) => {
    await page.goto("/r/acme/widgets/pull/7");
    const sheet = page.getByRole("complementary", { name: "Layer summary" });
    await expect(sheet.getByRole("heading", { name: "Safer slugs" })).toBeVisible();

    await page.keyboard.press("j");
    await expect(page).toHaveURL(/\?layer=2$/);
    await expect(sheet.getByRole("heading", { name: "Validate widget names" })).toBeVisible();
    await expect(sheet).toContainText("builds on 01");
    await expect(sheet.getByRole("img", { name: "Before: createWidget, then slugify. After: createWidget, then name check, then slugify." })).toBeVisible();
    await expect(page.locator("#f1L7")).toContainText('throw new Error("name is required")');

    await sheet.getByRole("link", { name: "index.ts:L7" }).first().click();
    await expect(page).toHaveURL(/\?layer=2#f1L7$/);
    await expect(page.locator("#f1L7")).toHaveClass(/is-hit/);

    const ask = sheet.getByRole("link", { name: "Ask about this layer" });
    await expect(ask).toHaveAttribute("href", /^\/r\/acme\/widgets\/intel\?ref=[0-9a-f]{40}&q=In\+pull\+request\+%237/);

    // V marks the layer viewed and moves on.
    await page.keyboard.press("v");
    await expect(page).toHaveURL(/\?layer=3$/);
    await expect(page.getByRole("navigation", { name: "Layers" })).toContainText("1 of 3 viewed");
    // Back on layer 2 the viewed file is folded away until it is unchecked.
    await page.keyboard.press("k");
    const viewed = page.getByRole("region", { name: "src/index.ts" }).getByRole("checkbox", { name: "Viewed" });
    await expect(viewed).toBeChecked();
    await expect(page.locator("#f1L7")).toHaveCount(0);
    await viewed.uncheck();
    await expect(page.locator("#f1L7")).toBeVisible();

    await page.getByRole("button", { name: "Split" }).click();
    await expect(page.locator(".wt-split").first()).toBeVisible();
    await expect(page.locator("#f1L7")).toHaveClass(/wt-half is-add/);
  });

  test("is public to read and listed on the entry page", async ({ browser }) => {
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await anon.newPage();
    await page.goto("/r/acme/widgets/pull/7");
    await expect(page.getByRole("complementary", { name: "Layer summary" })).toBeVisible();

    await page.goto("/r/acme/widgets/pull/8");
    await expect(page.getByText("This pull request changes 4,000 files")).toBeVisible();

    await page.goto("/pr");
    await page.getByRole("region", { name: "Recent walkthroughs" }).getByRole("link", { name: /Add name checks to widgets/ }).click();
    await expect(page).toHaveURL(/\/r\/acme\/widgets\/pull\/7$/);

    await page.goto("/pr");
    await page.getByLabel("Pull request link").fill("acme/widgets#7");
    await page.getByRole("button", { name: "Walk me through" }).click();
    await expect(page).toHaveURL(/\/r\/acme\/widgets\/pull\/7$/);
    await anon.close();
  });

  test("serves the walkthrough over MCP", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "walk_pull_request", arguments: { repo: "acme/widgets", number: 7 } } },
      headers: { Accept: "application/json, text/event-stream", "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18" },
    });
    expect(res.ok()).toBeTruthy();
    const payload = JSON.parse((await res.json()).result.content[0].text);
    expect(payload.layers.map((l: { title: string }) => l.title)).toEqual(["Safer slugs", "Validate widget names", "Readme wording"]);
    expect(payload.layers[1].builds_on).toEqual([1]);
    expect(payload.review_risk).toBe("low");
  });
});
