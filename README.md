# Adaptive Sales Engine

A Vite + React + TypeScript application connected to Supabase, compatible with **local development**, **VS Code Dev Containers**, **Docker**, and the **Lovable** platform.

---

## 🔁 GitHub is the single source of truth

All changes — whether made in Lovable, VS Code, or GitHub Copilot — must go through this repository.

| Tool | How changes are saved |
|---|---|
| **Lovable** | Automatically commits & pushes to this repo on every save |
| **VS Code / local** | Manually run `git add . && git commit -m "..." && git push` |
| **GitHub Copilot agent** | Opens a PR; merge it to save changes |

Always **pull before you start working** locally to get the latest changes from Lovable:
```bash
git pull
```

---

## 🚀 Running locally (plain npm)

### Prerequisites
- Node.js **20+** and npm 10+ (use `.nvmrc` with [nvm](https://github.com/nvm-sh/nvm): `nvm use`)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/senarzuniga/adaptive-sales-engine.git
   cd adaptive-sales-engine
   ```

2. **Install dependencies**
   ```bash
   npm ci
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Then edit .env and fill in your Supabase credentials
   ```

4. **Start the dev server**
   ```bash
   npm run dev
   ```
   The app will be available at [http://localhost:8080](http://localhost:8080).

### Other commands

| Command | Description |
|---|---|
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |

---

## 🐳 Running with Docker

Docker gives you a consistent environment on any OS without installing Node locally.

### Dev mode (hot-reload)

```bash
cp .env.example .env   # fill in your Supabase credentials
docker compose up app-dev
```

The Vite dev server will be available at [http://localhost:8080](http://localhost:8080) with live hot-reload.

### Production build

```bash
docker compose --profile prod up --build app-prod
```

The production build is served by nginx at [http://localhost:3000](http://localhost:3000).

---

## 💻 VS Code Dev Container

Open the repo in VS Code and, when prompted, click **"Reopen in Container"** (requires the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)).

The devcontainer automatically:
- Uses Node 20
- Runs `npm ci` on startup
- Installs recommended VS Code extensions (ESLint, Tailwind, Prettier, etc.)
- Forwards port 8080 and opens a browser preview

---

## ☁️ Running on Lovable

This project is pre-configured for Lovable:
- `lovable-tagger` is included and activated automatically in development mode
- Supabase integration is wired up via the `supabase/` folder (migrations & edge functions)

Open the project in [Lovable](https://lovable.dev) and it will work out of the box once the Supabase environment variables are set in the Lovable project settings.

---

## 🔐 Environment variables

**Never commit `.env`** — it is listed in `.gitignore`.

Use `.env.example` as a template. Required variables:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase `anon` public key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |

On Lovable, set these in **Project Settings → Environment Variables**.

> **Note:** If any required variable is missing the app will throw a descriptive error at startup instead of crashing silently.

---

## ✅ CI/CD (GitHub Actions)

Every push and pull-request runs the `.github/workflows/ci.yml` pipeline:

1. Install dependencies (`npm ci`)
2. Lint (`npm run lint`)
3. Unit tests (`npm test`)
4. Production build (`npm run build`)
5. Docker image build (pushes to main only)

The workflow uses the Node version pinned in `.nvmrc` and caches npm for fast runs.

---

## 🧪 Testing

Tests are located in the `tests` directory. To run tests, use the following command:

```bash
npm test
```

Ensure that all tests pass before committing changes.
