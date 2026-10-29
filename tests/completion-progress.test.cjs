const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const vm = require("node:vm");

const source = readFileSync(path.join(__dirname, "../src/lib/completionProgress.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const progress = {};
vm.runInThisContext(`(function(exports) { ${compiled} })`)(progress);

test("task progress follows subtasks unless the task is completed", () => {
  assert.equal(progress.taskProgress({ isDone: false }, []), 0);
  assert.equal(progress.taskProgress({ isDone: true }, []), 100);
  const subtasks = [{ isDone: true }, { isDone: false }];
  assert.equal(progress.taskProgress({ isDone: false }, subtasks), 50);
  assert.equal(progress.taskProgress({ isDone: true }, subtasks), 100);
  assert.equal(progress.taskProgress({ isDone: false }, [{ isDone: true }]), 100);
});

test("bucket progress averages each task equally and handles empty buckets", () => {
  const tasks = [{ id: "a", isDone: true }, { id: "b", isDone: false }];
  const subtasks = [
    { taskId: "a", isDone: false },
    { taskId: "b", isDone: true },
    { taskId: "b", isDone: false },
    { taskId: "other", isDone: true },
  ];
  assert.equal(progress.bucketProgress([], subtasks), 0);
  assert.equal(progress.bucketProgress(tasks, subtasks), 75);
});
