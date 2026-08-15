Project: TooDoo — React + TypeScript Todo App

## Purpose

Learning project: build a production-capable Todo app using React + TypeScript, a Node/Express backend, Postgres (Prisma), and authentication. Include basic AI agent features (suggestions, natural-language parsing) and deployment instructions so others can sign up and use the app.

## Goals

- Hands-on learning: React + TypeScript + Vite, Express + TypeScript, Prisma + Postgres.
- Secure auth flows (hosted provider recommended).
- Persisted per-user todo lists with CRUD operations.
- Small AI features that run server-side (OpenAI) for suggestions and parsing.
- Deployable: frontend on Vercel, backend on Render/Railway, managed Postgres.

## Stack

- Frontend: Vite + React + TypeScript, React Router, TanStack Query (react-query).
- Frontend: Vite + React + TypeScript, React Router, TanStack Query (react-query).
- Styling: Tailwind CSS for utility-first styling (recommended)
- Backend: Node + Express + TypeScript.
- DB/ORM: Postgres + Prisma (migrations + typed client).
- Auth: Hosted provider (Clerk or Auth0 recommended) — the backend verifies provider JWTs.
- AI: OpenAI API (server-side only).

## Prisma schema (core models)

Example models to start with:

model User {
id String @id @default(cuid())
email String @unique
createdAt DateTime @default(now())
todos Todo[]
}

model Todo {
id String @id @default(cuid())
userId String
title String
description String?
completed Boolean @default(false)
dueDate DateTime?
createdAt DateTime @default(now())
user User @relation(fields: [userId], references: [id])
}

## API surface (examples)

- POST /api/todos — create todo (auth required)
- GET /api/todos — list current user's todos
- PUT /api/todos/:id — update
- DELETE /api/todos/:id — delete
- POST /api/ai/suggest — server-side AI suggestions (rate-limited)

## Auth

- Use Clerk/Auth0 to avoid managing passwords. Frontend uses provider SDK for login; backend verifies JWT on every protected route.
- If you want to self-host auth for learning, implement email+password with bcrypt + JWT, but only for development.

## AI agent features (starter ideas)

- Suggest titles/descriptions from short input.
- Natural-language add: parse "remind me tomorrow to call Sam" → title + dueDate.
- Prioritization: rank todos by importance via model.
- Implementation note: call OpenAI from backend endpoints; never expose keys to frontend.

## Development & run commands

Frontend (Vite):

POSIX / Git Bash / WSL (unchanged):

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
# Install Tailwind CSS (POSIX)
npm install -D tailwindcss postcss autoprefixer
# Tailwind v4 steps:
# 1) Add the Tailwind directives to `src/index.css`:
#    @tailwind base;
#    @tailwind components;
#    @tailwind utilities;
# 2) Create `tailwind.config.cjs` (recommended):
#    module.exports = {
#      content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
#      theme: { extend: {} },
#      plugins: [],
#    }
# 3) Optional: create `postcss.config.cjs` when needed:
#    module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }
# 4) Import `src/index.css` in `src/main.tsx` (already typical in Vite templates).
npm run dev
```

Windows PowerShell (preferred on Windows):

```powershell
npm create vite@latest frontend -- --template react-ts
Set-Location frontend
npm install
# Install Tailwind CSS (PowerShell)
npm install -D tailwindcss postcss autoprefixer
# Tailwind v4 steps:
# 1) Add the Tailwind directives to `src/index.css`:
#    @tailwind base;
#    @tailwind components;
#    @tailwind utilities;
# 2) Create `tailwind.config.cjs` (recommended):
#    module.exports = {
#      content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
#      theme: { extend: {} },
#      plugins: [],
#    }
# 3) Optional: create `postcss.config.cjs` when needed:
#    module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }
# 4) Import `src/index.css` in `src/main.tsx` (already typical in Vite templates).
npm run dev
```

Backend (Express + TypeScript + Prisma):

POSIX / Git Bash / WSL:

```bash
mkdir backend && cd backend
npm init -y
npm i express cors dotenv prisma @prisma/client
npm i -D typescript ts-node-dev @types/express
npx prisma init
npm run dev
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory backend; Set-Location backend
npm init -y
npm i express cors dotenv prisma @prisma/client
npm i -D typescript ts-node-dev @types/express
npx prisma init
npm run dev
```

## Environment variables (examples)

- DATABASE_URL (Postgres connection)
- AUTH_PROVIDER_CLIENT_ID / AUTH_PROVIDER_SECRET (if using hosted auth)
- OPENAI_API_KEY (backend only)

## Deployment

- Postgres: provision a managed DB (Render Postgres, Supabase, ElephantSQL).
- Backend: deploy to Render/Railway/Fly; set env vars.
- Frontend: deploy to Vercel; configure auth provider redirect URIs.

## Milestones (suggested)

1. Scaffold frontend + backend, basic Hello World pages.
2. Set up Prisma models and DB migrations; implement CRUD API.
3. Integrate auth and protect API routes.
4. Build UI for todo CRUD and user flows.
5. Add a simple AI endpoint and wire to UI.
6. Deploy and test full flow.

## How to use this spec in future prompts

- Reference this file when asking for changes: link to the file: [TooDoo/spec.md](TooDoo/spec.md).
- Prefer focused requests: "Implement backend route POST /api/todos using Prisma and JWT auth" instead of vague "help backend".
- When asking for code, include the target file path and desired behavior. Example prompts:
  - "Create `backend/src/routes/todos.ts` implementing POST /api/todos (Prisma + auth)."
  - "Add a React page `frontend/src/pages/Todos.tsx` that lists todos using react-query."
  - "Add an AI endpoint `POST /api/ai/suggest` that calls OpenAI and returns 3 title suggestions."
- For debugging: include the failing file path, error message, and recent terminal output.
- To request deployment help: include provider choice and any error logs or dashboard links.

## Notes

- Keep secrets out of the repo. Use `.env` locally and provider env vars in production.
- Start simple; add AI features behind a feature flag once core flows work.
