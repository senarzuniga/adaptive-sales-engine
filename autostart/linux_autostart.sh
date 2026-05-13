#!/usr/bin/env bash
# autostart/linux_autostart.sh
# =====================================================================
# Configura el inicio automático del ACS en Linux mediante
# un servicio systemd de usuario (no requiere sudo).
#
# Uso:
#   chmod +x autostart/linux_autostart.sh
#   ./autostart/linux_autostart.sh install     # instalar
#   ./autostart/linux_autostart.sh uninstall   # desinstalar
#   ./autostart/linux_autostart.sh status      # estado
#   ./autostart/linux_autostart.sh start        # iniciar ya
#   ./autostart/linux_autostart.sh stop         # detener
# =====================================================================

set -euo pipefail

SERVICE_NAME="adaptive-sales-engine"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCH_SCRIPT="$REPO_ROOT/start_ecosystem.sh"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SYSTEMD_USER_DIR/${SERVICE_NAME}.service"

ACTION="${1:-install}"

GREEN='\033[92m'; YELLOW='\033[93m'; RED='\033[91m'; CYAN='\033[96m'; RESET='\033[0m'

if [ ! -f "$LAUNCH_SCRIPT" ]; then
  echo -e "${RED}[ERROR] No se encontró start_ecosystem.sh en: $LAUNCH_SCRIPT${RESET}"
  exit 1
fi

# ── Detect Python ─────────────────────────────────────────────
PYTHON_CMD=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then
    PYTHON_CMD="$(command -v "$cmd")"
    break
  fi
done

case "$ACTION" in
  install)
    echo -e "${CYAN}Instalando servicio systemd de usuario: $SERVICE_NAME${RESET}"

    mkdir -p "$SYSTEMD_USER_DIR"
    chmod +x "$LAUNCH_SCRIPT"

    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Adaptive Commercial System — ACS Ecosystem
After=network.target graphical-session.target
Wants=graphical-session.target

[Service]
Type=forking
WorkingDirectory=${REPO_ROOT}
ExecStart=${LAUNCH_SCRIPT} --detach
ExecStop=/bin/kill -TERM \$MAINPID
Restart=on-failure
RestartSec=10
Environment=HOME=${HOME}
Environment=PATH=/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF

    # Enable lingering so user services run without active session
    if command -v loginctl &>/dev/null; then
      loginctl enable-linger "$USER" 2>/dev/null || true
    fi

    systemctl --user daemon-reload
    systemctl --user enable "$SERVICE_NAME"

    echo ""
    echo -e "${GREEN}✅ Servicio instalado y habilitado${RESET}"
    echo -e "   Archivo: $SERVICE_FILE"
    echo -e "   El ACS arrancará automáticamente al iniciar sesión."
    echo ""
    echo -e "   Comandos útiles:"
    echo -e "   ${CYAN}systemctl --user start   $SERVICE_NAME${RESET}"
    echo -e "   ${CYAN}systemctl --user stop    $SERVICE_NAME${RESET}"
    echo -e "   ${CYAN}systemctl --user status  $SERVICE_NAME${RESET}"
    echo -e "   ${CYAN}journalctl --user -u $SERVICE_NAME -f${RESET}"
    echo ""
    echo -e "${YELLOW}   Para desinstalar: ./autostart/linux_autostart.sh uninstall${RESET}"
    ;;

  uninstall)
    echo -e "${YELLOW}Desinstalando servicio: $SERVICE_NAME${RESET}"
    systemctl --user stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl --user disable "$SERVICE_NAME" 2>/dev/null || true
    rm -f "$SERVICE_FILE"
    systemctl --user daemon-reload
    echo -e "${GREEN}✅ Servicio desinstalado.${RESET}"
    ;;

  status)
    systemctl --user status "$SERVICE_NAME" || true
    ;;

  start)
    echo -e "${CYAN}Iniciando $SERVICE_NAME...${RESET}"
    systemctl --user start "$SERVICE_NAME"
    echo -e "${GREEN}✅ Servicio iniciado.${RESET}"
    ;;

  stop)
    echo -e "${YELLOW}Deteniendo $SERVICE_NAME...${RESET}"
    systemctl --user stop "$SERVICE_NAME"
    echo -e "${GREEN}✅ Servicio detenido.${RESET}"
    ;;

  *)
    echo "Uso: $0 {install|uninstall|status|start|stop}"
    exit 1
    ;;
esac
