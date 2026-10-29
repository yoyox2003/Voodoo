// Run against Vite on port 5178 with the bundled Playwright on NODE_PATH.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/@vite/client", (route) => route.fulfill({ contentType: "application/javascript", body: 'export function createHotContext() { return { accept() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {} }; } export function updateStyle(id, css) { let style = document.querySelector(`style[data-vite-dev-id="${id}"]`); if (!style) { style = document.createElement("style"); style.setAttribute("data-vite-dev-id", id); document.head.appendChild(style); } style.textContent = css; } export function removeStyle() {} export function injectQuery(url) { return url; }' }));
  await page.route("**/node_modules/.vite/deps/@clerk_react.js*", (route) => route.fulfill({ contentType: "application/javascript", body: 'const getToken = async () => "fixture-token"; export function useAuth() { return { isLoaded: true, isSignedIn: true, userId: "fixture-owner", getToken }; } export function useUser() { return { user: { firstName: "Test" } }; } export function UserButton() { return null; }' }));
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, OPTIONS" };
  await page.route("**/api/**", (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const pathname = new URL(request.url()).pathname;
    const data = pathname === "/api/folders" ? [{ id: "folder-1", name: "Work" }, { id: "folder-2", name: "Personal" }]
      : pathname === "/api/buckets" ? [{ id: "bucket-1", name: "Projects", folderId: "folder-1" }]
      : pathname === "/api/tasks" ? [{ id: "task-1", title: "Task", bucketId: "bucket-1" }]
      : [];
    return route.fulfill({ headers: cors, json: data });
  });
  await page.route("**/__sidebar_test", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => {}; window.__vite_plugin_react_preamble_installed__ = true; const fixture = await import("/tests/sidebar.fixture.tsx"); fixture.startFixture();</script>' }));
  try {
    await page.goto("http://127.0.0.1:5178/__sidebar_test");
    const sidebar = page.getByRole("complementary", { name: "Workspace navigation" });
    const work = sidebar.getByRole("link", { name: "Work", exact: true });
    const expand = sidebar.getByRole("button", { name: "Expand Work" });
    const panel = page.locator("#folder-buckets-folder-1");
    await expand.waitFor();
    assert.equal(await panel.getAttribute("aria-hidden"), "true");
    assert.equal(await panel.evaluate((element) => element.inert), true);
    await work.click();
    await page.getByRole("heading", { name: "Folder page" }).waitFor();
    const collapse = sidebar.getByRole("button", { name: "Collapse Work" });
    await collapse.waitFor();
    assert.equal(await panel.evaluate((element) => getComputedStyle(element).transitionProperty), "grid-template-rows");
    assert.equal(await panel.evaluate((element) => getComputedStyle(element).transitionDuration), "0.2s");
    const activeLinks = () => sidebar.locator('a[class*="bg-[#fff0e9]"]');
    assert.equal(await activeLinks().count(), 1);
    assert.equal(await activeLinks().first().innerText(), "Work");
    await sidebar.getByRole("link", { name: "Projects" }).click();
    await page.getByRole("heading", { name: "Bucket page" }).waitFor();
    assert.equal(await activeLinks().count(), 1);
    assert.equal(await activeLinks().first().innerText(), "Projects");
    await page.getByRole("link", { name: "Open task" }).click();
    await page.getByRole("heading", { name: "Task page" }).waitFor();
    assert.equal(await activeLinks().count(), 1);
    assert.equal(await activeLinks().first().innerText(), "Projects");
    await collapse.click();
    await expand.waitFor();
    assert.equal(await panel.evaluate((element) => element.inert), true);
    await expand.click();
    await collapse.waitFor();
    assert.equal(await panel.evaluate((element) => element.inert), false);
    assert.equal(await panel.evaluate((element) => element.getAnimations().some((animation) => animation.transitionProperty === "grid-template-rows")), true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await panel.evaluate((element) => getComputedStyle(element).transitionProperty), "none");
    assert.deepEqual(errors, []);
    process.stdout.write("Sidebar browser checks passed.\n");
  } finally { await browser.close(); }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
