import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/intel.json" });

test.describe.serial("repo intelligence", () => {
  test("builds the index and shows the code graph", async ({ page }) => {
    await page.goto("/r/acme/widgets/intel");
    await expect(page.getByRole("heading", { name: "Repo intelligence" })).toBeVisible();
    await page.getByRole("button", { name: "Build the index" }).click();

    const ledger = page.getByRole("region", { name: "Index" });
    // README, package.json and the two TypeScript files (the PNG is skipped); four definitions; one import.
    await expect(ledger).toContainText(/Files\s*4\s*Definitions\s*4\s*Import edges\s*1\s*Semantic coverage\s*100%/);
  });

  test("shows the blast radius of a file", async ({ page }) => {
    await page.goto("/r/acme/widgets/intel");
    await page.getByRole("tab", { name: "Map & impact" }).click();
    await page.getByLabel("Find a file").fill("slug");
    await page.getByRole("list", { name: "Matching files" }).getByRole("button", { name: "src/utils/slugify.ts" }).click();
    const aside = page.getByRole("complementary", { name: "File details" });
    await expect(aside).toContainText("1 file depends on it (1 directly)");
    await expect(aside.getByRole("link", { name: "src/index.ts" })).toBeVisible();

    await aside.getByRole("button", { name: "Ask about changing it" }).click();
    await expect(page.getByLabel("Your question")).toHaveValue(/I want to change src\/utils\/slugify\.ts/);
  });

  test("answers with verified, clickable citations", async ({ page }) => {
    await page.goto("/r/acme/widgets/intel");
    await page.getByLabel("Your question").fill("How are widgets created?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();

    await expect(page.getByText("Looked up createWidget")).toBeVisible();
    const answer = page.locator(".prose-analysis").last();
    await expect(answer).toContainText("builds a widget from a name");
    // The made-up path stays plain text; real ones link into the workspace.
    await expect(answer.getByRole("link", { name: "src/missing.ts:L1" })).toHaveCount(0);
    await expect(page.getByText("2 verified citations · 1 unverifiable left unlinked")).toBeVisible();

    await answer.getByRole("link", { name: "src/index.ts:L6-L9" }).click();
    await expect(page).toHaveURL(/\/r\/acme\/widgets\?ref=[0-9a-f]{40}&path=src%2Findex\.ts#L6-L9$/);
  });

  test("serves the index over MCP", async ({ request }) => {
    const call = (body: object) =>
      request.post("/api/mcp", {
        data: body,
        headers: { Accept: "application/json, text/event-stream", "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18" },
      });
    const list = await call({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(list.ok()).toBeTruthy();
    const names = (await list.json()).result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(expect.arrayContaining(["search_code", "impact_of_change", "find_symbol", "read_file", "repo_overview"]));

    const impact = await call({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "impact_of_change", arguments: { repo: "acme/widgets", path: "src/utils/slugify.ts" } },
    });
    const text = (await impact.json()).result.content[0].text;
    expect(JSON.parse(text).dependents).toEqual([{ path: "src/index.ts", depth: 1 }]);
  });
});
