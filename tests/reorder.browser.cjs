const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => { document.startViewTransition = undefined; });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, PATCH, PUT, OPTIONS" };
  const base = { description: null, dueDate: null, importance: "GREEN", isDone: false, createdAt: "2026-01-01" };
  let tasks = [{ ...base, id: "a", title: "Alpha", bucketId: "one", position: 0 }, { ...base, id: "b", title: "Beta", bucketId: "one", position: 1 }, { ...base, id: "c", title: "Gamma", bucketId: "two", position: 0 }];
  let subtasks = [{ id: "s1", title: "First", taskId: "a", position: 0, isDone: false, createdAt: "2026-01-01" }, { id: "s2", title: "Second", taskId: "a", position: 1, isDone: false, createdAt: "2026-01-02" }];
  let rejectMove = false;
  let subtaskOrderWrites = 0;
  await page.route("**/@vite/client", (route) => route.fulfill({ contentType: "application/javascript", body: 'export function createHotContext() { return { accept() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {} }; } export function updateStyle(id, css) { let style = document.querySelector(`style[data-vite-dev-id="${id}"]`); if (!style) { style = document.createElement("style"); style.setAttribute("data-vite-dev-id", id); document.head.appendChild(style); } style.textContent = css; } export function removeStyle() {} export function injectQuery(url) { return url; }' }));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", (route) => route.fulfill({ contentType: "application/javascript", body: 'const getToken = async () => "fixture-token"; export function useAuth() { return { isLoaded: true, isSignedIn: true, userId: "fixture-owner", getToken }; }' }));
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    let data;
    if (req.method() === "GET") {
      data = path === "/api/tasks" ? tasks : path === "/api/subtasks" ? subtasks : path === "/api/buckets" ? [{ id: "one", name: "One", folderId: "folder-1" }, { id: "two", name: "Two", folderId: "folder-1" }, { id: "empty", name: "Empty", folderId: "folder-1" }] : [{ id: "folder-1", name: "Folder" }];
    } else if (req.method() === "PATCH" && path.endsWith("/move")) {
      if (rejectMove) return route.fulfill({ status: 500, headers: cors, json: { error: "Move failed" } });
      const id = path.split("/")[3];
      const { bucketId, beforeTaskId } = req.postDataJSON();
      const task = tasks.find((item) => item.id === id);
      const ordered = tasks.filter((item) => item.bucketId === bucketId && item.id !== id).sort((a, b) => a.position - b.position);
      const index = beforeTaskId === null ? ordered.length : ordered.findIndex((item) => item.id === beforeTaskId);
      ordered.splice(index, 0, task);
      ordered.forEach((item, position) => { item.bucketId = bucketId; item.position = position; });
      data = ordered;
    } else if (req.method() === "PUT" && path === "/api/tasks/a/subtasks/order") {
      subtaskOrderWrites++;
      req.postDataJSON().ids.forEach((id, position) => { subtasks.find((item) => item.id === id).position = position; });
      data = subtasks;
    } else if (req.method() === "PATCH" && path === "/api/tasks/a") {
      const { name, ...fields } = req.postDataJSON();
      const task = tasks.find((item) => item.id === "a");
      Object.assign(task, fields, { title: name });
      data = task;
    } else throw new Error(`Unexpected request: ${req.method()} ${path}`);
    return route.fulfill({ headers: cors, json: data });
  });
  await page.route("**/__reorder_test", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true; const fixture=await import("/tests/reorder.fixture.tsx"); fixture.startFixture();</script>' }));
  async function drag(from, to, { checkPreview = false } = {}) {
    const a = await from.boundingBox(); const b = await to.boundingBox();
    const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    if (checkPreview) {
      await page.mouse.move(start.x + 10, start.y, { steps: 3 });
      const preview = page.locator("[data-task-drag-preview]");
      await preview.waitFor({ state: "visible" });
      const before = await preview.boundingBox();
      await page.mouse.move(end.x, end.y, { steps: 12 });
      await page.waitForTimeout(50);
      const after = await preview.boundingBox();
      assert.ok(Math.abs((after.x - before.x) - (end.x - start.x - 10)) < 5, "drag preview should follow horizontal pointer movement");
      assert.ok(Math.abs((after.y - before.y) - (end.y - start.y)) < 5, "drag preview should follow vertical pointer movement");
      assert.equal(await preview.evaluate((element) => element.closest('[id^="folder-bucket-tasks-"]')), null, "preview must not be clipped by its original bucket");
    } else {
      await page.mouse.move(end.x, end.y, { steps: 12 });
    }
    await page.mouse.up();
  }
  try {
    await page.goto("http://127.0.0.1:5178/__reorder_test");
    await page.getByRole("button", { name: "Reorder task Alpha" }).waitFor();
    await drag(page.getByRole("button", { name: "Reorder task Beta" }), page.getByRole("button", { name: "Reorder task Alpha" }));
    await page.waitForFunction(() => [...document.querySelectorAll('button[aria-label^="Reorder task"]')].map((button) => button.getAttribute("aria-label")).slice(0, 2).join(",") === "Reorder task Beta,Reorder task Alpha");
    assert.deepEqual(tasks.filter((item) => item.bucketId === "one").sort((a, b) => a.position - b.position).map((item) => item.id), ["b", "a"]);
    // Keyboard users can pick up the handle, move one row, and drop it.
    await page.getByRole("button", { name: "Reorder task Beta" }).focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(100);
    await page.keyboard.press("Space");
    await page.waitForFunction(() => [...document.querySelectorAll('button[aria-label^="Reorder task"]')].map((button) => button.getAttribute("aria-label")).slice(0, 2).join(",") === "Reorder task Alpha,Reorder task Beta");
    await page.reload();
    await page.getByRole("button", { name: "Reorder task Alpha" }).waitFor();
    assert.deepEqual((await page.getByRole("button", { name: /Reorder task/ }).evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")))).slice(0, 2), ["Reorder task Alpha", "Reorder task Beta"]);
    let betaMove = page.waitForResponse((response) => response.url().endsWith("/api/tasks/b/move"));
    await drag(page.getByRole("button", { name: "Reorder task Beta" }), page.getByText("No tasks yet."), { checkPreview: true });
    await betaMove;
    await page.waitForTimeout(300);
    assert.equal(tasks.find((item) => item.id === "b").bucketId, "empty");
    betaMove = page.waitForResponse((response) => response.url().endsWith("/api/tasks/b/move"));
    await drag(page.getByRole("button", { name: "Reorder task Beta" }), page.getByRole("link", { name: "Sidebar One" }));
    await betaMove;
    await page.waitForTimeout(300);
    assert.equal(tasks.find((item) => item.id === "b").bucketId, "one");
    const moved = page.waitForResponse((response) => response.url().endsWith("/api/tasks/a/move"));
    await drag(page.getByRole("button", { name: "Reorder task Alpha" }), page.getByRole("link", { name: "Sidebar Two" }));
    await moved;
    await page.waitForTimeout(300);
    assert.equal(tasks.find((item) => item.id === "a").bucketId, "two");
    rejectMove = true;
    await drag(page.getByRole("button", { name: "Reorder task Beta" }), page.getByRole("link", { name: "Sidebar Two" }));
    await page.getByText("Move failed").waitFor();
    assert.equal(tasks.find((item) => item.id === "b").bucketId, "one");
    await page.waitForTimeout(300);
    rejectMove = false;
    await page.getByRole("link", { name: "Sidebar One" }).click();
    await page.getByRole("button", { name: "Reorder task Beta" }).waitFor();
    betaMove = page.waitForResponse((response) => response.url().endsWith("/api/tasks/b/move"));
    await drag(page.getByRole("button", { name: "Reorder task Beta" }), page.getByRole("link", { name: "Sidebar Empty" }));
    await betaMove;
    assert.equal(tasks.find((item) => item.id === "b").bucketId, "empty");
    await page.waitForTimeout(300);
    await page.getByRole("link", { name: "Folder", exact: true }).click();
    await page.getByRole("button", { name: "Reorder task Beta" }).waitFor();
    await page.waitForTimeout(300);
    await page.getByRole("link", { name: /Alpha/ }).click();
    await page.waitForTimeout(300);
    await drag(page.getByRole("button", { name: "Reorder subtask Second" }), page.getByRole("button", { name: "Reorder subtask First" }));
    await page.waitForFunction(() => [...document.querySelectorAll('button[aria-label^="Reorder subtask"]')].map((button) => button.getAttribute("aria-label")).join(",") === "Reorder subtask Second,Reorder subtask First");
    assert.deepEqual([...subtasks].sort((a, b) => a.position - b.position).map((item) => item.id), ["s2", "s1"]);
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Edit task" }).click();
    await page.getByLabel("Task name").waitFor();
    await drag(page.getByRole("button", { name: "Reorder subtask First" }), page.getByRole("button", { name: "Reorder subtask Second" }));
    await page.waitForFunction(() => [...document.querySelectorAll('button[aria-label^="Reorder subtask"]')].map((button) => button.getAttribute("aria-label")).join(",") === "Reorder subtask First,Reorder subtask Second");
    assert.equal(subtaskOrderWrites, 1, "draft order must not save before the task is saved");
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Edit task" }).waitFor();
    assert.equal(subtaskOrderWrites, 2);
    assert.deepEqual([...subtasks].sort((a, b) => a.position - b.position).map((item) => item.id), ["s1", "s2"]);
    // Exercise the pointer sensor with real touch events in a narrow viewport.
    await page.setViewportSize({ width: 390, height: 844 });
    const touch = await page.context().newCDPSession(page);
    await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    const secondHandle = page.getByRole("button", { name: "Reorder subtask Second" });
    const firstHandle = page.getByRole("button", { name: "Reorder subtask First" });
    await secondHandle.scrollIntoViewIfNeeded();
    await firstHandle.scrollIntoViewIfNeeded();
    const secondBox = await secondHandle.boundingBox();
    const firstBox = await firstHandle.boundingBox();
    const start = { x: secondBox.x + secondBox.width / 2, y: secondBox.y + secondBox.height / 2 };
    const end = { x: firstBox.x + firstBox.width / 2, y: firstBox.y + firstBox.height / 2 };
    const touchSaved = page.waitForResponse((response) => response.url().endsWith("/api/tasks/a/subtasks/order"));
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    for (let step = 1; step <= 10; step++) {
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + (end.x - start.x) * step / 10, y: start.y + (end.y - start.y) * step / 10 }] });
    }
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await touchSaved;
    assert.deepEqual([...subtasks].sort((a, b) => a.position - b.position).map((item) => item.id), ["s2", "s1"]);
    assert.deepEqual(errors, []);
    process.stdout.write("Reordering browser checks passed.\n");
  } catch (error) {
    console.error("Fixture state:", page.url(), await page.locator("body").innerText().catch(() => "unavailable"), tasks, errors);
    throw error;
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
