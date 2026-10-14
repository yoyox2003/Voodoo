const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const vm = require("node:vm");

const source = readFileSync(path.join(__dirname, "../src/lib/dueDates.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const functions = {};
vm.runInThisContext(`(function(exports) { ${compiled} })`)(functions);

test("deadlines keep their calendar day in positive and negative timezone offsets", () => {
  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ["America/Los_Angeles", "Africa/Cairo", "Pacific/Kiritimati"]) {
      process.env.TZ = timezone;
      assert.equal(functions.dueDateKey("2028-02-29T00:00:00.000Z"), "2028-02-29");
      assert.equal(functions.localDateKey(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
      assert.equal(functions.localDateKey(new Date(2027, 0, 1, 0, 0)), "2027-01-01");
      assert.equal(functions.localDateKey(new Date(2028, 1, 29, 0, 0)), "2028-02-29");
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("daily lists include completed tasks and omit unscheduled or other-day tasks", () => {
  const tasks = [
    { id: "open", dueDate: "2026-10-12T00:00:00.000Z", isDone: false },
    { id: "done", dueDate: "2026-10-12T00:00:00.000Z", isDone: true },
    { id: "later", dueDate: "2026-10-13T00:00:00.000Z", isDone: false },
    { id: "unscheduled", dueDate: null, isDone: false },
  ];
  assert.deepEqual(functions.tasksDueOn(tasks, "2026-10-12").map((task) => task.id), ["open", "done"]);
  assert.deepEqual(functions.tasksDueOn(tasks, "2026-10-14"), []);
  assert.equal(functions.dueDateKey(null), null);
});
