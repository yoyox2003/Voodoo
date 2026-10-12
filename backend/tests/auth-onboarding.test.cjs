const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadAuthMiddleware({ clerk, prisma }) {
  const exports = {};
  const filename = path.join(__dirname, "../dist/middleware/auth.js");
  const evaluate = vm.runInThisContext(
    `(function(exports, require) {\n${readFileSync(filename, "utf8")}\n})`,
    { filename },
  );
  evaluate(exports, (id) => {
    if (id === "@clerk/express") return clerk;
    if (id === "../prisma") return prisma;
    return require(id);
  });
  return exports.requireAppUser;
}

function newUserResponse() {
  return { id: "app-user-1", authId: "clerk-user-1", email: "new@example.com" };
}

test("first user receives one complete starter workspace", async () => {
  let upsertArguments;
  const clerk = {
    getAuth: () => ({ isAuthenticated: true, userId: "clerk-user-1" }),
    clerkClient: {
      users: { getUser: async () => ({ primaryEmailAddress: { emailAddress: "new@example.com" } }) },
    },
  };
  const prisma = {
    user: {
      findUnique: async () => null,
      upsert: async (arguments_) => {
        upsertArguments = arguments_;
        return newUserResponse();
      },
    },
  };
  const requireAppUser = loadAuthMiddleware({ clerk, prisma });
  const response = { locals: {}, status: () => response, json: () => response };
  let calledNext = false;

  await requireAppUser({}, response, () => { calledNext = true; });

  assert.equal(calledNext, true);
  assert.deepEqual(response.locals.user, newUserResponse());
  assert.deepEqual(upsertArguments.where, { authId: "clerk-user-1" });
  assert.deepEqual(upsertArguments.update, {});

  const [folder] = [upsertArguments.create.folders.create];
  assert.equal(folder.name, "Getting Started");
  assert.equal(folder.buckets.create.length, 3);
  assert.deepEqual(folder.buckets.create.map((bucket) => bucket.name), [
    "Start Here",
    "Organize Your Work",
    "Track Progress",
  ]);

  const tasks = folder.buckets.create.flatMap((bucket) => bucket.tasks.create);
  assert.equal(tasks.length, 8);
  assert.deepEqual(tasks.map((task) => task.importance), [
    "GREEN", "GREEN", "GREEN", "GREEN", "GREEN", "GREEN", "AMBER", "RED",
  ]);
  assert.deepEqual(tasks.flatMap((task) => task.subtasks?.create ?? []).map((subtask) => subtask.title), [
    "Read the task description",
    "Look below for the subtasks section",
    "Choose a clear action to complete",
    "Add it to the bucket where it belongs",
  ]);
  assert.equal(tasks.some((task) => "isDone" in task), false);
  assert.equal(tasks.flatMap((task) => task.subtasks?.create ?? []).some((subtask) => "isDone" in subtask), false);
});

test("existing users do not get a duplicate starter workspace", async () => {
  let clerkRequested = false;
  let upsertCalled = false;
  const existingUser = { id: "app-user-1", authId: "clerk-user-1", email: "existing@example.com" };
  const requireAppUser = loadAuthMiddleware({
    clerk: {
      getAuth: () => ({ isAuthenticated: true, userId: "clerk-user-1" }),
      clerkClient: { users: { getUser: async () => { clerkRequested = true; } } },
    },
    prisma: {
      user: {
        findUnique: async () => existingUser,
        upsert: async () => { upsertCalled = true; },
      },
    },
  });
  const response = { locals: {}, status: () => response, json: () => response };

  await requireAppUser({}, response, () => {});

  assert.deepEqual(response.locals.user, existingUser);
  assert.equal(clerkRequested, false);
  assert.equal(upsertCalled, false);
});

test("a failed nested create returns 500 without continuing the request", async () => {
  const requireAppUser = loadAuthMiddleware({
    clerk: {
      getAuth: () => ({ isAuthenticated: true, userId: "clerk-user-1" }),
      clerkClient: { users: { getUser: async () => ({ primaryEmailAddress: { emailAddress: "new@example.com" } }) } },
    },
    prisma: {
      user: {
        findUnique: async () => null,
        upsert: async () => { throw new Error("nested create failed"); },
      },
    },
  });
  const response = {
    locals: {},
    statusCode: undefined,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let calledNext = false;

  await requireAppUser({}, response, () => { calledNext = true; });

  assert.equal(calledNext, false);
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { error: "Could not prepare the authenticated user." });
});
