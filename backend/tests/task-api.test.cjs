const assert = require("node:assert/strict");
const { once } = require("node:events");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const express = require("express");

// Exercise the compiled Express routes and auth middleware with an in-memory
// database and fake Clerk sessions. No credentials or real database are used.
test("task completion and importance API", async (t) => {
  let task;
  let writes;
  let failUpdate;
  const subtask = { id: "subtask-1", isDone: false };
  const clerk = {
    clerkMiddleware: () => (req, _res, next) => {
      const userId = req.headers.authorization?.replace("Bearer ", "");
      req.auth = { isAuthenticated: Boolean(userId), userId };
      next();
    },
    getAuth: (req) => req.auth,
    clerkClient: { users: { getUser: () => assert.fail("User already exists") } },
  };
  const prisma = {
    user: { findUnique: async ({ where }) => ({ id: where.authId }) },
    bucket: {
      findFirst: async ({ where }) =>
        where.id === "bucket-1" && where.folder.userId === "owner"
          ? { id: "bucket-1" } : null,
    },
    task: {
      findFirst: async ({ where }) =>
        where.id === task.id && where.bucket.folder.userId === "owner" ? task : null,
      update: async ({ data }) => {
        if (failUpdate) throw new Error("Database unavailable");
        writes.push(data);
        task = { ...task, ...data };
        return task;
      },
      create: async ({ data }) => {
        writes.push(data);
        task = { id: "new-task", importance: "GREEN", isDone: false, ...data };
        return task;
      },
    },
  };

  let app;
  const fakeExpress = Object.assign(() => {
    app = express();
    app.set("env", "test");
    // Loading server.js normally starts port 4000. The test chooses a free port.
    app.listen = () => {};
    return app;
  }, { json: express.json });
  function loadCompiled(filename) {
    const exports = {};
    // Run a CommonJS wrapper in this realm so Express receives native Promises.
    const evaluate = vm.runInThisContext(
      `(function(exports, require, process, console) {\n${readFileSync(path.join(__dirname, "../dist", filename), "utf8")}\n})`,
      { filename },
    );
    evaluate(exports, (id) => {
        if (id === "@clerk/express") return clerk;
        if (id === "./prisma" || id === "../prisma") return prisma;
        if (id === "./middleware/auth") return loadCompiled("middleware/auth.js");
        if (id === "dotenv") return { config() {} };
        if (id === "express") return fakeExpress;
        return require(id);
      }, { env: {} }, { log() {}, error() {} });
    return exports;
  }
  loadCompiled("server.js");
  const server = express.application.listen.call(app, 0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  function reset() {
    task = { id: "task-1", title: "Learn APIs", isDone: false, importance: "AMBER" };
    writes = [];
    failUpdate = false;
  }
  async function request(body, { method = "PATCH", url = "/api/tasks/task-1", user = "owner" } = {}) {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${user}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // Express's JSON parser may reject a primitive body before our route runs,
    // returning HTML. We still check that such a request gets a 400 response.
    const text = await response.text();
    const result = response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text) : text;
    return { status: response.status, body: result };
  }

  await t.test("complete and reopen without changing importance or subtasks", async () => {
    reset();
    assert.equal((await request({ isDone: true })).body.isDone, true);
    const reopened = await request({ isDone: false });
    assert.equal(reopened.status, 200);
    assert.equal(reopened.body.isDone, false);
    assert.equal(reopened.body.importance, "AMBER");
    assert.equal(subtask.isDone, false);
    assert.equal(Object.keys(writes[1]).join(), "isDone");
  });
  await t.test("all importance levels and combined partial updates", async () => {
    reset();
    for (const importance of ["GREEN", "AMBER", "RED"]) {
      const result = await request({ importance });
      assert.equal(result.status, 200);
      assert.equal(result.body.importance, importance);
      assert.equal(result.body.isDone, false);
      assert.equal(result.body.title, "Learn APIs");
    }
    const combined = await request({ isDone: true, importance: "GREEN", title: "Ignored" });
    assert.equal(combined.body.isDone, true);
    assert.equal(combined.body.importance, "GREEN");
    assert.equal(combined.body.title, "Learn APIs");
  });
  await t.test("invalid or empty updates never write to the database", async () => {
    reset();
    for (const body of [{}, null, [], undefined, { name: "Rename" }, { isDone: "false" },
      { isDone: 0 }, { isDone: null }, { importance: "red" }, { importance: null },
      { importance: 1 }, { isDone: true, importance: "INVALID" }]) {
      assert.equal((await request(body)).status, 400, JSON.stringify(body));
    }
    assert.equal(writes.length, 0);
  });
  await t.test("authentication and task ownership protect updates", async () => {
    reset();
    assert.equal((await request({ isDone: true }, { user: null })).status, 401);
    assert.equal((await request({ isDone: true }, { user: "other" })).status, 404);
    assert.equal((await request({ isDone: true }, { url: "/api/tasks/missing" })).status, 404);
    assert.equal(writes.length, 0);
  });
  await t.test("creation accepts importance and preserves schema defaults", async () => {
    const options = { method: "POST", url: "/api/buckets/bucket-1/tasks" };
    for (const importance of [undefined, "GREEN", "AMBER", "RED"]) {
      reset();
      const result = await request({ name: " New task ", importance }, options);
      assert.equal(result.status, 201);
      assert.equal(result.body.title, "New task");
      assert.equal(result.body.importance, importance ?? "GREEN");
      assert.equal(result.body.isDone, false);
      assert.equal(Object.hasOwn(writes[0], "isDone"), false);
      assert.equal(Object.hasOwn(writes[0], "importance"), importance !== undefined);
    }
    reset();
    for (const importance of [null, "HIGH", "green", 1]) {
      assert.equal((await request({ name: "Task", importance }, options)).status, 400);
    }
    assert.equal((await request({ name: "Task" }, { ...options, user: "other" })).status, 404);
    assert.equal(writes.length, 0);
  });
  await t.test("existing rename route preserves status and importance", async () => {
    reset();
    const result = await request({ name: " Renamed " }, { method: "PUT" });
    assert.equal(result.status, 200);
    assert.equal(result.body.title, "Renamed");
    assert.equal(result.body.isDone, false);
    assert.equal(result.body.importance, "AMBER");
  });
  await t.test("database failure returns 500", async () => {
    reset();
    failUpdate = true;
    assert.equal((await request({ isDone: true })).status, 500);
  });
});
