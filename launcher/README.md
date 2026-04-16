# 🚀 App Launcher

A zero-dependency, Python-based desktop launcher that lets you start, stop, and monitor any local project from a single window.

---

## 📂 Files

| File | Purpose |
|---|---|
| `launcher.py` | Main GUI application (Python 3.8+ / tkinter) |
| `apps_config.json` | Defines the list of apps and how to start them |
| `run_launcher.bat` | Windows double-click entry point |
| `icons/` | Optional `.ico` file for the window icon |

---

## ⚡ Quick Start (Windows)

1. **Open** `launcher/` in File Explorer  
2. **Double-click** `run_launcher.bat`  
3. A window appears — click **▶ Start** next to any app

### Prerequisites

- Python 3.8 or newer on `PATH`  
  Download: https://www.python.org/downloads/
- The projects listed in `apps_config.json` must already be checked out locally

> No extra Python packages are needed — only `tkinter` (bundled with Python).

---

## 🖥️ Creating a Desktop Shortcut (Windows)

1. Right-click `run_launcher.bat` → **Send to → Desktop (create shortcut)**
2. Right-click the new shortcut → **Properties → Change Icon** → browse to `icons/launcher.ico`
3. Rename the shortcut to **My Apps Launcher**
4. Double-click the icon on the desktop to launch

---

## ⚙️ Configuring Apps (`apps_config.json`)

```json
{
  "apps": [
    {
      "name": "My App",
      "path": "C:/Users/you/projects/my-app",
      "command": "npm run dev",
      "port": 3000,
      "description": "Optional human-readable description"
    }
  ]
}
```

| Field | Required | Description |
|---|---|---|
| `name` | ✅ | Display name in the launcher |
| `path` | ✅ | Absolute or relative (to repo root) working directory |
| `command` | ✅ | Shell command to start the app |
| `port` | ☑️ | If set, a **🌐 Open** button appears to launch `http://localhost:<port>` |
| `description` | ☑️ | Short description shown below the name |

### Relative paths

If `path` is relative (e.g. `"."` or `"backend"`), it is resolved relative to the **repository root** (the parent of `launcher/`).

---

## 📊 Document Ingestion Monitor

A Streamlit monitor is included at [launcher/ingestion_monitor.py](launcher/ingestion_monitor.py).

### Start it manually

```bash
pip install -r launcher/requirements-streamlit.txt
python -m streamlit run launcher/ingestion_monitor.py --server.port 8502
```

The monitor shows:
- uploaded documents and processing status
- parsed document structure
- extracted entities and data points
- relationships graph and ingestion-run preview

---

## 🎛️ Features

| Feature | Details |
|---|---|
| **Start** | Runs the command in the given working directory |
| **Stop** | Terminates the process (and its child processes) |
| **🌐 Open** | Opens `http://localhost:<port>` in the default browser |
| **Status badge** | Shows Stopped / Running / Error |
| **Live log panel** | Streams stdout + stderr from all running apps simultaneously |
| **Search / filter** | Type in the search box to filter visible apps |
| **Stop All** | One-click button to terminate every running process |
| **Auto-trim log** | Keeps the last 2 000 lines to avoid memory growth |

---

## 🛠️ Running without the `.bat` file

```bash
# Any OS
python launcher/launcher.py

# Custom config path
python launcher/launcher.py /path/to/my_apps.json
```

---

## 🔧 Adding/Removing Apps

Edit `apps_config.json` — no code changes needed. Restart the launcher to pick up the new config.

---

## 🪟 Example Window

```
┌──────────────────────────────────────────────────────┐
│ 🚀  App Launcher       Click ▶ Start to launch any app│
├──────────────────────────────────────────────────────┤
│ 🔍 [search…                   ]                      │
├──────────────────────────────────────────────────────┤
│ Next.js Frontend (dev)          ● Stopped  ▶  ■  🌐  │
│ Vite + React SPA – hot-reload                        │
├──────────────────────────────────────────────────────┤
│ FastAPI Backend (dev)           ● Running  ▶  ■  🌐  │
│ Python FastAPI – auto-reload                         │
├──────────────────────────────────────────────────────┤
│ 📋 Live Log                              [Clear]      │
│ [FastAPI Backend] INFO: Application startup complete  │
│ [FastAPI Backend] INFO: Uvicorn running on :8000      │
├──────────────────────────────────────────────────────┤
│              ⏹  Stop All Apps                        │
└──────────────────────────────────────────────────────┘
```
