# Bean WebApp Starter

A minimal React + Vite + TypeScript starter wired for Supabase auth. The layout and routing are intentionally generic so you can iterate quickly (add pages, contexts, or features like a canvas later).

## Project setup instructions

Run these commands in an empty folder to recreate this project:

```bash
npm create vite@latest . -- --template react-ts  # scaffold Vite + React + TS
npm install                                        # install dependencies
npm install @supabase/supabase-js react-router-dom # add Supabase + routing
```

Local development and production builds:

```bash
npm install   # install dependencies (first run only)
npm run dev   # start Vite dev server
npm run build # create production build (works for GitHub Pages)
```

## Environment variables

Create a `.env.local` (or `.env`) file in the project root. Vite exposes variables prefixed with `VITE_` to the client:

```bash
VITE_SUPABASE_URL=<my_supabase_url>
VITE_SUPABASE_ANON_KEY=<my_publishable_key>
```

These values are loaded via `import.meta.env`—they are **not** hard-coded in the codebase.

## Key architecture

- `src/lib/supabaseClient.ts`: Singleton Supabase client that reads Vite env vars.
- `src/context/AuthContext.tsx`: React Context provider that tracks auth state, exposes `signIn`, `signUp`, and `signOut`, and listens to `supabase.auth.onAuthStateChange`.
- `src/routes/ProtectedRoute.tsx`: Route guard that redirects guests to `/login`.
- `src/pages/`: Minimal placeholder pages (`LandingPage`, `LoginPage`, `RegisterPage`, `DashboardPage`).
- `src/App.tsx`: Centralized routing (`/`, `/login`, `/register`, `/app`).
- `src/main.tsx`: Mounts the app with `BrowserRouter` and `AuthProvider` so the entire tree can access auth state.

## Notes for extending

- Add new pages by placing components in `src/pages` and declaring routes in `src/App.tsx`.
- Add new providers (e.g., for a canvas editor) alongside `AuthProvider` inside `main.tsx`.
- The `DashboardPage` is a safe place to plug in future navigation, layout shells, or feature entry points.

