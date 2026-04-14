# Adaptive Sales Engine

A Vite + React + TypeScript application connected to Supabase, compatible with both **local development** and the **Lovable** platform.

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

## 🚀 Running locally

### Prerequisites
- Node.js 18+ and npm

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/senarzuniga/adaptive-sales-engine.git
   cd adaptive-sales-engine
   ```

2. **Install dependencies**
   ```bash
   npm install
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

