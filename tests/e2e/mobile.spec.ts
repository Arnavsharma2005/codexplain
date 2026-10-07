import { expect, test } from "@playwright/test";

test("mobile workspace switches between files, code and analysis", async ({ page }) => {
  await page.goto("/r/acme/widgets");
  await expect(page.getByRole("tab", { name: "Files" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("treeitem", { name: "README.md" }).click();
  await expect(page.getByRole("tab", { name: "Code" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".code-view")).toContainText("Widgets");
  await page.getByRole("tab", { name: "Analysis" }).click();
  await expect(page.getByRole("button", { name: "Sign in to analyze" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
