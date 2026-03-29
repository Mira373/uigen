# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language, Claude generates the code, and changes appear in a live preview via a virtual file system.

## Code Style

Use comments sparingly. Only comment complex code.

## Commands

```bash
npm run setup    # install deps, generate Prisma client, run migrations
npm run dev      # start dev server with Turbopack
npm run build
npm run lint
npm run test
npm run db:reset # destructive
```

**Run a single test:**
```bash
npx vitest run src/path/to/file.test.ts
```

**Environment:** Copy `.env` and set `ANTHROPIC_API_KEY`. If absent, the app falls back to a `MockLanguageModel` that generates static example code.

## Architecture

### Key Data Flow

1. User sends a message in the chat UI
2. `POST /api/chat` receives messages + serialized virtual file system state
3. The route reconstructs the VFS, calls Claude (or mock) with streaming + tool use
4. Claude uses `str_replace_editor` and `file_manager` tools to create/modify files
5. Tool calls are streamed back and executed on the client via `FileSystemContext`
6. The live preview re-renders from the updated VFS
7. On completion, project state is auto-saved to SQLite via Prisma

### Virtual File System (`src/lib/file-system.ts`)

All files exist in memory — nothing is written to disk. The `VirtualFileSystem` class handles full file/directory CRUD and is serialized to JSON for database persistence and sent with each API request so the server can reconstruct state.

- Generated code must use `/App.jsx` as the entry point
- Imports use `@/` aliases (e.g., `@/components/Button`)

### AI Provider (`src/lib/provider.ts`)

`getLanguageModel()` returns a real `claude-haiku-4-5` model or `MockLanguageModel` (no API key needed). The mock generates a predictable 4-step component example.

### Two AI Tools (`src/lib/tools/`)

- `str_replace_editor` — view, create, str_replace, insert operations on files
- `file_manager` — file system management (rename, delete, list)

### State Management

Two React contexts in `src/lib/contexts/`:
- `FileSystemContext` — owns the VFS instance, executes incoming tool calls, tracks selected file
- `ChatContext` — owns chat messages and streaming state

### API Route (`src/app/api/chat/route.ts`)

- Streams with max 10,000 tokens; up to 40 tool-use steps (4 for mock)
- 120s timeout
- Auto-saves project after streaming completes; associates with user if authenticated

### Auth (`src/lib/auth.ts`)

JWT sessions (7-day expiry) in HttpOnly cookies. Server actions in `src/actions/` handle sign up/in/out. Projects support anonymous usage (`userId` is nullable).

### Database

Database schema is defined in `prisma/schema.prisma` — reference it anytime you need to understand the structure of the data.

SQLite via Prisma. Schema: `User` → many `Project`. Projects store `messages` and VFS `data` as JSON strings.

### Path Alias

`@/*` maps to `./src/*` (configured in `tsconfig.json` and `components.json`).

## Tech Stack

- **Next.js 15** (App Router) + **React 19**
- **Tailwind CSS v4** + **shadcn/ui** (new-york style)
- **Vercel AI SDK** (`ai` package) for streaming and tool use
- **Monaco Editor** for in-browser code editing
- **Prisma** + SQLite
- **Vitest** + React Testing Library

## Node Compatibility

`node-compat.cjs` is required via `NODE_OPTIONS` in all npm scripts. It removes `localStorage`/`sessionStorage` globals during SSR to fix a Node 25+ incompatibility.
