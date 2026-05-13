#!/usr/bin/env bash
# autostart/macos_autostart.sh
# =====================================================================
# Configura el inicio automático del ACS en macOS mediante
# un LaunchAgent en ~/Library/LaunchAgents/ (no requiere sudo).
#
# Uso:
#   chmod +x autostart/macos_autostart.sh
#   ./autostart/macos_autostart.sh install     # instalar
#   ./autostart/macos_autostart.sh uninstall   # desinstalar
#   ./autostart/macos_autostart.sh status      # estado
#   ./autostart/macos_autostart.sh start        # iniciar ya
#   ./autostart/macos_autostart.sh stop         # detener
# =====================================================================

set -euo pipefail

BUNDLE_ID="com.acs.adaptive-sales-engine"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCH_SCRIPT="$REPO_ROOT/start_ecosystem.sh"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$LAUNCH_AGENTS_DIR/${BUNDLE_ID}.plist"
LOG_DIR="$HOME/Library/Logs/ACS"

ACTION="${1:-install}"

GREEN='\033[92m'; YELLOW='\033[93m'; RED='\033[91m'; CYAN='\033[96m'; RESET='\033[0m'

if [ ! -f "$LAUNCH_SCRIPT" ]; then
  echo -e "${RED}[ERROR] No se encontró start_ecosystem.sh en: $LAUNCH_SCRIPT${RESET}"
  exit 1
fi

case "$ACTION" in
  install)
    echo -e "${CYAN}Instalando LaunchAgent: $BUNDLE_ID${RESET}"

    mkdir -p "$LAUNCH_AGENTS_DIR"
    mkdir -p "$LOG_DIR"
    chmod +x "$LAUNCH_SCRIPT"

    # Detect Python path (needed in plist because PATH may be minimal at login)
    PYTHON_BIN=""
    for cmd in python3 python; do
      if command -v "$cmd" &>/dev/null; then
        PYTHON_BIN="$(command -v "$cmd")"
        break
      fi
    done

    cat > "$PLIST_FILE" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
    "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${BUNDLE_ID}</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${LAUNCH_SCRIPT}</string>
        <string>--detach</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${REPO_ROOT}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <false/>

    <key>StartInterval</key>
    <integer>0</integer>

    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${HOME}/.local/bin</string>
    </dict>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/acs_stdout.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/acs_stderr.log</string>
</dict>
</plist>
EOF

    # Unload if already loaded
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    launchctl load -w "$PLIST_FILE"

    echo ""
    echo -e "${GREEN}✅ LaunchAgent instalado y activado${RESET}"
    echo -e "   Archivo:  $PLIST_FILE"
    echo -e "   Logs:     $LOG_DIR/"
    echo -e "   El ACS arrancará automáticamente al iniciar sesión."
    echo ""
    echo -e "   Comandos útiles:"
    echo -e "   ${CYAN}launchctl start $BUNDLE_ID${RESET}"
    echo -e "   ${CYAN}launchctl stop  $BUNDLE_ID${RESET}"
    echo -e "   ${CYAN}tail -f $LOG_DIR/acs_stdout.log${RESET}"
    echo ""
    echo -e "${YELLOW}   Para desinstalar: ./autostart/macos_autostart.sh uninstall${RESET}"
    ;;

  uninstall)
    echo -e "${YELLOW}Desinstalando LaunchAgent: $BUNDLE_ID${RESET}"
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    rm -f "$PLIST_FILE"
    echo -e "${GREEN}✅ LaunchAgent desinstalado.${RESET}"
    ;;

  status)
    launchctl list | grep "$BUNDLE_ID" || echo "Servicio no activo."
    ;;

  start)
    echo -e "${CYAN}Iniciando $BUNDLE_ID...${RESET}"
    launchctl start "$BUNDLE_ID"
    echo -e "${GREEN}✅ Servicio iniciado.${RESET}"
    ;;

  stop)
    echo -e "${YELLOW}Deteniendo $BUNDLE_ID...${RESET}"
    launchctl stop "$BUNDLE_ID"
    echo -e "${GREEN}✅ Servicio detenido.${RESET}"
    ;;

  *)
    echo "Uso: $0 {install|uninstall|status|start|stop}"
    exit 1
    ;;
esac
