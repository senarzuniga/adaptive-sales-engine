"""
launcher.py — Universal Local Application Launcher
====================================================
Reads apps_config.json and shows a tkinter window with:
  • One row per app (Start / Stop buttons + status badge)
  • A live log panel (stdout/stderr streamed from each process)
  • A search/filter bar at the top

Usage
-----
  python launcher.py                   # looks for apps_config.json next to this file
  python launcher.py path/to/cfg.json  # custom config path

Windows quick-start
-------------------
  Double-click run_launcher.bat
"""

import json
import os
import re
import subprocess
import sys
import threading
import time
import tkinter as tk
import webbrowser
from pathlib import Path
from tkinter import font as tkfont
from tkinter import scrolledtext, ttk

# ─── Constants ────────────────────────────────────────────────────────────────

DEFAULT_CONFIG = Path(__file__).parent / "apps_config.json"
POLL_MS = 500          # how often (ms) to check if a process is still alive
LOG_MAX_LINES = 2000   # maximum lines kept in the log panel before trimming

# Status badge colours (background, foreground)
COLOUR_STOPPED = ("#d1d5db", "#374151")   # grey
COLOUR_RUNNING = ("#bbf7d0", "#14532d")   # green
COLOUR_ERROR   = ("#fecaca", "#7f1d1d")   # red

# ─── Helpers ──────────────────────────────────────────────────────────────────


def _resolve_path(raw: str) -> Path:
    """Return an absolute Path, treating '.' as the repository root
    (two levels above this file: launcher/ → repo root)."""
    p = Path(raw)
    if not p.is_absolute():
        repo_root = Path(__file__).parent.parent
        p = repo_root / p
    return p.resolve()


def _load_config(cfg_path: Path) -> list[dict]:
    """Load and validate apps_config.json, returning the list of app dicts."""
    if not cfg_path.exists():
        raise FileNotFoundError(f"Config not found: {cfg_path}")
    with cfg_path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    apps = data.get("apps", [])
    for app in apps:
        for required in ("name", "path", "command"):
            if required not in app:
                raise ValueError(f"App entry missing '{required}': {app}")
    return apps


def _open_browser(port: int) -> None:
    """Open the default browser at http://localhost:<port> after a short delay."""
    def _open():
        time.sleep(1.5)
        webbrowser.open(f"http://localhost:{port}")
    threading.Thread(target=_open, daemon=True).start()


# ─── AppRow ───────────────────────────────────────────────────────────────────


