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
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, OPTIONS" };
  await page.route("**/api/**", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname === "/api/folders" ? [{ id: "folder-1", name: "Work" }]
      : pathname === "/api/buckets" ? [{ id: "bucket-1", name: "Projects", folderId: "folder-1", description: null }]
      : pathname === "/api/tasks" ? [{ id: "task-1", title: "Plan", bucketId: "bucket-1", importance: "GREEN", isDone: false, description: null, dueDate: null }]
      : pathname === "/api/subtasks" ? Array.from({ length: 4 }, (_, index) => ({ id: `sub-${index}`, taskId: "task-1", title: `Step ${index + 1}`, isDone: false, createdAt: `2026-01-0${index + 1}` })) : [];
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
    await expandBucket.click();
    await collapseBucket.waitFor();
    assert.equal(await bucketPanel.evaluate((element) => element.getAnimations().some((animation) => animation.transitionProperty === "grid-template-rows")), true);
    await page.getByRole("link", { name: "Projects 1", exact: true }).click();
    const taskPanel = page.locator("#task-subtasks-task-1");
    const collapseTask = page.getByRole("button", { name: "Collapse Plan subtasks" });
    await collapseTask.waitFor();
    await page.getByRole("button", { name: "Show more" }).click();
    assert.equal(await page.getByText("Step 4").isVisible(), true);
    await collapseTask.click();
    const expandTask = page.getByRole("button", { name: "Expand Plan subtasks" });
    await expandTask.waitFor();
    assert.equal(await taskPanel.evaluate((element) => element.inert), true);
    await expandTask.focus();
    await page.keyboard.press("Enter");
    await collapseTask.waitFor();
    assert.equal(await taskPanel.evaluate((element) => element.getAnimations().some((animation) => animation.transitionProperty === "grid-template-rows")), true);
    assert.equal(await page.getByText("Step 4").isVisible(), true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await taskPanel.evaluate((element) => getComputedStyle(element).transitionProperty), "none");
    await page.getByRole("link", { name: /Plan/ }).click();
    try { await page.getByRole("button", { name: "Edit task" }).waitFor({ timeout: 5000 }); }
    catch (error) { process.stderr.write(`Page after task link: ${await page.locator("body").innerText()}\n`); throw error; }
    assert.deepEqual(errors, []);
    process.stdout.write("Folder and bucket expansion browser checks passed.\n");
  } finally { await browser.close(); }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
