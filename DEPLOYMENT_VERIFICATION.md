# DEPLOYMENT VERIFICATION — Adaptive Sales Engine

> Last updated: 2026-05-06 · Streamlit Cloud deployment

---

## ✅ Test Summary

| Test | Description | Result |
|------|-------------|--------|
| 1.1 | Streamlit Cloud environment simulation | ✅ PASS |
| 1.2 | streamlit_app.py static analysis | ✅ PASS |
| 1.3 | Local execution simulation | ✅ PASS |
| 1.4 | Data upload (CSV) | ✅ PASS |
| 1.5 | Agent invocation (test_agent.py) | ✅ PASS |
| 1.6 | Session isolation (st.session_state) | ✅ PASS |
| 2.1 | requirements.txt updated | ✅ PASS |
| 2.2 | streamlit_app.py rewritten | ✅ PASS |
| 2.3 | Secrets documented | ✅ PASS |
| 2.4 | Agent path compatibility | ✅ PASS |

---

## 🗂️ Sidebar Structure (confirmed)

```
📈 Intelligence & Planning
├── 📊 Dashboard
├── 🔍 Business Intelligence
├── 💰 Budget Command Center
├── 📁 Portfolio Analysis
└── 📅 Weekly Planner

🎯 Core Sales Execution
├── 🏢 Saved Companies
├── ℹ️  Company Info
├── 🔄 360º Analysis
├── 🏗️ Sales Architecture
├── 🔑 Key Account Management
└── 📋 Commercial Actions Repository

⚙️ Sales Support & Enablement
├── 🤖 AI-Augmented Sales
├── 🧠 Behavioral Transform
├── 📦 Product Strategy
├── 📡 Monitoring
├── 💼 Offer & Pricing
└── 📤 Data Upload

🔄 After Sales
└── 🔧 After-Sales Engine

🏢 Backoffice & Operations
├── 👥 Team Directory        (admin only)
├── 📧 Email Cobot           (admin only)
├── 📰 Marketing Content
├── 📱 Social Media
├── 🗂️ Project Management
└── 💲 Cost & Rates

🤖 Autonomous Agents
└── ⚡ Agent Hub
```

---

## 📤 Data Upload — Formats Supported

| Category | Formats |
|----------|---------|
| Tabular | `.csv`, `.xlsx`, `.xls`, `.tsv`, `.parquet`, `.feather`, `.json`, `.jsonl` |
| Text | `.txt`, `.md`, `.html`, `.xml` |
| Documents | `.pdf` (pypdf), `.docx` (python-docx) |
| Images | `.png`, `.jpg`, `.jpeg`, `.bmp`, `.tiff` (pytesseract OCR, optional) |
| Archive | `.zip` (recursive unpacking) |
| Database | `.db`, `.sqlite` (SQLite first table) |
| URL | Direct JSON/CSV/XML via URL input |

All formats are converted to `pandas.DataFrame` and stored in
`st.session_state['uploaded_data_universal']`. The row limit is 100,000 rows
(truncated with a warning).

---

## 🤖 Agent Integration

Agents are discovered automatically from:
- `/agents/*.py`
- `/ai-factory-v2/*.py`

Agents receive data via:
- Environment variable: `AGENT_INPUT_FILE` → path to a CSV generated from the
  current `st.session_state['uploaded_data_universal']`
- Working directory: repository root

Agent output is captured from stdout/stderr, saved to `/outputs/<agent_name>_output.txt`,
and displayed in the **Agent Hub** module UI.

---

## 🔐 Supabase Secrets (Streamlit Cloud)

Add these in the Streamlit Cloud dashboard under **Settings → Secrets**:

```toml
SUPABASE_URL       = "https://your-project-ref.supabase.co"
SUPABASE_KEY       = "your-anon-key"
SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"  # optional, for User Invites
GMAIL_ADDRESS      = "your@gmail.com"                # optional, for Email Cobot
GMAIL_APP_PASSWORD = "your-app-password"             # optional, for Email Cobot
STREAMLIT_APP_URL  = "https://your-app.streamlit.app"
QUICK_ACCESS_ENABLED    = false
FULL_ACCESS_ALL_USERS   = false
```

> ⚠️ Do **not** commit the real secrets file. The `.streamlit/secrets.toml` in
> this repository contains placeholder values only.

---

## 🚀 Sharing the App

Send this link to your colleagues at Ingecart:
**https://adaptive-sales-engine-nirorezuxa2w4fz5nkvkbt.streamlit.app/**

[![Open in Streamlit](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://adaptive-sales-engine-nirorezuxa2w4fz5nkvkbt.streamlit.app/)

---

## 🔁 Re-deploy

To force a re-deploy on Streamlit Cloud after pushing changes:
1. Visit: https://share.streamlit.io/senarzuniga/adaptive-sales-engine/main/streamlit_app.py
2. Click **"Reboot app"** in the top-right menu, or simply push a new commit to `main`.

---

*✅ App completamente funcional desde 2026-05-06. Side bar reorganizado. Gestión de datos operativa.*
