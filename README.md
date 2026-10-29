# Voodoo

Voodoo is a full-stack task manager for organizing work into **folders**, **buckets**, **tasks**, and **subtasks**. It combines a daily dashboard with a calendar and progress tracking, so you can see what needs attention and how your projects are moving along.

## Features

- **Home dashboard:** See overdue tasks, tasks due today and in the next seven days, and progress for active buckets. Complete tasks directly from the dashboard.
- **Folders and buckets:** Group related work, create and rename items inline, and organize tasks with drag-and-drop or automatic sorting.
- **Tasks and subtasks:** Add descriptions, due dates, and color-coded importance. Mark items complete and reorder tasks or subtasks.
- **Progress tracking:** A task's percentage reflects its completed subtasks; a task marked complete always shows 100%. Bucket progress is the average of its tasks' percentages.
- **Calendar:** View task deadlines by month and select a day to see its tasks.
- **Personal workspace:** Sign in with Clerk; each user has their own workspace and receives a starter workspace on their first sign-in.
- **Responsive interface:** Use the app on desktop or mobile, with light and dark themes and reduced-motion support.

## Technologies

### Frontend

- **React and TypeScript** build the interface and provide type checking.
- **Vite** runs the development server and builds the frontend.
- **React Router** handles page navigation.
- **Tailwind CSS** styles the interface.
- **TanStack Query** loads and caches workspace data, including optimistic updates and rollback when a save fails.
- **Clerk** handles sign-in and supplies authentication tokens for API requests.
- **dnd-kit** provides drag-and-drop sorting; **FullCalendar** powers the calendar; **Lucide** supplies icons.

### Backend

- **Node.js, Express, and TypeScript** provide the API.
- **Prisma** maps application data to a **PostgreSQL** database and manages schema migrations.
- **Clerk Express** verifies authentication; API routes use the signed-in user's workspace.

The frontend and API run as separate processes. The frontend sends authenticated requests to the API, and the API reads and writes the user's data in PostgreSQL.

## Getting started

### Prerequisites

- Node.js **22.12 or later in the 22.x series**, or Node.js **24 or later**, and npm.
- A PostgreSQL database and its connection URL.
- A Clerk application with a publishable key and secret key.

### 1. Install dependencies

From the project root, install the frontend and backend dependencies:

```sh
npm ci
cd backend
npm ci
```

### 2. Configure environment variables

Create `backend/.env` using [backend/.env.example](backend/.env.example) as a guide:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
PORT=4000
```

Create `.env.local` in the project root for the frontend:

```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_BASE_URL=http://localhost:4000
```

Use the keys from the same Clerk application in both files. `PORT` and `VITE_API_BASE_URL` are optional when using the default API address, `http://localhost:4000`. Keep the Clerk secret key in the backend environment only; never put it in a `VITE_` variable or commit it to the repository.

### 3. Prepare the database

With your database running and `backend/.env` configured, run these commands from the `backend` directory:

```sh
npx prisma generate
npx prisma migrate deploy
```

### 4. Run the app

Start the API from the `backend` directory:

```sh
npm run dev
```

In a second terminal, start the frontend from the project root:

```sh
npm run dev
```

Open the local URL printed by Vite, then sign in. The backend listens on port 4000 unless `PORT` is set.

## Project structure

```text
src/                  React pages, components, hooks, and shared helpers
backend/src/          Express API and authentication middleware
backend/prisma/       Prisma schema and database migrations
tests/                Frontend helper tests and browser fixtures
backend/tests/        Backend tests
```

## Checks

From the project root:

```sh
npm run build
npm run lint
node --test tests/due-dates.test.cjs tests/completion-progress.test.cjs tests/home-dashboard.test.cjs
```

Run the backend test suite from the `backend` directory:

```sh
npm test
```

The browser checks in `tests/*.browser.cjs` use fixture data and require a Vite server on port 5178, Playwright, and Microsoft Edge. See the comments in the individual files for their setup.
