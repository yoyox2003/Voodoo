const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const vm = require("node:vm");

function load(name) {
  const source = readFileSync(path.join(__dirname, `../src/lib/${name}.ts`), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInThisContext(`(function(exports, require) { ${compiled} })`)(exports, (file) => load(file.slice(2)));
  return exports;
}
const { groupHomeTasks, rankHomeBuckets } = load("homeDashboard");
const task = (id, dueDate, importance = "GREEN", extra = {}) => ({ id, title: id, bucketId: "one", dueDate, importance, isDone: false, createdAt: "2026-01-01", ...extra });

test("groups unfinished deadlines over the year boundary and sorts by date and importance", () => {
  const groups = groupHomeTasks([
    task("past", "2026-12-30"), task("red", "2026-12-31", "RED"), task("green", "2026-12-31"),
    task("last", "2027-01-07"), task("tomorrow", "2027-01-01"), task("later", "2027-01-08"),
    task("undated", null), task("done", "2026-12-31", "RED", { isDone: true }),
  ], "2026-12-31");
  assert.deepEqual(groups.overdue.map((item) => item.id), ["past"]);
  assert.deepEqual(groups.today.map((item) => item.id), ["red", "green"]);
  assert.deepEqual(groups.upcoming.map((item) => item.id), ["tomorrow", "last"]);
  assert.deepEqual(groupHomeTasks([task("today", "2027-01-01")], "2027-01-02").overdue.map((item) => item.id), ["today"]);
});

test("ranks active nonempty buckets using equal task weights and excludes completed progress", () => {
  const buckets = ["one", "two", "empty", "done"].map((id) => ({ id, name: id, folderId: "folder" }));
  const tasks = [task("a", null), task("b", null, "GREEN", { bucketId: "two" }), task("c", null, "GREEN", { bucketId: "done", isDone: true })];
  const subtasks = [{ taskId: "a", isDone: true }, { taskId: "a", isDone: false }, { taskId: "c", isDone: false }];
  assert.deepEqual(rankHomeBuckets(buckets, tasks, subtasks).map((entry) => [entry.bucket.id, entry.progress]), [["two", 0], ["one", 50]]);
  const many = Array.from({ length: 8 }, (_, index) => ({ id: String(index), name: String(index), folderId: "folder" }));
  assert.equal(rankHomeBuckets(many, many.map((bucket) => task(bucket.id, null, "GREEN", { bucketId: bucket.id })), []).length, 6);
});