class AppRow:
    """Manages one row in the UI: the app's label, buttons, and badge."""

    def __init__(self, parent_frame: tk.Frame, cfg: dict, log_fn, row: int) -> None:
        self.cfg     = cfg
        self.log     = log_fn    # callback: log_fn(app_name, text)
        self.process: subprocess.Popen | None = None
        self._reader_thread: threading.Thread | None = None

        # ── Name + description ────────────────────────────────────────────────
        name_frame = tk.Frame(parent_frame, bg="#ffffff")
        name_frame.grid(row=row, column=0, sticky="w", padx=(12, 4), pady=6)

        tk.Label(
            name_frame,
            text=cfg["name"],
            font=("Segoe UI", 10, "bold"),
            bg="#ffffff",
            anchor="w",
        ).pack(anchor="w")

        if cfg.get("description"):
            tk.Label(
                name_frame,
                text=cfg["description"],
                font=("Segoe UI", 8),
                fg="#6b7280",
                bg="#ffffff",
                anchor="w",
            ).pack(anchor="w")

        # ── Status badge ──────────────────────────────────────────────────────
        self._badge = tk.Label(
            parent_frame,
            text="  Stopped  ",
            font=("Segoe UI", 8, "bold"),
            bg=COLOUR_STOPPED[0],
            fg=COLOUR_STOPPED[1],
            relief="flat",
            padx=6,
            pady=2,
        )
        self._badge.grid(row=row, column=1, padx=8, pady=6)

        # ── Buttons ───────────────────────────────────────────────────────────
        btn_frame = tk.Frame(parent_frame, bg="#ffffff")
        btn_frame.grid(row=row, column=2, padx=(4, 12), pady=6)

        self._start_btn = tk.Button(
            btn_frame,
            text="▶  Start",
            command=self.start,
            bg="#2563eb",
            fg="#ffffff",
            activebackground="#1d4ed8",
            activeforeground="#ffffff",
            relief="flat",
            padx=10,
            pady=4,
            cursor="hand2",
        )
        self._start_btn.pack(side="left", padx=(0, 6))

        self._stop_btn = tk.Button(
            btn_frame,
            text="■  Stop",
            command=self.stop,
            bg="#ef4444",
            fg="#ffffff",
            activebackground="#dc2626",
            activeforeground="#ffffff",
            relief="flat",
            padx=10,
            pady=4,
            cursor="hand2",
            state="disabled",
        )
        self._stop_btn.pack(side="left")

        if cfg.get("port"):
            tk.Button(
                btn_frame,
                text="🌐 Open",
                command=lambda: _open_browser(cfg["port"]),
                bg="#059669",
                fg="#ffffff",
                activebackground="#047857",
                activeforeground="#ffffff",
                relief="flat",
                padx=8,
                pady=4,
                cursor="hand2",
            ).pack(side="left", padx=(6, 0))

        # separator line
        ttk.Separator(parent_frame, orient="horizontal").grid(
            row=row + 100,  # drawn after all rows via a post-loop call
            column=0, columnspan=3, sticky="ew",
        )

    # ── Visibility ────────────────────────────────────────────────────────────

    def show(self) -> None:
        for widget in self._badge.master.grid_slaves():
            pass  # grid slaves iteration; visibility managed by LauncherApp

    # ── Process lifecycle ─────────────────────────────────────────────────────

    def start(self) -> None:
        if self.process and self.process.poll() is None:
            return  # already running

        work_dir = _resolve_path(self.cfg["path"])
        cmd      = self.cfg["command"]

        self.log(self.cfg["name"], f"→ cwd:  {work_dir}")
        self.log(self.cfg["name"], f"→ cmd:  {cmd}\n")

        try:
            # On Windows use 'cmd /c' so PATH is resolved correctly
            if sys.platform == "win32":
                full_cmd = ["cmd", "/c", cmd]
                create_flags = subprocess.CREATE_NEW_PROCESS_GROUP
            else:
                full_cmd = ["bash", "-c", cmd]
                create_flags = 0

            self.process = subprocess.Popen(
                full_cmd,
                cwd=str(work_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                text=True,
                creationflags=create_flags if sys.platform == "win32" else 0,
            )
        except Exception as exc:
            self._set_status("error")
            self.log(self.cfg["name"], f"[ERROR] Failed to start: {exc}\n")
            return

        self._set_status("running")
        self._start_btn.config(state="disabled")
        self._stop_btn.config(state="normal")

        # Stream stdout/stderr in a background thread
        self._reader_thread = threading.Thread(
            target=self._stream_output, daemon=True
        )
        self._reader_thread.start()

        # Poll for process exit
        self._poll()

    def stop(self) -> None:
        if not self.process:
            return
        self.log(self.cfg["name"], "→ stopping process…\n")
        try:
            if sys.platform == "win32":
                # Windows: terminate the whole process group
                subprocess.call(
                    ["taskkill", "/F", "/T", "/PID", str(self.process.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                import signal
                os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
        except Exception:
            self.process.kill()
        self._on_stopped()

    def _stream_output(self) -> None:
        """Read stdout (merged with stderr) line by line and forward to the log."""
        assert self.process and self.process.stdout
        for line in self.process.stdout:
            self.log(self.cfg["name"], line)

    def _poll(self) -> None:
        """Re-schedule itself every POLL_MS ms to check if the process exited."""
        if self.process and self.process.poll() is not None:
            returncode = self.process.returncode
            if returncode == 0:
                self.log(self.cfg["name"], f"[DONE] process exited (code {returncode})\n")
            else:
                self.log(self.cfg["name"], f"[WARN] process exited (code {returncode})\n")
            self._on_stopped()
        else:
            # Still running – check again later
            self._badge.after(POLL_MS, self._poll)

    def _on_stopped(self) -> None:
        self.process = None
        self._set_status("stopped")
        self._start_btn.config(state="normal")
        self._stop_btn.config(state="disabled")

    def _set_status(self, state: str) -> None:
        if state == "running":
            self._badge.config(text="  Running  ", bg=COLOUR_RUNNING[0], fg=COLOUR_RUNNING[1])
        elif state == "error":
            self._badge.config(text="   Error   ", bg=COLOUR_ERROR[0], fg=COLOUR_ERROR[1])
        else:
            self._badge.config(text="  Stopped  ", bg=COLOUR_STOPPED[0], fg=COLOUR_STOPPED[1])

    # ── Filter support ────────────────────────────────────────────────────────

    def matches(self, query: str) -> bool:
        q = query.lower().strip()
        if not q:
            return True
        return (
            q in self.cfg["name"].lower()
            or q in self.cfg.get("description", "").lower()
            or q in self.cfg["command"].lower()
        )


# ─── LauncherApp ──────────────────────────────────────────────────────────────


class LauncherApp:
    """Main window."""

    def __init__(self, root: tk.Tk, apps: list[dict]) -> None:
        self.root = root
        self.apps = apps
        self._rows: list[AppRow] = []

        root.title("App Launcher")
        root.configure(bg="#f3f4f6")
        root.resizable(True, True)
        root.minsize(700, 400)

        self._build_ui()

    # ── UI construction ───────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        # ── Header ────────────────────────────────────────────────────────────
        header = tk.Frame(self.root, bg="#1e3a5f", pady=12)
        header.pack(fill="x")
        tk.Label(
            header,
            text="🚀  App Launcher",
            font=("Segoe UI", 16, "bold"),
            fg="#ffffff",
            bg="#1e3a5f",
        ).pack(side="left", padx=16)
        tk.Label(
            header,
            text="Click ▶ Start to launch any app",
            font=("Segoe UI", 9),
            fg="#93c5fd",
            bg="#1e3a5f",
        ).pack(side="left", padx=4)

        # ── Search bar ────────────────────────────────────────────────────────
        search_frame = tk.Frame(self.root, bg="#f3f4f6", pady=6)
        search_frame.pack(fill="x", padx=12)
        tk.Label(search_frame, text="🔍", bg="#f3f4f6", font=("Segoe UI", 10)).pack(side="left")
        self._search_var = tk.StringVar()
        self._search_var.trace_add("write", self._on_search)
        tk.Entry(
            search_frame,
            textvariable=self._search_var,
            font=("Segoe UI", 10),
            relief="flat",
            bg="#ffffff",
            highlightthickness=1,
            highlightbackground="#d1d5db",
            highlightcolor="#2563eb",
            width=40,
        ).pack(side="left", padx=6, ipady=4)

        # ── App list ──────────────────────────────────────────────────────────
        list_container = tk.Frame(self.root, bg="#ffffff", relief="flat", bd=1)
        list_container.pack(fill="x", padx=12, pady=4)

        self._app_frame = tk.Frame(list_container, bg="#ffffff")
        self._app_frame.pack(fill="x")
        self._app_frame.columnconfigure(0, weight=1)

        for idx, cfg in enumerate(self.apps):
            row = AppRow(self._app_frame, cfg, self._append_log, row=idx)
            self._rows.append(row)
            # Separator
            ttk.Separator(self._app_frame, orient="horizontal").grid(
                row=idx, column=3, columnspan=1, sticky="", padx=0,
            )
            if idx < len(self.apps) - 1:
                sep = ttk.Separator(self._app_frame, orient="horizontal")
                sep.grid(row=idx, column=0, columnspan=3, sticky="ew", padx=8)

        # ── Log panel ─────────────────────────────────────────────────────────
        log_header = tk.Frame(self.root, bg="#f3f4f6")
        log_header.pack(fill="x", padx=12, pady=(8, 0))
        tk.Label(
            log_header,
            text="📋  Live Log",
            font=("Segoe UI", 9, "bold"),
            bg="#f3f4f6",
            fg="#374151",
        ).pack(side="left")
        tk.Button(
            log_header,
            text="Clear",
            command=self._clear_log,
            font=("Segoe UI", 8),
            bg="#e5e7eb",
            fg="#374151",
            relief="flat",
            padx=6,
            pady=2,
            cursor="hand2",
        ).pack(side="right")

        self._log = scrolledtext.ScrolledText(
            self.root,
            height=12,
            font=("Consolas", 9),
            bg="#111827",
            fg="#d1fae5",
            insertbackground="#d1fae5",
            state="disabled",
            relief="flat",
            wrap="word",
        )
        self._log.pack(fill="both", expand=True, padx=12, pady=(2, 12))

        # Coloured tags per app
        colours = [
            "#93c5fd", "#fde68a", "#a7f3d0", "#fca5a5",
            "#c4b5fd", "#fdba74", "#67e8f9", "#d9f99d",
        ]
        for idx, row in enumerate(self._rows):
            tag = f"app_{idx}"
            self._log.tag_config(tag, foreground=colours[idx % len(colours)])

        # ── Stop-all button ───────────────────────────────────────────────────
        tk.Button(
            self.root,
            text="⏹  Stop All Apps",
            command=self._stop_all,
            bg="#7f1d1d",
            fg="#ffffff",
            activebackground="#991b1b",
            activeforeground="#ffffff",
            relief="flat",
            padx=12,
            pady=6,
            cursor="hand2",
        ).pack(pady=(0, 10))

        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── Search ────────────────────────────────────────────────────────────────

    def _on_search(self, *_) -> None:
        query = self._search_var.get()
        for idx, row in enumerate(self._rows):
            widgets = self._app_frame.grid_slaves(row=idx)
            if row.matches(query):
                for w in widgets:
                    w.grid()
            else:
                for w in widgets:
                    w.grid_remove()

    # ── Log ───────────────────────────────────────────────────────────────────

    def _append_log(self, app_name: str, text: str) -> None:
        """Thread-safe: schedule log update on the main thread."""
        self.root.after(0, self._do_append_log, app_name, text)

    def _do_append_log(self, app_name: str, text: str) -> None:
        tag = next(
            (f"app_{i}" for i, r in enumerate(self._rows) if r.cfg["name"] == app_name),
            None,
        )
        self._log.config(state="normal")
        prefix = f"[{app_name}] "
        for line in text.splitlines(keepends=True):
            self._log.insert("end", prefix + line, tag or "")
        # Trim old lines
        lines = int(self._log.index("end-1c").split(".")[0])
        if lines > LOG_MAX_LINES:
            self._log.delete("1.0", f"{lines - LOG_MAX_LINES}.0")
        self._log.see("end")
        self._log.config(state="disabled")

    def _clear_log(self) -> None:
        self._log.config(state="normal")
        self._log.delete("1.0", "end")
        self._log.config(state="disabled")

    # ── Stop all ──────────────────────────────────────────────────────────────

    def _stop_all(self) -> None:
        for row in self._rows:
            if row.process and row.process.poll() is None:
                row.stop()

    def _on_close(self) -> None:
        self._stop_all()
        self.root.destroy()


# ─── Entry point ──────────────────────────────────────────────────────────────


def main() -> None:
    cfg_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CONFIG
    try:
        apps = _load_config(cfg_path)
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as exc:
        import tkinter.messagebox as mb
        root = tk.Tk()
        root.withdraw()
        mb.showerror("Launcher — Config Error", str(exc))
        sys.exit(1)

    root = tk.Tk()

    # Try to set a window icon (ignore if .ico not present)
    icon_path = Path(__file__).parent / "icons" / "launcher.ico"
    if icon_path.exists():
        try:
            root.iconbitmap(str(icon_path))
        except Exception:
            pass

    LauncherApp(root, apps)
    root.mainloop()


if __name__ == "__main__":
    main()
