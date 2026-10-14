// Run with NODE_PATH pointing at the bundled Playwright package, and Vite on
// http://127.0.0.1:5178. Requests use fixture data, never a real user/database.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { mkdirSync } = require("node:fs");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Africa/Cairo" });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const day = await page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const base = { description: null, importance: "GREEN", bucketId: "bucket-1", createdAt: new Date().toISOString() };
  let tasks = Array.from({ length: 4 }, (_, i) => ({ ...base, id: `task-${i}`, title: `Deadline ${i + 1}`, dueDate: `${day}T00:00:00.000Z`, isDone: i === 0 }));
  tasks.push({ ...base, id: "unscheduled", title: "No deadline", dueDate: null, isDone: false });
  let rejectSave = false;
  let rejectLists = false;
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS" };
  const screenshotDirectory = path.join(process.env.TEMP, "voodoo-calendar-review");
  mkdirSync(screenshotDirectory, { recursive: true });
  try {
    await page.route("**/node_modules/.vite/deps/@clerk_react.js*", (route) => route.fulfill({
      contentType: "application/javascript",
      body: 'const getToken = async () => "fixture-token"; export function useAuth() { return { isLoaded: true, isSignedIn: true, userId: "fixture-owner", getToken }; }',
    }));
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const url = new URL(request.url());
      if (request.method() === "GET" && rejectLists) return route.fulfill({ status: 500, headers: cors, json: { error: "Fixture load failed" } });
      let data;
      if (request.method() === "PATCH") {
        assert.match(url.pathname, /^\/api\/tasks\/task-\d\/due-date$/);
        assert.equal(request.headers().authorization, "Bearer fixture-token");
        if (rejectSave) return route.fulfill({ status: 500, headers: cors, json: { error: "Fixture save failed" } });
        const { dueDate } = request.postDataJSON();
        const id = url.pathname.split("/")[3];
        tasks = tasks.map((task) => task.id === id ? { ...task, dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : null } : task);
        data = tasks.find((task) => task.id === id);
      } else if (url.pathname === "/api/tasks") data = tasks;
      else if (url.pathname === "/api/buckets") data = [{ id: "bucket-1", name: "Work tasks", folderId: "folder-1" }];
      else if (url.pathname === "/api/folders") data = [{ id: "folder-1", name: "Work" }];
      else data = [];
      await route.fulfill({ headers: cors, json: data });
    });
    await page.route("**/__calendar_test", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script><script type="module" src="/tests/calendar.fixture.tsx"></script>' }));
    await page.goto("http://127.0.0.1:5178/__calendar_test");
    await page.getByRole("heading", { name: "Due today", exact: true }).waitFor();
    const todayList = page.getByRole("region", { name: "Due today", exact: true });
    assert.equal(await todayList.getByRole("link").count(), 4);
    assert.equal(await page.getByText("No deadline", { exact: true }).count(), 0);
    assert.ok(await page.locator(".voodoo-event-completed").count());
    await page.waitForFunction(() => document.querySelectorAll(".voodoo-day-button").length > 27);
    await page.screenshot({ path: path.join(screenshotDirectory, "desktop-light.png"), fullPage: true });

    await page.getByRole("button", { name: "Next month" }).click();
    await page.getByRole("link", { name: /Show tasks for/ }).first().focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Selected day", exact: true }).waitFor();
    await page.getByRole("button", { name: "Previous month" }).click();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    assert.equal(await page.getByRole("heading", { name: "Selected day", exact: true }).count(), 0);
    await page.getByText("+2 more", { exact: true }).click();
    await page.keyboard.press("Escape");
    await todayList.getByRole("link", { name: /Deadline 2/ }).click();
    await page.getByLabel("Due date", { exact: true }).waitFor();
    await page.getByLabel("Due date", { exact: true }).fill("2028-02-29");
    rejectSave = true;
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Fixture save failed" }).waitFor();
    assert.equal(await page.getByLabel("Due date", { exact: true }).inputValue(), "2028-02-29");
    rejectSave = false;
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Due date saved" }).waitFor();
    await page.getByRole("link", { name: "Back to calendar" }).click();
    await page.getByRole("heading", { name: "Due today", exact: true }).waitFor();
    assert.equal(await todayList.getByRole("link").count(), 3);
    await page.getByRole("link", { name: /Deadline 3/ }).first().click();
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Due date cleared" }).waitFor();
    assert.equal(await page.getByLabel("Due date", { exact: true }).inputValue(), "");
    await page.getByRole("link", { name: "Back to calendar" }).click();
    await page.getByRole("heading", { name: "Due today", exact: true }).waitFor();
    assert.equal(await todayList.getByRole("link").count(), 2);
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(screenshotDirectory, "desktop-dark.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(screenshotDirectory, "mobile-dark.png"), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    rejectLists = true;
    await page.reload();
    await page.getByRole("alert").filter({ hasText: "Fixture load failed" }).waitFor();
    rejectLists = false;
    tasks = [];
    await page.reload();
    await page.getByText("No scheduled tasks yet. Open a task to set its due date.").waitFor();
    assert.equal(await todayList.getByRole("link").count(), 0);

    // Both the today heading and selection must roll over at local midnight.
    await page.clock.install({ time: new Date("2026-12-31T23:59:59+02:00") });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.clock.runFor(1200);
    await page.getByText("Friday, January 1, 2027", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`Calendar browser checks passed. Screenshots: ${screenshotDirectory}`);
  } catch (error) {
    console.log(await page.locator(".voodoo-day-button").first().evaluate((element) => element.parentElement.outerHTML).catch(() => "No calendar day elements"));
    console.log("Page errors:", errors);
    await page.screenshot({ path: path.join(screenshotDirectory, "failure.png"), fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
