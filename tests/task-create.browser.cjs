const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/@vite/client", (route) => route.fulfill({ contentType: "application/javascript", body: 'export function createHotContext() { return { accept() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {} }; } export function updateStyle(id, css) { let style = document.querySelector(`style[data-vite-dev-id="${id}"]`); if (!style) { style = document.createElement("style"); style.setAttribute("data-vite-dev-id", id); document.head.appendChild(style); } style.textContent = css; } export function removeStyle() {} export function injectQuery(url) { return url; }' }));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", (route) => route.fulfill({ contentType: "application/javascript", body: 'const getToken = async () => "fixture-token"; export function useAuth() { return { isLoaded: true, isSignedIn: true, userId: "fixture-owner", getToken }; }' }));
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, PATCH, POST, OPTIONS" };
  let task;
  let subtasks = [];
  let taskCreates = 0;
  let rejectSubtask = true;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    let data;
    if (request.method() === "GET") {
      data = pathname === "/api/tasks" ? (task ? [task] : []) : pathname === "/api/subtasks" ? subtasks : pathname === "/api/buckets" ? [{ id: "bucket-1", folderId: "folder-1", name: "Bucket" }] : [{ id: "folder-1", name: "Folder" }];
    } else if (pathname === "/api/buckets/bucket-1/tasks" && request.method() === "POST") {
      taskCreates++;
      const { name, ...fields } = request.postDataJSON();
      task = { id: "created-1", title: name, ...fields, isDone: false, bucketId: "bucket-1", createdAt: "2026-01-01" };
      data = task;
    } else if (pathname === "/api/tasks/created-1" && request.method() === "PATCH") {
      const { name, ...fields } = request.postDataJSON();
      task = { ...task, ...fields, title: name };
      data = task;
    } else if (pathname === "/api/tasks/created-1/subtasks" && request.method() === "POST") {
      if (rejectSubtask) { rejectSubtask = false; return route.fulfill({ status: 500, headers: cors, json: { error: "Subtask failed" } }); }
      data = { id: "sub-1", taskId: "created-1", title: request.postDataJSON().name, isDone: false, createdAt: "2026-01-01" };
      subtasks.push(data);
    } else if (pathname === "/api/subtasks/sub-1" && request.method() === "PATCH") {
      subtasks = subtasks.map((item) => ({ ...item, ...request.postDataJSON() }));
      data = subtasks[0];
    } else throw new Error(`Unexpected request: ${request.method()} ${pathname}`);
    return route.fulfill({ headers: cors, json: data });
  });
  await page.route("**/__inline_create", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => {}; window.__vite_plugin_react_preamble_installed__ = true; window.fixtureInitialPath = "/tasks/new?bucketId=bucket-1&dueDate=2027-05-01"; const fixture = await import("/tests/task-inline.fixture.tsx"); fixture.startFixture();</script>' }));
  try {
    await page.goto("http://127.0.0.1:5178/__inline_create");
    await page.getByLabel("Task name").waitFor();
    assert.equal(await page.getByLabel("Bucket", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Enter a task name" }).waitFor();
    await page.getByLabel("Task name").fill("New task");
    await page.getByLabel("Description").fill("Description");
    await page.getByRole("button", { name: "Mark task complete" }).click();
    await page.getByRole("button", { name: "Add subtask" }).click();
    await page.getByLabel("Subtask 1", { exact: true }).fill("First step");
    await page.getByRole("button", { name: "Mark subtask 1 complete" }).click();
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Subtask failed" }).waitFor();
    assert.equal(taskCreates, 1);
    assert.equal(await page.getByLabel("Bucket", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("button", { name: "Edit task" }).waitFor();
    assert.equal(taskCreates, 1);
    assert.equal(task.title, "New task");
    assert.equal(task.description, "Description");
    assert.equal(task.dueDate, "2027-05-01");
    assert.equal(task.isDone, true);
    assert.equal(subtasks[0].isDone, true);
    await page.getByRole("link", { name: "New task", exact: true }).click();
    await page.getByLabel("Task name").fill("Needs a bucket");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Choose a bucket" }).waitFor();
    assert.equal(taskCreates, 1);
    assert.deepEqual(errors, []);
    process.stdout.write("Task creation browser checks passed.\n");
  } finally { await browser.close(); }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
