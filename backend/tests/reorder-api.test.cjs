const assert = require("node:assert/strict");
const { once } = require("node:events");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const express = require("express");

test("task and subtask ordering API", async (t) => {
  let tasks;
  let subtasks;
  let failWrite;
  const buckets = [{ id: "a", owner: "owner" }, { id: "b", owner: "owner" }, { id: "other", owner: "other" }];
  const clerk = {
    clerkMiddleware: () => (req, _res, next) => { const userId = req.headers.authorization?.replace("Bearer ", ""); req.auth = { userId, isAuthenticated: Boolean(userId) }; next(); },
    getAuth: (req) => req.auth,
  };
  const ordered = (items) => [...items].sort((a, b) => a.position - b.position);
  const prisma = {
    user: { findUnique: async ({ where }) => ({ id: where.authId }) },
    bucket: { findFirst: async ({ where }) => buckets.find((b) => b.id === where.id && b.owner === where.folder.userId) ?? null },
    task: {
      findFirst: async ({ where }) => tasks.find((item) => item.id === where.id && buckets.some((b) => b.id === item.bucketId && b.owner === where.bucket.folder.userId)) ?? null,
      findMany: async ({ where }) => ordered(tasks.filter((item) => item.bucketId === where.bucketId && (!where.id || item.id !== where.id.not))),
      update: async ({ where, data }) => {
        if (failWrite && --failWrite === 0) throw new Error("write failed");
        const item = tasks.find((task) => task.id === where.id);
        Object.assign(item, data);
        return { ...item };
      },
    },
    subtask: {
      findMany: async ({ where }) => ordered(subtasks.filter((item) => item.taskId === where.taskId)),
      update: async ({ where, data }) => {
        if (failWrite && --failWrite === 0) throw new Error("write failed");
        const item = subtasks.find((subtask) => subtask.id === where.id);
        Object.assign(item, data);
        return { ...item };
      },
    },
    $transaction: async (fn) => {
      const oldTasks = structuredClone(tasks);
      const oldSubtasks = structuredClone(subtasks);
      try { return await fn(prisma); } catch (error) { tasks = oldTasks; subtasks = oldSubtasks; throw error; }
    },
  };
  let app;
  const fakeExpress = Object.assign(() => { app = express(); app.listen = () => {}; return app; }, { json: express.json });
  function load(filename) {
    const exports = {};
    const code = readFileSync(path.join(__dirname, "../dist", filename), "utf8");
    vm.runInThisContext(`(function(exports, require, process, console) {\n${code}\n})`, { filename })(exports, (id) => {
      if (id === "@clerk/express") return clerk;
      if (id === "./prisma" || id === "../prisma") return prisma;
      if (id === "./middleware/auth") return load("middleware/auth.js");
      if (id === "./dueDate") return load("dueDate.js");
      if (id === "dotenv") return { config() {} };
      if (id === "express") return fakeExpress;
      return require(id);
    }, { env: {} }, { log() {}, error() {} });
    return exports;
  }
  load("server.js");
  const server = express.application.listen.call(app, 0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  function reset() {
    tasks = [{ id: "one", bucketId: "a", position: 0 }, { id: "two", bucketId: "a", position: 1 }, { id: "three", bucketId: "b", position: 0 }];
    subtasks = [{ id: "s1", taskId: "one", position: 0 }, { id: "s2", taskId: "one", position: 1 }];
    failWrite = 0;
  }
  async function request(url, body, user = "owner", method = "PATCH") {
    const response = await fetch(base + url, { method, headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  await t.test("reorders within a bucket and moves between buckets", async () => {
    reset();
    assert.equal((await request("/api/tasks/two/move", { bucketId: "a", beforeTaskId: "one" })).status, 200);
    assert.deepEqual(ordered(tasks.filter((item) => item.bucketId === "a")).map((item) => item.id), ["two", "one"]);
    assert.equal((await request("/api/tasks/one/move", { bucketId: "b", beforeTaskId: null })).status, 200);
    assert.deepEqual(ordered(tasks.filter((item) => item.bucketId === "b")).map((item) => item.id), ["three", "one"]);
  });
  await t.test("rejects unauthorized and invalid moves", async () => {
    reset();
    assert.equal((await request("/api/tasks/one/move", { bucketId: "b", beforeTaskId: null }, null)).status, 401);
    assert.equal((await request("/api/tasks/one/move", { bucketId: "other", beforeTaskId: null })).status, 404);
    assert.equal((await request("/api/tasks/one/move", { bucketId: "b", beforeTaskId: "two" })).status, 400);
    assert.equal(tasks.find((item) => item.id === "one").bucketId, "a");
  });
  await t.test("subtask order checks membership and ownership", async () => {
    reset();
    const url = "/api/tasks/one/subtasks/order";
    assert.equal((await request(url, { ids: ["s2", "s1"] }, "owner", "PUT")).status, 200);
    assert.deepEqual(ordered(subtasks).map((item) => item.id), ["s2", "s1"]);
    assert.equal((await request(url, { ids: ["s1"] }, "owner", "PUT")).status, 409);
    assert.equal((await request(url, { ids: ["s1", "s1"] }, "owner", "PUT")).status, 400);
    assert.equal((await request(url, { ids: ["s1", "s2"] }, "other", "PUT")).status, 404);
  });
  await t.test("failed writes roll back the whole move", async () => {
    reset();
    const before = structuredClone(tasks);
    failWrite = 2;
    assert.equal((await request("/api/tasks/one/move", { bucketId: "b", beforeTaskId: null })).status, 500);
    assert.deepEqual(tasks, before);
  });
});
