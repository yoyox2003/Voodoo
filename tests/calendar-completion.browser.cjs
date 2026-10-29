// Run against Vite on port 5178 with the bundled Playwright on NODE_PATH.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "Africa/Cairo" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-10-15T10:00:00Z"));
  await page.route("**/@vite/client", (route) => route.fulfill({ contentType: "application/javascript", body: 'export function createHotContext() { return { accept() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {} }; } export function updateStyle(id, css) { let style = document.querySelector(`style[data-vite-dev-id="${id}"]`); if (!style) { style = document.createElement("style"); style.setAttribute("data-vite-dev-id", id); document.head.appendChild(style); } style.textContent = css; } export function removeStyle() {} export function injectQuery(url) { return url; }' }));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", (route) => route.fulfill({ contentType: "application/javascript", body: 'const getToken = async () => "fixture-token"; export function useAuth() { return { isLoaded: true, isSignedIn: true, userId: "fixture-owner", getToken }; }' }));
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS" };
  const base = { description: null, importance: "GREEN", bucketId: "bucket-1", createdAt: "2026-01-01", isDone: false };
  let tasks = [
    { ...base, id: "today", title: "Today task", dueDate: "2026-10-15T00:00:00.000Z" },
    { ...base, id: "tomorrow", title: "Tomorrow task", dueDate: "2026-10-16T00:00:00.000Z" },
  ];
  let rejectSave = false;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    let data;
    if (request.method() === "PATCH") {
      assert.match(pathname, /^\/api\/tasks\/(today|tomorrow)$/);
      assert.equal(request.headers().authorization, "Bearer fixture-token");
      if (rejectSave) return route.fulfill({ status: 500, headers: cors, json: { error: "Completion failed" } });
      const id = pathname.split("/").pop();
      const { isDone } = request.postDataJSON();
      assert.equal(typeof isDone, "boolean");
      tasks = tasks.map((task) => task.id === id ? { ...task, isDone } : task);
      data = tasks.find((task) => task.id === id);
    } else if (pathname === "/api/tasks") data = tasks;
    else if (pathname === "/api/buckets") data = [{ id: "bucket-1", name: "Work", folderId: "folder-1" }];
    else if (pathname === "/api/folders") data = [{ id: "folder-1", name: "Folder" }];
    else data = [];
    return route.fulfill({ headers: cors, json: data });
  });
  await page.route("**/__calendar_completion", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => {}; window.__vite_plugin_react_preamble_installed__ = true; const fixture = await import("/tests/calendar-completion.fixture.tsx"); fixture.startFixture();</script>' }));
  try {
    await page.goto("http://127.0.0.1:5178/__calendar_completion");
    const today = page.getByRole("region", { name: "Due today" });
    const check = today.getByRole("button", { name: 'Mark task "Today task" as complete' });
    await check.waitFor();
    await check.click();
    const reopen = today.getByRole("button", { name: 'Mark task "Today task" as incomplete' });
    await reopen.waitFor();
    assert.equal(await reopen.getAttribute("aria-pressed"), "true");
    await page.locator(".voodoo-event-completed").filter({ hasText: "Today task" }).waitFor();
    await reopen.focus();
    await page.keyboard.press("Space");
    await check.waitFor();
    await page.waitForFunction(() => ![...document.querySelectorAll(".voodoo-event-completed")].some((event) => event.textContent.includes("Today task")));
    rejectSave = true;
    await check.click();
    await page.getByText("Completion failed", { exact: true }).waitFor();
    await check.waitFor();
    assert.equal(await check.getAttribute("aria-pressed"), "false");
    rejectSave = false;
    await page.locator('[data-date="2026-10-16"] .voodoo-day-button').click();
    const selected = page.getByRole("region", { name: "Selected day" });
    const selectedCheck = selected.getByRole("button", { name: 'Mark task "Tomorrow task" as complete' });
    await selectedCheck.click();
    await selected.getByRole("button", { name: 'Mark task "Tomorrow task" as incomplete' }).waitFor();
    await page.locator(".voodoo-event-completed").filter({ hasText: "Tomorrow task" }).waitFor();
    await selected.getByRole("link", { name: /Tomorrow task/ }).click();
    await page.getByRole("heading", { name: "Tomorrow task" }).waitFor();
    assert.deepEqual(errors, []);
    process.stdout.write("Calendar completion browser checks passed.\n");
  } finally { await browser.close(); }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
