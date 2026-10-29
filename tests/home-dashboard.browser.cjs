// Run against Vite on port 5178 with the bundled Playwright on NODE_PATH.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "Africa/Cairo" });
  await page.clock.setFixedTime(new Date("2026-10-15T10:00:00Z"));
  await page.route("**/@vite/client", (route) => route.fulfill({ contentType: "application/javascript", body: 'export function createHotContext() { return { accept() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {} }; } export function updateStyle(id, css) { let s = document.querySelector(`style[data-vite-dev-id="${id}"]`); if (!s) { s = document.createElement("style"); s.setAttribute("data-vite-dev-id", id); document.head.appendChild(s); } s.textContent = css; } export function removeStyle() {} export function injectQuery(url) { return url; }' }));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", (route) => route.fulfill({ contentType: "application/javascript", body: 'const getToken = async () => "fixture-token"; export function useAuth() { return { isLoaded: true, isSignedIn: true, userId: "fixture-owner", getToken }; }' }));
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS" };
  let tasks = Array.from({ length: 6 }, (_, index) => ({ id: `task-${index}`, title: index === 5 ? "VeryLongTaskName".repeat(10) : `Task ${index}`, bucketId: "bucket-1", dueDate: "2026-10-15T00:00:00.000Z", importance: "GREEN", isDone: false, createdAt: `2026-01-0${index + 1}` }));
  let rejectSave = false;
  await page.route("**/api/**", (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (request.method() === "PATCH") {
      if (rejectSave) return route.fulfill({ status: 500, headers: cors, json: { error: "Completion failed" } });
      const id = pathname.split("/").pop();
      tasks = tasks.map((task) => task.id === id ? { ...task, isDone: request.postDataJSON().isDone } : task);
      return route.fulfill({ headers: cors, json: tasks.find((task) => task.id === id) });
    }
    const data = pathname === "/api/tasks" ? tasks : pathname === "/api/subtasks" ? [] : pathname === "/api/buckets" ? [{ id: "bucket-1", name: "Work", folderId: "folder-1" }] : [{ id: "folder-1", name: "Projects" }];
    return route.fulfill({ headers: cors, json: data });
  });
  await page.route("**/__home_dashboard", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => {}; window.__vite_plugin_react_preamble_installed__ = true; const fixture = await import("/tests/home-dashboard.fixture.tsx"); fixture.startFixture();</script>' }));
  try {
    await page.goto("http://127.0.0.1:5178/__home_dashboard");
    const today = page.getByRole("region", { name: "Today", exact: true });
    await today.getByRole("button", { name: "Show more Today tasks" }).click();
    assert.equal(await today.locator("li").count(), 6);
    await today.getByRole("button", { name: "Show less Today tasks" }).click();
    assert.equal(await today.locator("li").count(), 5);
    rejectSave = true;
    await today.getByRole("button", { name: 'Mark task "Task 0" as complete' }).click();
    await page.getByText("Completion failed", { exact: true }).waitFor();
    await today.getByRole("button", { name: 'Mark task "Task 0" as complete' }).waitFor();
    rejectSave = false;
    await today.getByRole("button", { name: 'Mark task "Task 0" as complete' }).click();
    await page.getByRole("progressbar", { name: "Work progress: 17% complete" }).waitFor();
    await page.setViewportSize({ width: 375, height: 800 });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await today.getByRole("link", { name: /Task 1/ }).click();
    await page.getByText("Task detail", { exact: true }).waitFor();
    await page.reload();
    await page.getByRole("region", { name: "Bucket progress" }).getByRole("link", { name: /Work/ }).click();
    await page.getByText("Bucket detail", { exact: true }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: "Create task" }).click();
    await page.getByText("Create task return: /").waitFor();
    process.stdout.write("Home dashboard browser checks passed.\n");
  } finally { await browser.close(); }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
