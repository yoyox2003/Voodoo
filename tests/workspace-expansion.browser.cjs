// Run against Vite on port 5178 with the bundled Playwright on NODE_PATH.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => { errors.push(error.message); process.stderr.write(`Browser error: ${error.message}\n`); });
  await page.route("**/@vite/client", (route) => route.fulfill({ contentType: "application/javascript", body: 'export function createHotContext() { return { accept() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {} }; } export function updateStyle(id, css) { let style = document.querySelector(`style[data-vite-dev-id="${id}"]`); if (!style) { style = document.createElement("style"); style.setAttribute("data-vite-dev-id", id); document.head.appendChild(style); } style.textContent = css; } export function removeStyle() {} export function injectQuery(url) { return url; }' }));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", (route) => route.fulfill({ contentType: "application/javascript", body: 'const getToken = async () => "fixture-token"; export function useAuth() { return { isLoaded: true, isSignedIn: true, userId: "fixture-owner", getToken }; }' }));
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS" };
  let subtasks = Array.from({ length: 8 }, (_, index) => ({ id: `sub-${index}`, taskId: "task-1", title: `Step ${index + 1}`, isDone: false, position: index, createdAt: `2026-01-0${index + 1}` }));
  const tasks = Array.from({ length: 7 }, (_, index) => ({ id: `task-${index + 1}`, title: index === 0 ? "Plan" : `Task ${index + 1}`, bucketId: "bucket-1", importance: "GREEN", isDone: false, description: null, dueDate: null, position: index }));
  let rejectSave = false;
  await page.route("**/api/**", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const pathname = new URL(route.request().url()).pathname;
    if (route.request().method() === "POST" && pathname === "/api/buckets/bucket-1/tasks") {
      const created = { id: "task-8", title: route.request().postDataJSON().name, bucketId: "bucket-1", importance: "GREEN", isDone: false, description: null, dueDate: null, position: 7 };
      tasks.push(created);
      return route.fulfill({ headers: cors, json: created });
    }
    if (route.request().method() === "PATCH") {
      assert.equal(pathname, "/api/subtasks/sub-0");
      assert.equal(route.request().headers().authorization, "Bearer fixture-token");
      if (rejectSave) return route.fulfill({ status: 500, headers: cors, json: { error: "Subtask save failed" } });
      const { isDone } = route.request().postDataJSON();
      subtasks = subtasks.map((subtask) => subtask.id === "sub-0" ? { ...subtask, isDone } : subtask);
      return route.fulfill({ headers: cors, json: subtasks[0] });
    }
    const data = pathname === "/api/folders" ? [{ id: "folder-1", name: "Work" }]
      : pathname === "/api/buckets" ? [{ id: "bucket-1", name: "Projects", folderId: "folder-1", description: null }]
      : pathname === "/api/tasks" ? tasks
      : pathname === "/api/subtasks" ? subtasks : [];
    return route.fulfill({ headers: cors, json: data });
  });
  await page.route("**/__expansion_test", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => {}; window.__vite_plugin_react_preamble_installed__ = true; window.fixtureInitialPath = "/folders/folder-1"; const fixture = await import("/tests/task-inline.fixture.tsx"); fixture.startFixture();</script>' }));
  try {
    await page.goto("http://127.0.0.1:5178/__expansion_test");
    const bucketPanel = page.locator("#folder-bucket-tasks-bucket-1");
    const collapseBucket = page.getByRole("button", { name: "Collapse Projects" });
    await collapseBucket.waitFor();
    assert.equal(await bucketPanel.evaluate((element) => element.inert), false);
    await collapseBucket.click();
    const expandBucket = page.getByRole("button", { name: "Expand Projects" });
    await expandBucket.waitFor();
    assert.equal(await bucketPanel.evaluate((element) => element.inert), true);
    assert.equal(await bucketPanel.locator("[data-scroll-indicator]").count(), 0);
    await expandBucket.click();
    await collapseBucket.waitFor();
    assert.equal(await bucketPanel.evaluate((element) => element.getAnimations().some((animation) => animation.transitionProperty === "grid-template-rows")), true);
    const folderTasks = page.getByRole("region", { name: "Tasks in Projects" });
    const folderIndicator = bucketPanel.locator("[data-scroll-indicator]");
    await folderIndicator.waitFor();
    assert.equal(await folderTasks.evaluate((element) => element.scrollHeight > element.clientHeight), true);
    assert.equal(await folderTasks.evaluate((element) => getComputedStyle(element).scrollbarWidth), "none");
    assert.equal(await folderTasks.locator("li").count(), 7);
    const folderBounds = await folderTasks.evaluate((element) => {
      const rows = element.querySelectorAll("li");
      return { bottom: element.getBoundingClientRect().bottom, fifthBottom: rows[4].getBoundingClientRect().bottom, sixthTop: rows[5].getBoundingClientRect().top };
    });
    assert.ok(folderBounds.fifthBottom <= folderBounds.bottom + 1 && folderBounds.sixthTop >= folderBounds.bottom - 1, `Expected exactly five visible rows: ${JSON.stringify(folderBounds)}`);
    const folderIndicatorStart = await folderIndicator.evaluate((element) => element.getBoundingClientRect().top);
    await folderTasks.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    assert.equal(await folderTasks.evaluate((element) => element.scrollTop > 0), true);
    await page.waitForFunction((start) => document.querySelector("#folder-bucket-tasks-bucket-1 [data-scroll-indicator]").getBoundingClientRect().top > start, folderIndicatorStart);
    await page.getByRole("link", { name: "Projects 7", exact: true }).click();
    const taskPanel = page.locator("#task-subtasks-task-1");
    const expandTask = page.getByRole("button", { name: "Expand Plan subtasks" });
    await expandTask.waitFor();
    assert.equal(await taskPanel.evaluate((element) => element.inert), true);
    await expandTask.click();
    const collapseTask = page.getByRole("button", { name: "Collapse Plan subtasks" });
    await collapseTask.waitFor();
    const completeStep = page.getByRole("button", { name: 'Mark subtask "Step 1" as complete' });
    await completeStep.click();
    const reopenStep = page.getByRole("button", { name: 'Mark subtask "Step 1" as incomplete' });
    await reopenStep.waitFor();
    assert.equal(await reopenStep.getAttribute("aria-pressed"), "true");
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Mark subtask \\\"Step 1\\\" as incomplete"]').disabled);
    await reopenStep.focus();
    await page.keyboard.press("Space");
    await completeStep.waitFor();
    rejectSave = true;
    await completeStep.click();
    await page.getByText("Subtask save failed", { exact: true }).waitFor();
    await completeStep.waitFor();
    assert.equal(await completeStep.getAttribute("aria-pressed"), "false");
    rejectSave = false;
    await completeStep.click();
    await reopenStep.waitFor();
    const extraSubtasks = page.locator("#task-extra-subtasks-task-1");
    const showMore = page.getByRole("button", { name: "Show more" });
    const scrollIndicator = taskPanel.locator("[data-scroll-indicator]");
    assert.equal(await showMore.getAttribute("aria-expanded"), "false");
    assert.equal(await extraSubtasks.evaluate((element) => element.inert), true);
    assert.equal(await scrollIndicator.count(), 0);
    await showMore.click();
    const showLess = page.getByRole("button", { name: "Show less" });
    await showLess.waitFor();
    assert.equal(await showLess.getAttribute("aria-expanded"), "true");
    assert.equal(await extraSubtasks.evaluate((element) => element.getAnimations().some((animation) => animation.transitionProperty === "grid-template-rows")), true);
    assert.equal(await page.getByText("Step 4").isVisible(), true);
    const subtaskList = page.getByRole("region", { name: "Subtasks for Plan" });
    await page.waitForFunction(() => {
      const element = document.querySelector('[aria-label="Subtasks for Plan"]');
      return element && element.scrollHeight > element.clientHeight;
    });
    await page.waitForFunction(() => document.querySelector("#task-extra-subtasks-task-1").getAnimations().length === 0);
    await scrollIndicator.waitFor();
    assert.equal(await subtaskList.evaluate((element) => element.clientHeight), 148);
    assert.equal(await subtaskList.evaluate((element) => getComputedStyle(element).scrollbarWidth), "none");
    const subtaskBounds = await subtaskList.evaluate((element) => {
      const rows = element.querySelectorAll("li");
      return { bottom: element.getBoundingClientRect().bottom, fifthBottom: rows[4].getBoundingClientRect().bottom, sixthTop: rows[5].getBoundingClientRect().top };
    });
    assert.ok(subtaskBounds.fifthBottom <= subtaskBounds.bottom + 1 && subtaskBounds.sixthTop >= subtaskBounds.bottom - 1, `Expected exactly five visible subtasks: ${JSON.stringify(subtaskBounds)}`);
    const indicatorStart = await scrollIndicator.evaluate((element) => element.getBoundingClientRect().top);
    await subtaskList.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    assert.equal(await subtaskList.evaluate((element) => element.scrollTop > 0), true);
    await page.waitForFunction((start) => document.querySelector("#task-subtasks-task-1 [data-scroll-indicator]").getBoundingClientRect().top > start, indicatorStart);
    const lastStep = page.getByText("Step 8", { exact: true });
    const viewport = await subtaskList.boundingBox();
    const lastStepBox = await lastStep.boundingBox();
    assert.ok(lastStepBox.y + lastStepBox.height <= viewport.y + viewport.height + 1);
    await showLess.click();
    await showMore.waitFor();
    assert.equal(await extraSubtasks.evaluate((element) => element.inert), true);
    assert.equal(await scrollIndicator.count(), 0);
    await showMore.focus();
    await page.keyboard.press("Enter");
    await showLess.waitFor();
    await collapseTask.click();
    await expandTask.waitFor();
    assert.equal(await taskPanel.evaluate((element) => element.inert), true);
    await expandTask.focus();
    await page.keyboard.press("Enter");
    await collapseTask.waitFor();
    assert.equal(await taskPanel.evaluate((element) => element.getAnimations().some((animation) => animation.transitionProperty === "grid-template-rows")), true);
    assert.equal(await page.getByText("Step 4").isVisible(), true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await taskPanel.evaluate((element) => getComputedStyle(element).transitionProperty), "none");
    assert.equal(await extraSubtasks.evaluate((element) => getComputedStyle(element).transitionProperty), "none");
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await page.getByLabel("New task name").fill("Last task");
    await page.getByLabel("New task name").press("Enter");
    await page.getByRole("button", { name: "Reorder task Last task" }).waitFor();
    const taskOrder = () => page.getByRole("button", { name: /Reorder task/ }).evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
    assert.equal((await taskOrder()).at(-1), "Reorder task Last task");
    await page.reload();
    await page.getByRole("link", { name: "Projects 8", exact: true }).click();
    await page.getByRole("button", { name: "Reorder task Last task" }).waitFor();
    assert.equal((await taskOrder()).at(-1), "Reorder task Last task");
    await page.getByRole("button", { name: "Expand Plan subtasks" }).waitFor();
    await page.getByRole("link", { name: /Plan/ }).click();
    try { await page.getByRole("button", { name: "Edit task" }).waitFor({ timeout: 5000 }); }
    catch (error) { process.stderr.write(`Page after task link: ${await page.locator("body").innerText()}\n`); throw error; }
    await page.getByRole("button", { name: 'Mark subtask "Step 1" as incomplete' }).waitFor();
    assert.deepEqual(errors, []);
    process.stdout.write("Folder and bucket expansion browser checks passed.\n");
  } finally { await browser.close(); }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
