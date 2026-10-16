// Page-load benchmark against the mock GitHub/Gemini server.
//
//   MOCK_PORT=4010 MOCK_LATENCY_MS=120 node tests/e2e/mock-server.mjs &
//   (build and start the app on :3100 with the env from playwright.config.ts)
//   node scripts/bench.mjs
//
// Each run uses a cold browser context on an emulated fast-4G connection with a
// 4x CPU slowdown, and reports medians.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = process.env.BENCH_URL ?? "http://localhost:3100";
const RUNS = Number(process.env.BENCH_RUNS ?? 7);
const auth = JSON.parse(readFileSync("tests/e2e/.auth/user.json", "utf8"));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });

async function prepareShare() {
  const ctx = await browser.newContext({ baseURL: BASE, storageState: auth });
  const file = { owner: "acme", repo: "widgets", ref: "main", path: "src/index.ts" };
  const res = await ctx.request.post("/api/analyze", { data: { ...file, mode: "OVERVIEW" } });
  const done = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)).find((e) => e.type === "done");
  const share = await ctx.request.post(`/api/analyses/${done.id}/share`, { headers: { origin: BASE } });
  const { url } = await share.json();
  await ctx.close();
  return new URL(url, BASE).pathname;
}

async function measure(path, ready, signedIn) {
  const ctx = await browser.newContext({ baseURL: BASE, storageState: signedIn ? auth : undefined, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  let js = 0;
  let requests = 0;
  cdp.on("Network.loadingFinished", () => requests++);
  const scripts = new Set();
  cdp.on("Network.responseReceived", (e) => e.type === "Script" && scripts.add(e.requestId));
  cdp.on("Network.loadingFinished", (e) => scripts.has(e.requestId) && (js += e.encodedDataLength));
  const start = Date.now();
  await page.goto(path, { waitUntil: "commit" });
  await page.locator(ready).first().waitFor({ state: "visible", timeout: 60_000 });
  const visible = Date.now() - start;
  await page.waitForLoadState("networkidle");
  const lcp = await page.evaluate(
    () => new Promise((r) => new PerformanceObserver((l) => r(l.getEntries().at(-1)?.startTime ?? 0)).observe({ type: "largest-contentful-paint", buffered: true })),
  );
  await ctx.close();
  return { visible, lcp, js, requests };
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const sharePath = await prepareShare();
const scenarios = [
  ["Workspace, signed out: code visible", "/r/acme/widgets?path=src%2Findex.ts", ".code-view .line", false],
  ["Workspace, signed in: saved analysis visible", "/r/acme/widgets?path=src%2Findex.ts", ".prose-analysis", true],
  ["Share page: analysis visible", sharePath, ".prose-analysis", false],
];

await measure(scenarios[0][1], scenarios[0][2], false); // warm the server
const rows = [];
for (const [name, path, ready, signedIn] of scenarios) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await measure(path, ready, signedIn));
  rows.push({
    scenario: name,
    "visible ms": median(runs.map((r) => r.visible)),
    "LCP ms": Math.round(median(runs.map((r) => r.lcp))),
    "JS KB": Math.round(median(runs.map((r) => r.js)) / 1024),
    requests: median(runs.map((r) => r.requests)),
  });
}
console.table(rows);
await browser.close();
