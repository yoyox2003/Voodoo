const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => { errors.push(error.message); process.stderr.write(`Browser error: ${error.stack}\n`); });
  let consoleCount = 0;
  page.on("console", (message) => { if (message.type() === "error" && consoleCount++ < 4) process.stderr.write(`Browser console: ${message.text()}\n`); });
  await page.route("**/@vite/client", (route) => route.fulfill({ contentType: "application/javascript", body: 'export function createHotContext() { return { accept() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {} }; } export function updateStyle(id, css) { let style = document.querySelector(`style[data-vite-dev-id="${id}"]`); if (!style) { style = document.createElement("style"); style.setAttribute("data-vite-dev-id", id); document.head.appendChild(style); } style.textContent = css; } export function removeStyle() {} export function injectQuery(url) { return url; }' }));
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, PATCH, POST, PUT, DELETE, OPTIONS" };
  let task = { id: "task-1", title: "A task", description: "Some notes", dueDate: null, importance: "GREEN", isDone: false, bucketId: "bucket-1", createdAt: "2026-01-01" };
  let subtasks = [{ id: "sub-1", taskId: task.id, title: "First step", isDone: false, createdAt: "2026-01-01" }];
  let rejectCompletion = true;
  let createCount = 0;
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", (route) => route.fulfill({ contentType: "application/javascript", body: 'const getToken = async () => "fixture-token"; export function useAuth() { return { isLoaded: true, isSignedIn: true, userId: "fixture-owner", getToken }; }' }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    let data;
    if (request.method() === "GET") {
      data = url.pathname === "/api/tasks" ? [task] : url.pathname === "/api/subtasks" ? subtasks : url.pathname === "/api/buckets" ? [{ id: "bucket-1", folderId: "folder-1", name: "Bucket" }] : [{ id: "folder-1", name: "Folder" }];
    } else if (url.pathname === "/api/tasks/task-1" && request.method() === "PATCH") {
      const { name, ...fields } = request.postDataJSON();
      task = { ...task, ...fields, title: name, dueDate: fields.dueDate ? `${fields.dueDate}T00:00:00.000Z` : null }; data = task;
    } else if (url.pathname === "/api/tasks/task-1/subtasks" && request.method() === "POST") {
      createCount++; data = { id: `new-${createCount}`, taskId: task.id, title: request.postDataJSON().name, isDone: false, createdAt: "2026-01-01" }; subtasks.push(data);
    } else if (url.pathname.startsWith("/api/subtasks/") && request.method() === "PATCH") {
      if (rejectCompletion) { rejectCompletion = false; return route.fulfill({ status: 500, headers: cors, json: { error: "Completion failed" } }); }
      const id = url.pathname.split("/").pop(); subtasks = subtasks.map((item) => item.id === id ? { ...item, ...request.postDataJSON() } : item); data = subtasks.find((item) => item.id === id);
    } else if (url.pathname.startsWith("/api/subtasks/") && request.method() === "PUT") {
      const id = url.pathname.split("/").pop(); subtasks = subtasks.map((item) => item.id === id ? { ...item, title: request.postDataJSON().name } : item); data = subtasks.find((item) => item.id === id);
    } else if (url.pathname.startsWith("/api/subtasks/") && request.method() === "DELETE") {
      const id = url.pathname.split("/").pop(); subtasks = subtasks.filter((item) => item.id !== id); return route.fulfill({ status: 204, headers: cors });
    } else throw new Error(`Unexpected request: ${request.method()} ${url.pathname}`);
    return route.fulfill({ headers: cors, json: data });
  });
  await page.route("**/__inline_test", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => {}; window.__vite_plugin_react_preamble_installed__ = true; const fixture = await import("/tests/task-inline.fixture.tsx"); fixture.startFixture();</script>' }));
  try {
    await page.goto("http://127.0.0.1:5178/__inline_test");
    await page.getByRole("heading", { name: "A task" }).waitFor();
    const before = await page.getByRole("heading", { name: "Description" }).boundingBox();
    const titleBefore = await page.getByRole("heading", { name: "A task" }).boundingBox();
    const dueBefore = await page.getByText("No due date set", { exact: true }).boundingBox();
    const subtaskBefore = await page.getByText("First step", { exact: true }).boundingBox();
    await page.getByRole("button", { name: "Edit task" }).click();
    const after = await page.getByRole("heading", { name: "Description" }).boundingBox();
    assert.ok(Math.abs(before.y - after.y) < 2, `Layout shifted: ${before.y} -> ${after.y}`);
    for (const [label, original, locator] of [["title", titleBefore, page.getByLabel("Task name")], ["due date", dueBefore, page.getByText("No due date set", { exact: true }).locator("../..")], ["subtask", subtaskBefore, page.getByLabel("Subtask 1", { exact: true })]]) {
      const actual = await locator.boundingBox();
      assert.ok(Math.abs(original.x - actual.x) < 2 && Math.abs(original.y - actual.y) < 2 && Math.abs(original.height - actual.height) < 2, `${label} moved or changed height: ${JSON.stringify({ original, actual })}`);
    }
    await page.getByLabel("Task name").fill("Changed task");
    await page.getByText("No due date set", { exact: true }).click();
    await page.getByLabel("Due date").fill("2027-05-01");
    await page.getByLabel("Due date").press("Escape");
    assert.equal(await page.getByLabel("Due date").isVisible(), false);
    await page.getByLabel("Change importance").click();
    await page.getByRole("button", { name: "Set importance to Red" }).click();
    await page.getByRole("button", { name: "Add subtask" }).click();
    await page.getByLabel("Subtask 2", { exact: true }).fill("New step");
    await page.getByLabel("Subtask 2", { exact: true }).press("Enter");
    const nextSubtask = page.getByLabel("Subtask 3", { exact: true });
    await nextSubtask.waitFor();
    assert.equal(await nextSubtask.evaluate((element) => element === document.activeElement), true);
    await nextSubtask.press("Enter");
    assert.equal(await page.getByLabel("Subtask 4", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Remove subtask 3" }).click();
    await page.getByRole("button", { name: "Mark subtask 2 complete" }).click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("link", { name: "Home" }).click();
    assert.equal(await page.getByLabel("Task name").inputValue(), "Changed task");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Completion failed" }).waitFor();
    assert.equal(createCount, 1);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("heading", { name: "Changed task" }).waitFor();
    assert.equal(createCount, 1);
    assert.equal(subtasks.find((item) => item.title === "New step").isDone, true);
    assert.equal(task.importance, "RED");
    assert.match(task.dueDate, /^2027-05-01/);
    await page.getByRole("button", { name: "Edit task" }).click();
    await page.getByLabel("Description").fill("Discard me");
    await page.getByRole("button", { name: "Cancel" }).click();
    assert.equal(await page.getByText("Some notes").count(), 1);
    await page.setViewportSize({ width: 375, height: 812 });
    const mobileBefore = await page.getByRole("heading", { name: "Description" }).boundingBox();
    await page.getByRole("button", { name: "Edit task" }).click();
    const mobileAfter = await page.getByRole("heading", { name: "Description" }).boundingBox();
    assert.ok(Math.abs(mobileBefore.y - mobileAfter.y) < 2, `Mobile layout shifted: ${mobileBefore.y} -> ${mobileAfter.y}`);
    await page.getByLabel("Task name").fill("Leave me");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("link", { name: "Home" }).click();
    await page.getByText("Home page").waitFor();
    assert.deepEqual(errors, []);
    process.stdout.write("Inline editing browser checks passed.\n");
  } finally { await browser.close(); }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
