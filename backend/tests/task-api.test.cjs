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
  let subtask;
  let subtaskWrites;
  let failSubtaskUpdate;
  let maxPosition;
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
      aggregate: async ({ where, _max }) => {
        assert.equal(where.bucketId, "bucket-1");
        assert.equal(_max.position, true);
        return { _max: { position: maxPosition } };
      },
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
        maxPosition = data.position;
        task = { id: "new-task", importance: "GREEN", isDone: false, ...data };
        return task;
      },
    },
    subtask: {
      findFirst: async ({ where }) =>
        where.id === subtask.id && where.task.bucket.folder.userId === "owner" ? subtask : null,
      update: async ({ data }) => {
        if (failSubtaskUpdate) throw new Error("Database unavailable");
        subtaskWrites.push(data);
        subtask = { ...subtask, ...data };
        return subtask;
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
        if (id === "./dueDate") return loadCompiled("dueDate.js");
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
    subtask = { id: "subtask-1", title: "Read the docs", taskId: "task-1", isDone: false };
    writes = [];
    subtaskWrites = [];
    failUpdate = false;
    failSubtaskUpdate = false;
    maxPosition = null;
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
  await t.test("complete and reopen a subtask without changing its title or parent", async () => {
    reset();
    const options = { url: "/api/subtasks/subtask-1" };
    for (const isDone of [true, false]) {
      const result = await request({ isDone, name: "Ignored rename" }, options);
      assert.equal(result.status, 200);
      assert.equal(result.body.isDone, isDone);
      assert.equal(result.body.title, "Read the docs");
      assert.equal(result.body.taskId, "task-1");
      assert.deepEqual(subtaskWrites.at(-1), { isDone });
      assert.equal(task.isDone, false);
      assert.equal(writes.length, 0);
    }
  });
  await t.test("subtask completion rejects invalid or missing booleans before writing", async () => {
    reset();
    for (const body of [{}, { isDone: "false" }, { isDone: 1 }, { isDone: null }, { name: "Rename" }]) {
      assert.equal((await request(body, { url: "/api/subtasks/subtask-1" })).status, 400);
    }
    assert.equal(subtaskWrites.length, 0);
  });
  await t.test("subtask completion requires authentication and ownership", async () => {
    reset();
    const options = { url: "/api/subtasks/subtask-1" };
    assert.equal((await request({ isDone: true }, { ...options, user: null })).status, 401);
    assert.equal((await request({ isDone: true }, { ...options, user: "other" })).status, 404);
    assert.equal((await request({ isDone: true }, { url: "/api/subtasks/missing" })).status, 404);
    assert.equal(subtaskWrites.length, 0);
  });
  await t.test("a failed subtask save returns 500 and preserves its status", async () => {
    reset();
    failSubtaskUpdate = true;
    assert.equal((await request({ isDone: true }, { url: "/api/subtasks/subtask-1" })).status, 500);
    assert.equal(subtask.isDone, false);
    assert.equal(subtaskWrites.length, 0);
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
    for (const body of [{}, null, [], undefined, { name: "   " }, { description: 42 },
      { dueDate: "2026-02-30" }, { isDone: "false" }, { isDone: 0 }, { isDone: null },
      { importance: "red" }, { importance: null }, { importance: 1 },
      { isDone: true, importance: "INVALID" }]) {
      assert.equal((await request(body)).status, 400, JSON.stringify(body));
    }
    assert.equal(writes.length, 0);
  });
  await t.test("editing task details preserves fields that were omitted", async () => {
    reset();
    const updated = await request({
      name: " Ship the release ",
      description: " Review the final checklist. ",
      dueDate: "2028-02-29",
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.title, "Ship the release");
    assert.equal(updated.body.description, "Review the final checklist.");
    assert.equal(updated.body.dueDate, "2028-02-29T00:00:00.000Z");
    assert.equal(updated.body.importance, "AMBER");
    assert.equal(updated.body.isDone, false);

    const cleared = await request({ description: "   ", dueDate: null });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.description, null);
    assert.equal(cleared.body.dueDate, null);
    assert.equal(cleared.body.title, "Ship the release");
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
  await t.test("creation appends to the bucket's saved order", async () => {
    reset();
    const options = { method: "POST", url: "/api/buckets/bucket-1/tasks" };
    assert.equal((await request({ name: "First" }, options)).body.position, 0);
    assert.equal((await request({ name: "Second" }, options)).body.position, 1);
    maxPosition = 12;
    assert.equal((await request({ name: "After reordered tasks" }, options)).body.position, 13);
  });
  await t.test("creation accepts optional description and due date", async () => {
    reset();
    const options = { method: "POST", url: "/api/buckets/bucket-1/tasks" };
    const created = await request({
      name: " Plan release ",
      description: " Prepare the release notes. ",
      dueDate: "2026-12-31",
      importance: "RED",
    }, options);
    assert.equal(created.status, 201);
    assert.equal(created.body.title, "Plan release");
    assert.equal(created.body.description, "Prepare the release notes.");
    assert.equal(created.body.dueDate, "2026-12-31T00:00:00.000Z");
    assert.equal(created.body.importance, "RED");
    assert.equal(writes[0].dueDate.toISOString(), "2026-12-31T00:00:00.000Z");

    reset();
    const blankDescription = await request({ name: "Task", description: "   ", dueDate: null }, options);
    assert.equal(blankDescription.status, 201);
    assert.equal(blankDescription.body.description, null);
    assert.equal(blankDescription.body.dueDate, null);
  });
  await t.test("creation rejects invalid description and due date values", async () => {
    const options = { method: "POST", url: "/api/buckets/bucket-1/tasks" };
    for (const body of [
      { name: "Task", description: 42 },
      { name: "Task", description: {} },
      { name: "Task", dueDate: "2026-02-30" },
      { name: "Task", dueDate: "31/12/2026" },
    ]) {
      reset();
      assert.equal((await request(body, options)).status, 400);
      assert.equal(writes.length, 0);
    }
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

  await t.test("due dates save at UTC midnight, change, and clear without changing other fields", async () => {
    reset();
    const options = { url: "/api/tasks/task-1/due-date" };
    for (const day of ["2028-02-29", "2026-12-31", "2027-01-01"]) {
      const result = await request({ dueDate: day, isDone: true }, options);
      assert.equal(result.status, 200);
      assert.equal(result.body.dueDate, `${day}T00:00:00.000Z`);
      assert.equal(result.body.isDone, false);
      assert.equal(result.body.importance, "AMBER");
      assert.equal(Object.keys(writes.at(-1)).join(), "dueDate");
    }
    const cleared = await request({ dueDate: null }, options);
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.dueDate, null);
  });

  await t.test("invalid and omitted due dates never reach a database write", async () => {
    reset();
    const options = { url: "/api/tasks/task-1/due-date" };
    for (const dueDate of [undefined, "", "2026-02-29", "2026-02-30", "2026-04-31",
      "2026-13-01", "2026-00-01", "2026-01-00", "12/10/2026", "2026-1-1",
      "2026-10-12T00:00:00Z", "0000-01-01", 123, true, {}, []]) {
      assert.equal((await request({ dueDate }, options)).status, 400, JSON.stringify(dueDate));
    }
    assert.equal(writes.length, 0);
  });

  await t.test("due-date endpoint requires authentication, ownership, and reports database failures", async () => {
    reset();
    const body = { dueDate: "2026-10-12" };
    const options = { url: "/api/tasks/task-1/due-date" };
    assert.equal((await request(body, { ...options, user: null })).status, 401);
    assert.equal((await request(body, { ...options, user: "other" })).status, 404);
    assert.equal((await request(body, { url: "/api/tasks/missing/due-date" })).status, 404);
    assert.equal(writes.length, 0);
    failUpdate = true;
    assert.equal((await request(body, options)).status, 500);
  });
});
